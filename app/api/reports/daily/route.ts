import { getServerSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { makeApiError } from '@/lib/utils';

export async function GET() {
  const user = await getServerSession();
  if (!user) return makeApiError(401, 'UNAUTHORIZED', 'Unauthenticated');
  if (user.role === 'Operator') return makeApiError(403, 'FORBIDDEN', 'Access denied');

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const from = today.toISOString();
  const to = new Date(today.getTime() + 86400000).toISOString();

  const [{ data: lots }, { data: reports }] = await Promise.all([
    supabaseAdmin.from('lots').select('id, status, product_type, shift').gte('created_at', from).lt('created_at', to),
    supabaseAdmin.from('inspection_reports').select('final_grade, avg_confidence, avg_rot_level').gte('created_at', from).lt('created_at', to),
  ]);

  const breakdown: Record<string, number> = {};
  for (const lot of lots ?? []) { breakdown[lot.product_type] = (breakdown[lot.product_type] ?? 0) + 1; }

  return Response.json({
    period: 'daily',
    date: from,
    total_lots: lots?.length ?? 0,
    approved: lots?.filter((l) => l.status === 'APPROVED').length ?? 0,
    rejected: lots?.filter((l) => l.status === 'REJECTED').length ?? 0,
    quarantined: lots?.filter((l) => l.status === 'QUARANTINED').length ?? 0,
    breakdown_by_product: breakdown,
    avg_confidence: reports?.length ? reports.reduce((s, r) => s + r.avg_confidence, 0) / reports.length : 0,
    avg_rot_level: reports?.length ? reports.reduce((s, r) => s + r.avg_rot_level, 0) / reports.length : 0,
  });
}
