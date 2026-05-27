/**
 * Login Lockout Module
 *
 * Implements account lockout after consecutive failed login attempts.
 * Tracks attempts via the DaaS `login_attempts` collection.
 *
 * Rules:
 * - 5 failed attempts within a 15-minute window triggers lockout
 * - Lockout lasts 15 minutes from the most recent failed attempt
 * - Successful login clears the failure history for that email
 * - Returns HTTP 429 during lockout period
 *
 * Requirements: 17.7
 */

import { getDaasUrl } from '@/lib/api/auth-headers';

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_WINDOW_MINUTES = 15;

interface LoginAttempt {
  id: string;
  email: string;
  attempted_at: string;
  success: boolean;
}

/**
 * Get the DaaS admin headers for login_attempts collection access.
 * Uses the service role key since login attempts happen before authentication.
 */
function getServiceHeaders(): Record<string, string> {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${serviceRoleKey}`,
  };
}

/**
 * Check if an email is currently locked out due to too many failed attempts.
 *
 * @returns Object with `locked` boolean and `retryAfter` (seconds until lockout expires) if locked
 */
export async function checkLockout(email: string): Promise<{
  locked: boolean;
  retryAfter?: number;
  message?: string;
}> {
  try {
    const daasUrl = getDaasUrl();
    const normalizedEmail = email.toLowerCase().trim();
    const windowStart = new Date(
      Date.now() - LOCKOUT_WINDOW_MINUTES * 60 * 1000
    ).toISOString();

    // Query failed attempts within the lockout window
    const filter = JSON.stringify({
      _and: [
        { email: { _eq: normalizedEmail } },
        { success: { _eq: false } },
        { attempted_at: { _gte: windowStart } },
      ],
    });

    const params = new URLSearchParams({
      'filter': filter,
      'sort': '-attempted_at',
      'limit': String(MAX_FAILED_ATTEMPTS),
    });

    const response = await fetch(
      `${daasUrl}/api/items/login_attempts?${params.toString()}`,
      {
        headers: getServiceHeaders(),
        cache: 'no-store',
      }
    );

    if (!response.ok) {
      // If we can't check lockout status, allow login attempt (fail open)
      return { locked: false };
    }

    const result = await response.json();
    const attempts: LoginAttempt[] = result.data || [];

    if (attempts.length >= MAX_FAILED_ATTEMPTS) {
      // Account is locked — calculate when lockout expires
      const mostRecentAttempt = new Date(attempts[0].attempted_at);
      const lockoutExpires = new Date(
        mostRecentAttempt.getTime() + LOCKOUT_WINDOW_MINUTES * 60 * 1000
      );
      const now = new Date();
      const retryAfterSeconds = Math.ceil(
        (lockoutExpires.getTime() - now.getTime()) / 1000
      );

      if (retryAfterSeconds > 0) {
        return {
          locked: true,
          retryAfter: retryAfterSeconds,
          message:
            'Account temporarily locked due to too many failed login attempts. Please try again later.',
        };
      }
    }

    return { locked: false };
  } catch {
    // On error, fail open — allow login attempt
    return { locked: false };
  }
}

/**
 * Record a login attempt (success or failure).
 */
export async function recordLoginAttempt(
  email: string,
  success: boolean
): Promise<void> {
  try {
    const daasUrl = getDaasUrl();
    const normalizedEmail = email.toLowerCase().trim();

    await fetch(`${daasUrl}/api/items/login_attempts`, {
      method: 'POST',
      headers: getServiceHeaders(),
      body: JSON.stringify({
        email: normalizedEmail,
        attempted_at: new Date().toISOString(),
        success,
      }),
    });
  } catch {
    // Non-critical — don't block login flow if recording fails
  }
}

/**
 * Clear failed login attempts for an email after successful login.
 * Deletes all failed attempt records for the email to reset the counter.
 */
export async function clearFailedAttempts(email: string): Promise<void> {
  try {
    const daasUrl = getDaasUrl();
    const normalizedEmail = email.toLowerCase().trim();

    // Find all failed attempts for this email
    const filter = JSON.stringify({
      _and: [
        { email: { _eq: normalizedEmail } },
        { success: { _eq: false } },
      ],
    });

    const params = new URLSearchParams({
      'filter': filter,
      'fields': 'id',
      'limit': '100',
    });

    const response = await fetch(
      `${daasUrl}/api/items/login_attempts?${params.toString()}`,
      {
        headers: getServiceHeaders(),
        cache: 'no-store',
      }
    );

    if (!response.ok) return;

    const result = await response.json();
    const attempts: { id: string }[] = result.data || [];

    if (attempts.length === 0) return;

    // Delete failed attempts in batch
    const ids = attempts.map((a) => a.id);
    await fetch(`${daasUrl}/api/items/login_attempts`, {
      method: 'DELETE',
      headers: getServiceHeaders(),
      body: JSON.stringify(ids),
    });
  } catch {
    // Non-critical — don't block login flow
  }
}

// Export constants for testing
export const LOCKOUT_CONFIG = {
  MAX_FAILED_ATTEMPTS,
  LOCKOUT_WINDOW_MINUTES,
} as const;
