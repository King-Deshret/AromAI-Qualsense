import { NextRequest } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase';
import { getServerSession } from '@/lib/auth';
import { makeApiError, getClientIp } from '@/lib/utils';
import { writeAuditLog } from '@/lib/audit';
import type { UserRole } from '@/lib/types';

const createUserSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email().max(254),
  password: z.string().min(8),
  role: z.enum(['Admin', 'Manager', 'Operator'] as [UserRole, ...UserRole[]]),
  shift: z.enum(['Pagi', 'Siang', 'Malam']).optional(),
});

export async function GET(request: NextRequest) {
  const user = await getServerSession();
  if (!user) return makeApiError(401, 'UNAUTHORIZED', 'Unauthenticated');
  if (user.role !== 'Admin') return makeApiError(403, 'FORBIDDEN', 'Admin only');

  const url = new URL(request.url);
  const role = url.searchParams.get('role');
  const status = url.searchParams.get('status');

  let query = supabaseAdmin.from('users').select('*', { count: 'exact' });
  if (role) query = query.eq('role', role);
  if (status) query = query.eq('status', status);

  const { data, error, count } = await query.order('created_at', { ascending: false });
  if (error) return makeApiError(500, 'INTERNAL_ERROR', error.message);

  return Response.json({ data: data ?? [], total: count ?? 0 });
}

export async function POST(request: NextRequest) {
  const user = await getServerSession();
  if (!user) return makeApiError(401, 'UNAUTHORIZED', 'Unauthenticated');
  if (user.role !== 'Admin') return makeApiError(403, 'FORBIDDEN', 'Admin only');

  const body = await request.json().catch(() => null);
  const parsed = createUserSchema.safeParse(body);
  if (!parsed.success) {
    return makeApiError(400, 'VALIDATION_ERROR', 'Invalid input', [
      ...parsed.error.errors.map((e) => ({ field: e.path.join('.'), constraint: e.code, message: e.message })),
    ]);
  }

  const { name, email, password, role, shift } = parsed.data;

  const { data: existing } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('email', email.toLowerCase())
    .maybeSingle();

  if (existing) {
    return makeApiError(400, 'VALIDATION_ERROR', 'Email already registered', [
      { field: 'email', constraint: 'unique', message: 'Email sudah terdaftar' },
    ]);
  }

  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name, role },
  });

  if (authError || !authData.user) {
    return makeApiError(500, 'INTERNAL_ERROR', authError?.message ?? 'Auth creation failed');
  }

  const { data: newUser, error: insertError } = await supabaseAdmin
    .from('users')
    .insert({ id: authData.user.id, name, email: email.toLowerCase(), role, status: 'ACTIVE', shift: shift ?? null })
    .select()
    .single();

  if (insertError) {
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
    return makeApiError(500, 'INTERNAL_ERROR', insertError.message);
  }

  await writeAuditLog({
    actor_id: user.id,
    action_type: 'USER_CREATED',
    target_type: 'users',
    target_id: newUser.id,
    value_after: { name, email: email.toLowerCase(), role, status: 'ACTIVE' },
    ip_address: getClientIp(request),
  });

  return Response.json(newUser, { status: 201 });
}
