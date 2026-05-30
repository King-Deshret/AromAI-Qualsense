import { supabaseAdmin } from './supabase';
import { writeAuditLog } from './audit';
import { dispatchNotification, dispatchNotificationToMany, getManagerIds } from './notifications';
import { isValidTransition } from './state-machine';
import type { Grade, ColorCategory, FrameData } from './types';

// ─── Session Completion Detector ──────────────────────────────────────────────

export async function runSessionCompletionCheck(session_id: string, lot_id: string) {
  // Fetch session and lot with config
  const [{ data: session }, { data: lot }, { data: config }] = await Promise.all([
    supabaseAdmin.from('inspection_sessions').select('*').eq('id', session_id).single(),
    supabaseAdmin.from('lots').select('*').eq('id', lot_id).single(),
    supabaseAdmin.from('system_config').select('*').limit(1).single(),
  ]);

  if (!session || session.status === 'COMPLETED') return;
  if (!lot || lot.status !== 'INSPECTION_RUNNING') return;
  if (!config) return;

  // Count frames in this session
  const { count: frameCount } = await supabaseAdmin
    .from('frame_data')
    .select('id', { count: 'exact', head: true })
    .eq('session_id', session_id);

  const durationSec = (Date.now() - new Date(session.started_at).getTime()) / 1000;

  let endReason: string | null = null;

  if (frameCount && frameCount >= lot.estimated_units) {
    endReason = 'UNIT_COUNT_REACHED';
  } else if (durationSec >= config.session_max_duration_sec) {
    endReason = 'MAX_DURATION';
  }

  if (!endReason) return;

  await completeSession(session_id, lot_id, session.operator_id, endReason as never);
}

// ─── Inspection Aggregator ────────────────────────────────────────────────────

export async function completeSession(
  session_id: string,
  lot_id: string,
  operator_id: string,
  end_reason: 'CONVEYOR_STOPPED' | 'UNIT_COUNT_REACHED' | 'MAX_DURATION' | 'MANUAL'
) {
  // Mark session completed
  await supabaseAdmin
    .from('inspection_sessions')
    .update({ status: 'COMPLETED', ended_at: new Date().toISOString(), end_reason })
    .eq('id', session_id);

  // Fetch all frames
  const { data: frames } = await supabaseAdmin
    .from('frame_data')
    .select('*')
    .eq('session_id', session_id);

  if (!frames || frames.length === 0) return;

  const typedFrames = frames as unknown as FrameData[];

  const total = typedFrames.length;
  const avgConfidence = typedFrames.reduce((s, f) => s + f.confidence_score, 0) / total;
  const avgRot = typedFrames.reduce((s, f) => s + f.rot_level, 0) / total;
  const avgAnomaly = typedFrames.reduce((s, f) => s + f.anomaly_score, 0) / total;
  const totalDefects = typedFrames.reduce((s, f) => s + f.defect_count, 0);

  // Defect distribution
  const defectDist: Record<string, number> = {};
  for (const f of typedFrames) {
    for (const d of f.defect_types) {
      defectDist[d] = (defectDist[d] ?? 0) + 1;
    }
  }

  // Dominant color
  const colorCounts: Record<string, number> = {};
  for (const f of typedFrames) {
    colorCounts[f.color_category] = (colorCounts[f.color_category] ?? 0) + 1;
  }
  const dominantColor = Object.entries(colorCounts).sort((a, b) => b[1] - a[1])[0]?.[0] as ColorCategory ?? 'Normal';

  // Pass/fail
  const { data: config } = await supabaseAdmin.from('system_config').select('*').single();
  const passCount = typedFrames.filter(
    (f) => f.confidence_score >= (config?.confidence_min ?? 0.7)
  ).length;
  const failCount = total - passCount;

  // Grade determination
  const grade = await determineGrade(avgConfidence, avgRot, totalDefects, avgAnomaly);

  const startedAt = new Date(
    (await supabaseAdmin.from('inspection_sessions').select('started_at').eq('id', session_id).single()).data?.started_at ?? ''
  ).getTime();
  const duration = Math.round((Date.now() - startedAt) / 1000);

  // Create inspection report
  const { data: report } = await supabaseAdmin
    .from('inspection_reports')
    .insert({
      lot_id,
      session_id,
      final_grade: grade,
      avg_confidence: avgConfidence,
      avg_rot_level: avgRot,
      final_anomaly_score: avgAnomaly,
      dominant_color_category: dominantColor,
      total_defects: totalDefects,
      defect_distribution: defectDist,
      total_objects_scanned: total,
      pass_count: passCount,
      fail_count: failCount,
      inspection_duration: duration,
      snapshot_urls: [],
    })
    .select()
    .single();

  // Transition lot to MANAGER_REVIEW
  await supabaseAdmin
    .from('lots')
    .update({ status: 'MANAGER_REVIEW', status_changed_at: new Date().toISOString() })
    .eq('id', lot_id);

  await writeAuditLog({
    action_type: 'SESSION_COMPLETED',
    target_type: 'inspection_sessions',
    target_id: session_id,
    value_after: { lot_id, end_reason, grade, total_objects_scanned: total },
  });

  // Notify operator
  await dispatchNotification({
    user_id: operator_id,
    type: 'SESSION_COMPLETE',
    title: 'Sesi Inspeksi Selesai',
    message: `Inspeksi lot selesai dengan grade ${grade}. Total ${total} objek terpindai.`,
    reference_type: 'lots',
    reference_id: lot_id,
  });

  // Notify all managers
  const managerIds = await getManagerIds();
  await dispatchNotificationToMany(managerIds, {
    type: 'LOT_READY_FOR_REVIEW',
    title: 'Lot Siap Direview',
    message: `Lot baru menunggu keputusan. Grade sementara: ${grade}. Confidence: ${(avgConfidence * 100).toFixed(1)}%.`,
    reference_type: 'lots',
    reference_id: lot_id,
  });

  // Critical alert if needed
  if (avgRot > 60 || avgAnomaly > 0.8) {
    await dispatchNotificationToMany(managerIds, {
      type: 'CRITICAL_QUALITY_ALERT',
      title: 'Alert Kualitas Kritis',
      message: `Lot memiliki rot level ${avgRot.toFixed(1)}% dan anomaly score ${avgAnomaly.toFixed(2)}. Perlu perhatian segera.`,
      reference_type: 'lots',
      reference_id: lot_id,
    });
  }
}

async function determineGrade(
  avgConfidence: number,
  avgRot: number,
  totalDefects: number,
  avgAnomaly: number
): Promise<Grade> {
  const { data: thresholds } = await supabaseAdmin
    .from('thresholds')
    .select('*')
    .eq('product_type', 'default')
    .order('max_rot_level', { ascending: true });

  if (!thresholds?.length) {
    // Fallback heuristic
    if (avgConfidence >= 0.9 && avgRot < 10) return 'A';
    if (avgConfidence >= 0.75 && avgRot < 30) return 'B';
    if (avgConfidence >= 0.60 && avgRot < 60) return 'C';
    return 'Reject';
  }

  for (const t of thresholds) {
    if (t.grade === 'Reject') continue;
    if (
      avgConfidence >= t.min_confidence &&
      avgRot <= t.max_rot_level &&
      totalDefects <= t.max_defect_count &&
      avgAnomaly <= t.max_anomaly_score
    ) {
      return t.grade as Grade;
    }
  }

  return 'Reject';
}
