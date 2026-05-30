import { NextRequest } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase';
import { getServerSession } from '@/lib/auth';
import { makeApiError, getClientIp } from '@/lib/utils';
import { writeAuditLog } from '@/lib/audit';

const shiftSchema = z.object({
  shift_name: z.enum(['Pagi', 'Siang', 'Malam']),
  operator_id: z.string().uuid(),
  manager_id: z.string().uuid(),
  effective_date: z.string(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

export async function GET() {
  const user = await getServerSession();
  if (!user) return makeApiError(401, 'UNAUTHORIZED', 'Unauthenticated');
  if (user.role !== 'Admin') return makeApiError(403, 'FORBIDDEN', 'Admin only');

  const { data, error } = await supabaseAdmin
    .from('shift_assignments')
    .select('*, operator:operator_id(id,name), manager:manager_id(id,name)')
    .order('effective_date', { ascending: false });

  if (error) return makeApiError(500, 'INTERNAL_ERROR', error.message);
  return Response.json({ data: data ?? [] });
}

export async function POST(request: NextRequest) {
  const user = await getServerSession();
  if (!user) return makeApiError(401, 'UNAUTHORIZED', 'Unauthenticated');
  if (user.role !== 'Admin') return makeApiError(403, 'FORBIDDEN', 'Admin only');

  const body = await request.json().catch(() => null);
  const parsed = shiftSchema.safeParse(body);
  if (!parsed.success) return makeApiError(400, 'VALIDATION_ERROR', 'Invalid input');

  const { data, error } = await supabaseAdmin.from('shift_assignments').insert(parsed.data).select().single();
  if (error) return makeApiError(500, 'INTERNAL_ERROR', error.message);

  await writeAuditLog({
    actor_id: user.id,
    action_type: 'SHIFT_CREATED',
    target_type: 'shift_assignments',
    target_id: data.id,
    value_after: parsed.data,
    ip_address: getClientIp(request),
  });

  return Response.json(data, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const user = await getServerSession();
  if (!user) return makeApiError(401, 'UNAUTHORIZED', 'Unauthenticated');
  if (user.role !== 'Admin') return makeApiError(403, 'FORBIDDEN', 'Admin only');

  const body = await request.json().catch(() => null);
  if (!body?.id) return makeApiError(400, 'VALIDATION_ERROR', 'Missing id');

  const { id, ...rest } = body;
  const { data, error } = await supabaseAdmin.from('shift_assignments').update(rest).eq('id', id).select().single();
  if (error) return makeApiError(500, 'INTERNAL_ERROR', error.message);

  await writeAuditLog({
    actor_id: user.id,
    action_type: 'SHIFT_UPDATED',
    target_type: 'shift_assignments',
    target_id: id,
    value_after: rest,
    ip_address: getClientIp(request),
  });

  return Response.json(data);
}
