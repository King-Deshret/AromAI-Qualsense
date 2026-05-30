import { getServerSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { makeApiError } from '@/lib/utils';

export async function GET() {
  const user = await getServerSession();
  if (!user) return makeApiError(401, 'UNAUTHORIZED', 'Unauthenticated');

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayISO = today.toISOString();

  const [
    { count: pending },
    { count: approved },
    { count: rejected },
    { count: quarantined },
    { count: activeOperators },
    { count: activeManagers },
    { count: alerts },
    { data: confidenceData },
  ] = await Promise.all([
    supabaseAdmin.from('lots').select('id', { count: 'exact', head: true }).eq('status', 'MANAGER_REVIEW'),
    supabaseAdmin.from('lots').select('id', { count: 'exact', head: true }).eq('status', 'APPROVED').gte('created_at', todayISO),
    supabaseAdmin.from('lots').select('id', { count: 'exact', head: true }).eq('status', 'REJECTED').gte('created_at', todayISO),
    supabaseAdmin.from('lots').select('id', { count: 'exact', head: true }).eq('status', 'QUARANTINED').gte('created_at', todayISO),
    supabaseAdmin.from('users').select('id', { count: 'exact', head: true }).eq('role', 'Operator').eq('status', 'ACTIVE'),
    supabaseAdmin.from('users').select('id', { count: 'exact', head: true }).eq('role', 'Manager').eq('status', 'ACTIVE'),
    supabaseAdmin.from('notifications').select('id', { count: 'exact', head: true }).eq('is_read', false).in('type', ['SYSTEM_ALERT', 'DATA_ALERT', 'PERFORMANCE_ALERT']),
    supabaseAdmin.from('inspection_reports').select('avg_confidence').gte('created_at', todayISO),
  ]);

  const totalToday = (approved ?? 0) + (rejected ?? 0) + (quarantined ?? 0);
  const passRate = totalToday > 0 ? ((approved ?? 0) / totalToday) * 100 : 0;
  const failRate = totalToday > 0 ? ((rejected ?? 0) / totalToday) * 100 : 0;
  const avgConf =
    confidenceData && confidenceData.length > 0
      ? confidenceData.reduce((s, r) => s + (r.avg_confidence ?? 0), 0) / confidenceData.length
      : 0;

  return Response.json({
    pending_lots: pending ?? 0,
    pass_rate: parseFloat(passRate.toFixed(1)),
    fail_rate: parseFloat(failRate.toFixed(1)),
    avg_confidence: parseFloat(avgConf.toFixed(4)),
    total_approved_today: approved ?? 0,
    total_rejected_today: rejected ?? 0,
    total_quarantined_today: quarantined ?? 0,
    active_operators: activeOperators ?? 0,
    active_managers: activeManagers ?? 0,
    unhandled_alerts: alerts ?? 0,
  });
}
