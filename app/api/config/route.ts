import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getServerSession } from '@/lib/auth';
import { makeApiError, getClientIp } from '@/lib/utils';
import { writeAuditLog } from '@/lib/audit';

export async function GET() {
  const user = await getServerSession();
  if (!user) return makeApiError(401, 'UNAUTHORIZED', 'Unauthenticated');
  if (user.role !== 'Admin') return makeApiError(403, 'FORBIDDEN', 'Admin only');

  const { data, error } = await supabaseAdmin.from('system_config').select('*').single();
  if (error) return makeApiError(500, 'INTERNAL_ERROR', error.message);
  return Response.json(data);
}

export async function PATCH(request: NextRequest) {
  const user = await getServerSession();
  if (!user) return makeApiError(401, 'UNAUTHORIZED', 'Unauthenticated');
  if (user.role !== 'Admin') return makeApiError(403, 'FORBIDDEN', 'Admin only');

  const body = await request.json().catch(() => null);
  if (!body) return makeApiError(400, 'VALIDATION_ERROR', 'Empty body');

  const { data: current } = await supabaseAdmin.from('system_config').select('*').single();

  const { data: updated, error } = await supabaseAdmin
    .from('system_config')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', current?.id ?? '')
    .select()
    .single();

  if (error) return makeApiError(500, 'INTERNAL_ERROR', error.message);

  await writeAuditLog({
    actor_id: user.id,
    action_type: 'CONFIG_UPDATED',
    target_type: 'system_config',
    target_id: current?.id ?? '',
    value_before: current ?? undefined,
    value_after: body,
    ip_address: getClientIp(request),
  });

  return Response.json(updated);
}
