import { getServerSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { makeApiError } from '@/lib/utils';

export async function GET() {
  const user = await getServerSession();
  if (!user) return makeApiError(401, 'UNAUTHORIZED', 'Unauthenticated');
  if (user.role === 'Operator') return makeApiError(403, 'FORBIDDEN', 'Access denied');

  const from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: lots } = await supabaseAdmin.from('lots').select('id, status, product_type, shift').gte('created_at', from);
  const { data: reports } = await supabaseAdmin.from('inspection_reports').select('final_grade, avg_confidence, avg_rot_level, inspection_duration').gte('created_at', from);

  const shiftBreakdown: Record<string, number> = {};
  for (const l of lots ?? []) { shiftBreakdown[l.shift] = (shiftBreakdown[l.shift] ?? 0) + 1; }

  const gradeDistribution: Record<string, number> = {};
  for (const r of reports ?? []) { gradeDistribution[r.final_grade] = (gradeDistribution[r.final_grade] ?? 0) + 1; }

  return Response.json({
    period: 'monthly',
    from,
    total_lots: lots?.length ?? 0,
    approved: lots?.filter((l) => l.status === 'APPROVED').length ?? 0,
    rejected: lots?.filter((l) => l.status === 'REJECTED').length ?? 0,
    quarantined: lots?.filter((l) => l.status === 'QUARANTINED').length ?? 0,
    grade_distribution: gradeDistribution,
    shift_breakdown: shiftBreakdown,
    avg_confidence: reports?.length ? (reports.reduce((s, r) => s + r.avg_confidence, 0) / reports.length).toFixed(4) : '0',
    avg_rot_level: reports?.length ? (reports.reduce((s, r) => s + r.avg_rot_level, 0) / reports.length).toFixed(2) : '0',
    avg_duration_min: reports?.length ? Math.round(reports.reduce((s, r) => s + r.inspection_duration, 0) / reports.length / 60) : 0,
  });
}
