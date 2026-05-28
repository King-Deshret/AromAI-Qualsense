/**
 * Auth Login API Route
 *
 * Flow per diagram:
 * 1. Submit credentials
 * 2. Check email verified → if not, return 403 with "email_not_verified"
 * 3. Check credentials valid → if not, return 401 generic error
 * 4. Read role from Supabase user_metadata
 * 5. Return role for client-side redirect
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  checkLockout,
  recordLoginAttempt,
  clearFailedAttempts,
} from '@/lib/api/login-lockout';

const GENERIC_AUTH_ERROR = 'Email atau password salah.';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { errors: [{ message: 'Email dan password wajib diisi.' }] },
        { status: 400 }
      );
    }

    // Check lockout
    const lockoutStatus = await checkLockout(email);
    if (lockoutStatus.locked) {
      const response = NextResponse.json(
        { errors: [{ message: lockoutStatus.message }] },
        { status: 429 }
      );
      if (lockoutStatus.retryAfter) {
        response.headers.set('Retry-After', String(lockoutStatus.retryAfter));
      }
      return response;
    }

    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      await recordLoginAttempt(email, false);

      // Check if the error is due to email not confirmed
      if (
        error.message.toLowerCase().includes('email not confirmed') ||
        error.message.toLowerCase().includes('not confirmed')
      ) {
        return NextResponse.json(
          { errors: [{ message: 'Email belum diverifikasi. Cek email kamu.', code: 'email_not_verified' }] },
          { status: 403 }
        );
      }

      return NextResponse.json(
        { errors: [{ message: GENERIC_AUTH_ERROR }] },
        { status: 401 }
      );
    }

    await clearFailedAttempts(email);

    // Read role from Supabase user_metadata (set during signup)
    const userMeta = data.user?.user_metadata || {};
    const role: string | null = userMeta.role || null;

    return NextResponse.json({
      data: {
        user: {
          id: data.user.id,
          email: data.user.email,
          role,
        },
      },
    });
  } catch {
    return NextResponse.json(
      { errors: [{ message: GENERIC_AUTH_ERROR }] },
      { status: 500 }
    );
  }
}
