import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getServerSession } from '@/lib/auth';
import { makeApiError, getClientIp } from '@/lib/utils';
import { runAutoDecision } from '@/lib/auto-decision';
import { writeAuditLog } from '@/lib/audit';
import type { InspectionReport } from '@/lib/types';

export async function POST(_: NextRequest, { params }: { params: Promise<{ lot_id: string }> }) {
  const user = await getServerSession();
  if (!user) return makeApiError(401, 'UNAUTHORIZED', 'Unauthenticated');
  if (user.role === 'Operator') return makeApiError(403, 'FORBIDDEN', 'Access denied');

  const { lot_id } = await params;

  const { data: report, error } = await supabaseAdmin
    .from('inspection_reports')
    .select('*')
    .eq('lot_id', lot_id)
    .single();

  if (error || !report) return makeApiError(404, 'NOT_FOUND', 'Inspection report not found');

  const result = await runAutoDecision(report as unknown as InspectionReport);

  const { data: decision } = await supabaseAdmin
    .from('decisions')
    .insert({
      lot_id,
      inspection_report_id: report.id,
      decision: result.decision,
      decided_by: null,
      is_system_decision: true,
      rules_evaluated: result.rules_evaluated as unknown as import('@/lib/database.types').Json,
    })
    .select()
    .single();

  await writeAuditLog({
    action_type: 'AUTO_DECISION_RUN',
    target_type: 'lots',
    target_id: lot_id,
    value_after: { decision: result.decision, rules_evaluated: result.rules_evaluated },
  });

  return Response.json({ decision, result });
}
