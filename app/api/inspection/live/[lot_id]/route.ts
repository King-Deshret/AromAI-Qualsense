import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getServerSession } from '@/lib/auth';
import { makeApiError } from '@/lib/utils';
import type { Grade, ColorCategory, FrameData } from '@/lib/types';

export async function GET(_: NextRequest, { params }: { params: Promise<{ lot_id: string }> }) {
  const user = await getServerSession();
  if (!user) return makeApiError(401, 'UNAUTHORIZED', 'Unauthenticated');

  const { lot_id } = await params;

  if (user.role === 'Operator') {
    const { data: lot } = await supabaseAdmin.from('lots').select('operator_id').eq('id', lot_id).single();
    if (lot?.operator_id !== user.id) return makeApiError(403, 'FORBIDDEN', 'Access denied');
  }

  const { data: session } = await supabaseAdmin
    .from('inspection_sessions')
    .select('id')
    .eq('lot_id', lot_id)
    .eq('status', 'RUNNING')
    .single();

  if (!session) {
    return Response.json({
      total_objects_scanned: 0,
      pass_count: 0,
      fail_count: 0,
      avg_confidence: 0,
      avg_rot_level: 0,
      avg_anomaly_score: 0,
      defect_distribution: {},
      estimated_grade: 'A' as Grade,
    });
  }

  const { data: frames } = await supabaseAdmin
    .from('frame_data')
    .select('confidence_score, rot_level, anomaly_score, defect_types, defect_count')
    .eq('session_id', session.id);

  if (!frames?.length) {
    return Response.json({ total_objects_scanned: 0, pass_count: 0, fail_count: 0, avg_confidence: 0, avg_rot_level: 0, avg_anomaly_score: 0, defect_distribution: {}, estimated_grade: 'A' as Grade });
  }

  const { data: config } = await supabaseAdmin.from('system_config').select('confidence_min').single();
  const confMin = config?.confidence_min ?? 0.7;

  const total = frames.length;
  const avg = (key: keyof (typeof frames)[0]) =>
    (frames as Record<string, number>[]).reduce((s, f) => s + (f[key as string] as number), 0) / total;

  const avgConf = avg('confidence_score');
  const avgRot = avg('rot_level');
  const avgAnomaly = avg('anomaly_score');
  const passCount = frames.filter((f) => (f.confidence_score as number) >= confMin).length;

  const defectDist: Record<string, number> = {};
  for (const f of frames) {
    for (const d of (f.defect_types as string[] | null) ?? []) {
      defectDist[d] = (defectDist[d] ?? 0) + 1;
    }
  }

  const grade: Grade =
    avgConf >= 0.9 && avgRot < 10 ? 'A'
    : avgConf >= 0.75 && avgRot < 30 ? 'B'
    : avgConf >= 0.6 && avgRot < 60 ? 'C'
    : 'Reject';

  return Response.json({
    total_objects_scanned: total,
    pass_count: passCount,
    fail_count: total - passCount,
    avg_confidence: parseFloat(avgConf.toFixed(4)),
    avg_rot_level: parseFloat(avgRot.toFixed(2)),
    avg_anomaly_score: parseFloat(avgAnomaly.toFixed(4)),
    defect_distribution: defectDist,
    estimated_grade: grade,
  });
}
