import { NextRequest } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase';
import { makeApiError, getClientIp } from '@/lib/utils';
import { writeAuditLog } from '@/lib/audit';
import type { UserRole } from '@/lib/types';

const signupSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email().max(254),
  password: z.string().min(8),
  role: z.enum(['Admin', 'Manager', 'Operator'] as [UserRole, ...UserRole[]]),
});

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = signupSchema.safeParse(body);

  if (!parsed.success) {
    return makeApiError(400, 'VALIDATION_ERROR', 'Invalid input', [
      ...parsed.error.errors.map((e) => ({
        field: e.path.join('.'),
        constraint: e.code,
        message: e.message,
      })),
    ]);
  }

  const { name, email, password, role } = parsed.data;

  // Check email uniqueness (case-insensitive)
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

  // Create Supabase Auth user
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // skip email confirmation in enterprise flow
    user_metadata: { name, role },
  });

  if (authError || !authData.user) {
    return makeApiError(500, 'INTERNAL_ERROR', authError?.message ?? 'Failed to create auth user');
  }

  // Insert into users table
  const { error: insertError } = await supabaseAdmin.from('users').insert({
    id: authData.user.id,
    name,
    email: email.toLowerCase(),
    role,
    status: 'PENDING_ACTIVATION',
  });

  if (insertError) {
    // Roll back auth user creation
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
    return makeApiError(500, 'INTERNAL_ERROR', insertError.message);
  }

  await writeAuditLog({
    action_type: 'USER_REGISTERED',
    target_type: 'users',
    target_id: authData.user.id,
    value_after: { name, email: email.toLowerCase(), role, status: 'PENDING_ACTIVATION' },
    ip_address: getClientIp(request),
  });

  return Response.json({ message: 'Akun berhasil dibuat, silakan login' }, { status: 201 });
}
