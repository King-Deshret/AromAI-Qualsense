import { getServerSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { makeApiError } from '@/lib/utils';

export async function GET() {
  const user = await getServerSession();
  if (!user) return makeApiError(401, 'UNAUTHORIZED', 'Unauthenticated');
  if (user.role === 'Operator') return makeApiError(403, 'FORBIDDEN', 'Access denied');

  const from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: lots } = await supabaseAdmin.from('lots').select('id, status, product_type').gte('created_at', from);
  const { data: reports } = await supabaseAdmin.from('inspection_reports').select('final_grade, avg_confidence').gte('created_at', from);

  const gradeDistribution: Record<string, number> = {};
  for (const r of reports ?? []) { gradeDistribution[r.final_grade] = (gradeDistribution[r.final_grade] ?? 0) + 1; }

  return Response.json({
    period: 'weekly',
    from,
    total_lots: lots?.length ?? 0,
    grade_distribution: gradeDistribution,
    rejection_rate: lots?.length ? ((lots.filter((l) => l.status === 'REJECTED').length / lots.length) * 100).toFixed(1) : '0',
    avg_confidence: reports?.length ? (reports.reduce((s, r) => s + r.avg_confidence, 0) / reports.length).toFixed(4) : '0',
  });
}
