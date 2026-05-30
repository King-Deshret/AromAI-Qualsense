import { NextRequest } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase';
import { getServerSession } from '@/lib/auth';
import { makeApiError, getClientIp } from '@/lib/utils';
import { writeAuditLog } from '@/lib/audit';

const patchUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'PENDING_ACTIVATION']).optional(),
  role: z.enum(['Admin', 'Manager', 'Operator']).optional(),
  shift: z.enum(['Pagi', 'Siang', 'Malam']).optional(),
});

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getServerSession();
  if (!user) return makeApiError(401, 'UNAUTHORIZED', 'Unauthenticated');
  if (user.role !== 'Admin') return makeApiError(403, 'FORBIDDEN', 'Admin only');

  const { id } = await params;
  const { data, error } = await supabaseAdmin.from('users').select('*').eq('id', id).single();
  if (error || !data) return makeApiError(404, 'NOT_FOUND', 'User not found');
  return Response.json(data);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getServerSession();
  if (!user) return makeApiError(401, 'UNAUTHORIZED', 'Unauthenticated');
  if (user.role !== 'Admin') return makeApiError(403, 'FORBIDDEN', 'Admin only');

  const { id } = await params;

  // Prevent self-demotion
  if (id === user.id) {
    const body = await request.json().catch(() => null);
    if (body?.status === 'INACTIVE' || (body?.role && body.role !== 'Admin')) {
      return makeApiError(403, 'FORBIDDEN', 'Admin tidak bisa menonaktifkan atau mengubah role sendiri');
    }
  }

  const body = await request.json().catch(() => null);
  const parsed = patchUserSchema.safeParse(body);
  if (!parsed.success) return makeApiError(400, 'VALIDATION_ERROR', 'Invalid input');

  const { data: current } = await supabaseAdmin.from('users').select('*').eq('id', id).single();
  if (!current) return makeApiError(404, 'NOT_FOUND', 'User not found');

  const { data: updated, error } = await supabaseAdmin
    .from('users')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) return makeApiError(500, 'INTERNAL_ERROR', error.message);

  // If deactivating, revoke auth session
  if (parsed.data.status === 'INACTIVE') {
    setTimeout(async () => {
      await supabaseAdmin.auth.admin.signOut(id, 'others');
    }, 30_000);
  }

  await writeAuditLog({
    actor_id: user.id,
    action_type: 'USER_UPDATED',
    target_type: 'users',
    target_id: id,
    value_before: { status: current.status, role: current.role },
    value_after: parsed.data,
    ip_address: getClientIp(request),
  });

  return Response.json(updated);
}
