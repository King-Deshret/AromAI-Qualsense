import { NextRequest } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase';
import { getServerSession } from '@/lib/auth';
import { makeApiError, getClientIp } from '@/lib/utils';
import { writeAuditLog } from '@/lib/audit';
import { isValidTransition } from '@/lib/state-machine';
import { dispatchNotification } from '@/lib/notifications';
import type { LotStatus, DecisionValue } from '@/lib/types';

const overrideSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED', 'QUARANTINED', 'ESCALATED'] as [DecisionValue, ...DecisionValue[]]),
  override_reason: z.string().min(1).optional(),
  escalation_reason: z.string().min(1).optional(),
});

const DECISION_TO_STATUS: Record<DecisionValue, LotStatus> = {
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  QUARANTINED: 'QUARANTINED',
  ESCALATED: 'ESCALATED',
};

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ lot_id: string }> }) {
  const user = await getServerSession();
  if (!user) return makeApiError(401, 'UNAUTHORIZED', 'Unauthenticated');
  if (user.role === 'Operator') return makeApiError(403, 'FORBIDDEN', 'Access denied');

  const { lot_id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = overrideSchema.safeParse(body);
  if (!parsed.success) return makeApiError(400, 'VALIDATION_ERROR', 'Invalid input');

  const { data: lot } = await supabaseAdmin.from('lots').select('*').eq('id', lot_id).single();
  if (!lot) return makeApiError(404, 'NOT_FOUND', 'Lot not found');

  const newStatus = DECISION_TO_STATUS[parsed.data.decision];
  if (!isValidTransition(lot.status as LotStatus, newStatus)) {
    return makeApiError(409, 'CONFLICT', `Invalid transition: ${lot.status} → ${newStatus}`);
  }

  const { data: report } = await supabaseAdmin
    .from('inspection_reports')
    .select('id')
    .eq('lot_id', lot_id)
    .single();

  const { data: decision } = await supabaseAdmin
    .from('decisions')
    .insert({
      lot_id,
      inspection_report_id: report?.id ?? '',
      decision: parsed.data.decision,
      decided_by: user.id,
      is_system_decision: false,
      rules_evaluated: [],
      override_reason: parsed.data.override_reason ?? null,
      escalation_reason: parsed.data.escalation_reason ?? null,
    })
    .select()
    .single();

  // Update lot status
  await supabaseAdmin
    .from('lots')
    .update({ status: newStatus, status_changed_at: new Date().toISOString() })
    .eq('id', lot_id);

  await writeAuditLog({
    actor_id: user.id,
    action_type: 'DECISION_OVERRIDE',
    target_type: 'lots',
    target_id: lot_id,
    value_before: { status: lot.status },
    value_after: { status: newStatus, decision: parsed.data.decision, override_reason: parsed.data.override_reason },
    ip_address: getClientIp(request),
  });

  // Notify operator
  await dispatchNotification({
    user_id: lot.operator_id,
    type: parsed.data.decision === 'APPROVED' ? 'LOT_APPROVED'
      : parsed.data.decision === 'REJECTED' ? 'LOT_REJECTED'
      : parsed.data.decision === 'ESCALATED' ? 'LOT_ESCALATED'
      : 'LOT_QUARANTINED',
    title: `Lot ${parsed.data.decision}`,
    message: `Lot Anda telah ${parsed.data.decision} oleh ${user.name}.`,
    reference_type: 'lots',
    reference_id: lot_id,
  });

  return Response.json(decision);
}
