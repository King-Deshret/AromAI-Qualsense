import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerClient, supabaseAdmin } from '@/lib/supabase';
import { makeApiError, getClientIp } from '@/lib/utils';
import { writeAuditLog } from '@/lib/audit';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// Simple in-memory rate limiter for failed logins
// In production, replace with Redis-backed solution
const failedAttempts = new Map<string, { count: number; firstAt: number; lockedUntil?: number }>();
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;

function checkRateLimit(email: string): { locked: boolean; remaining: number } {
  const key = email.toLowerCase();
  const now = Date.now();
  const record = failedAttempts.get(key);

  if (!record) return { locked: false, remaining: MAX_ATTEMPTS };

  if (record.lockedUntil && now < record.lockedUntil) {
    return { locked: true, remaining: 0 };
  }

  if (now - record.firstAt > WINDOW_MS) {
    failedAttempts.delete(key);
    return { locked: false, remaining: MAX_ATTEMPTS };
  }

  return { locked: false, remaining: MAX_ATTEMPTS - record.count };
}

function recordFailure(email: string) {
  const key = email.toLowerCase();
  const now = Date.now();
  const record = failedAttempts.get(key);

  if (!record || now - record.firstAt > WINDOW_MS) {
    failedAttempts.set(key, { count: 1, firstAt: now });
    return;
  }

  record.count += 1;
  if (record.count >= MAX_ATTEMPTS) {
    record.lockedUntil = now + LOCK_DURATION_MS;
  }
}

function clearFailures(email: string) {
  failedAttempts.delete(email.toLowerCase());
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);

  if (!parsed.success) {
    return makeApiError(400, 'VALIDATION_ERROR', 'Invalid input');
  }

  const { email, password } = parsed.data;
  const ip = getClientIp(request);

  // Rate limit check
  const rl = checkRateLimit(email);
  if (rl.locked) {
    return makeApiError(429, 'RATE_LIMITED', 'Akun terkunci sementara. Coba lagi dalam 15 menit.');
  }

  // Check user status before attempting auth
  const { data: userRecord } = await supabaseAdmin
    .from('users')
    .select('id, status, role, name')
    .eq('email', email.toLowerCase())
    .maybeSingle();

  if (userRecord?.status === 'PENDING_ACTIVATION') {
    return makeApiError(403, 'FORBIDDEN', 'Akun menunggu aktivasi admin');
  }

  if (userRecord?.status === 'INACTIVE') {
    // Generic error — don't reveal whether account exists
    recordFailure(email);
    return makeApiError(401, 'UNAUTHORIZED', 'Email atau password salah');
  }

  // Authenticate via Supabase
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    recordFailure(email);
    await writeAuditLog({
      action_type: 'LOGIN_FAILED',
      target_type: 'users',
      target_id: userRecord?.id ?? email.toLowerCase(),
      ip_address: ip,
      status: 'FAILURE',
    });
    return makeApiError(401, 'UNAUTHORIZED', 'Email atau password salah');
  }

  clearFailures(email);

  // If public.users record is missing, fetch from auth metadata as fallback
  let profile = userRecord;
  if (!profile) {
    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(data.user.id);
    const meta = authUser.user?.user_metadata;
    if (meta?.role) {
      // Auto-create public.users row from auth metadata
      const { data: created } = await supabaseAdmin
        .from('users')
        .insert({
          id: data.user.id,
          name: meta.name ?? email.split('@')[0],
          email: email.toLowerCase(),
          role: meta.role,
          status: 'ACTIVE',
        })
        .select('id, status, role, name')
        .single();
      profile = created;
    }
  }

  if (!profile) {
    return makeApiError(403, 'FORBIDDEN', 'Akun tidak ditemukan di sistem. Hubungi Admin.');
  }

  if (profile.status === 'PENDING_ACTIVATION') {
    return makeApiError(403, 'FORBIDDEN', 'Akun menunggu aktivasi admin');
  }

  await writeAuditLog({
    actor_id: data.user.id,
    action_type: 'LOGIN_SUCCESS',
    target_type: 'users',
    target_id: data.user.id,
    ip_address: ip,
  });

  return Response.json({
    user: profile,
    role: profile.role,
    session: {
      access_token: data.session?.access_token,
      expires_at: data.session?.expires_at,
    },
  });
}
