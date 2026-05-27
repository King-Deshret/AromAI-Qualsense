/**
 * Auth Login API Route (Proxy)
 *
 * Proxies login requests through the Next.js server to Supabase Auth.
 * This ensures no CORS issues because the browser only talks to the same-origin Next.js server.
 *
 * Pattern: Browser → Next.js API Route → Supabase Auth (server-side)
 *
 * Security:
 * - Generic error messages (does not reveal whether email or password was incorrect)
 * - Returns user role for client-side redirect logic
 * - Session cookie set server-side
 * - Account lockout after 5 failed attempts within 15-minute window (Req 17.7)
 *
 * Requirements: 17.1, 17.3, 17.5, 17.7
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuthHeaders, getDaasUrl } from '@/lib/api/auth-headers';
import {
  checkLockout,
  recordLoginAttempt,
  clearFailedAttempts,
} from '@/lib/api/login-lockout';

/** Generic error message for all auth failures (Req 17.3) */
const GENERIC_AUTH_ERROR = 'Invalid credentials. Please check your email and password.';

/**
 * POST /api/auth/login
 *
 * Authenticates user with email/password via Supabase Auth.
 * Returns user info including role for redirect logic.
 * Enforces account lockout after 5 failed attempts in 15 minutes (Req 17.7).
 */
export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { errors: [{ message: 'Email and password are required' }] },
        { status: 400 }
      );
    }

    // Check if account is locked out (Req 17.7)
    const lockoutStatus = await checkLockout(email);
    if (lockoutStatus.locked) {
      const response = NextResponse.json(
        {
          errors: [
            {
              message: lockoutStatus.message,
            },
          ],
        },
        { status: 429 }
      );
      // Set Retry-After header to indicate when the client can retry
      if (lockoutStatus.retryAfter) {
        response.headers.set(
          'Retry-After',
          String(lockoutStatus.retryAfter)
        );
      }
      return response;
    }

    const supabase = await createClient();

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      // Record failed attempt for lockout tracking (Req 17.7)
      await recordLoginAttempt(email, false);

      // Return generic error — do not expose whether email or password was wrong (Req 17.3)
      return NextResponse.json(
        { errors: [{ message: GENERIC_AUTH_ERROR }] },
        { status: 401 }
      );
    }

    // Successful login — clear failed attempts (Req 17.7)
    await clearFailedAttempts(email);

    // Fetch user role from DaaS backend for redirect logic
    let role: string | null = null;
    try {
      const headers = await getAuthHeaders();
      const daasUrl = getDaasUrl();

      const response = await fetch(`${daasUrl}/api/users/me`, {
        headers,
        cache: 'no-store',
      });

      if (response.ok) {
        const userData = await response.json();
        const user = userData.data || userData;
        // DaaS returns role as an object or string
        if (user.role) {
          role = typeof user.role === 'object' ? user.role.name : user.role;
        }
        // Also check roles array
        if (!role && user.roles && user.roles.length > 0) {
          const firstRole = user.roles[0];
          role = typeof firstRole === 'object' ? firstRole.name : firstRole;
        }
      }
    } catch {
      // DaaS not available — role will be null, client can handle fallback
    }

    return NextResponse.json({
      data: {
        user: {
          id: data.user.id,
          email: data.user.email,
          role,
        },
        session: {
          access_token: data.session?.access_token,
          expires_at: data.session?.expires_at,
        },
      },
    });
  } catch {
    // Generic error for unexpected failures
    return NextResponse.json(
      { errors: [{ message: GENERIC_AUTH_ERROR }] },
      { status: 500 }
    );
  }
}
