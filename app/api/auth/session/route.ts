/**
 * Auth Session API Route
 *
 * Returns the current user's session information including role.
 * Used by the frontend to determine authentication state and role-based routing.
 *
 * Pattern: Browser → Next.js API Route → Supabase Auth + DaaS Backend (server-side)
 *
 * Role Change Immediate Enforcement (Requirement 9.6):
 * This route fetches the user's role from DaaS on EVERY call (no caching).
 * When an Admin changes a user's role, the new role is returned on the very
 * next GET /api/auth/session request without requiring re-authentication.
 * The DaaS backend also evaluates permissions based on the user's current role
 * at request time (via the JWT → DaaS permission system), so all proxy routes
 * (/api/items/*, /api/permissions/me, etc.) enforce updated permissions immediately.
 *
 * Requirements: 17.1, 17.4, 17.6, 17.8, 9.6
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuthHeaders, getDaasUrl } from '@/lib/api/auth-headers';

/**
 * GET /api/auth/session
 *
 * Returns the current authenticated user's session info including role.
 * Returns 401 if no valid session exists or if the user has been deactivated.
 *
 * Session invalidation on deactivation (Requirement 17.8):
 * When a user's is_active status is set to false (status != 'active'),
 * this route returns 401 on the next request, causing the frontend to
 * redirect to the login page.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { errors: [{ message: 'Authentication required' }] },
        { status: 401 }
      );
    }

    // Get session expiry info
    const { data: { session } } = await supabase.auth.getSession();

    // Fetch user role and status from DaaS backend
    let role: string | null = null;
    let firstName: string | null = null;
    let lastName: string | null = null;
    let userStatus: string | null = null;

    try {
      const headers = await getAuthHeaders();
      const daasUrl = getDaasUrl();

      const response = await fetch(`${daasUrl}/api/users/me`, {
        headers,
        cache: 'no-store',
      });

      if (response.ok) {
        const userData = await response.json();
        const daasUser = userData.data || userData;

        // Extract user status for deactivation check (Requirement 17.8)
        userStatus = daasUser.status || null;

        // Extract role
        if (daasUser.role) {
          role = typeof daasUser.role === 'object' ? daasUser.role.name : daasUser.role;
        }
        if (!role && daasUser.roles && daasUser.roles.length > 0) {
          const firstRole = daasUser.roles[0];
          role = typeof firstRole === 'object' ? firstRole.name : firstRole;
        }

        firstName = daasUser.first_name || null;
        lastName = daasUser.last_name || null;
      }
    } catch {
      // DaaS not available — return basic session info without status check
    }

    // Check if user has been deactivated (Requirement 17.8)
    // If user status is suspended or terminated, invalidate the session
    if (userStatus && userStatus !== 'active') {
      // Sign out the user from Supabase to clear their session cookies
      await supabase.auth.signOut();

      return NextResponse.json(
        { errors: [{ message: 'Authentication required' }] },
        { status: 401 }
      );
    }

    return NextResponse.json({
      data: {
        user: {
          id: user.id,
          email: user.email,
          first_name: firstName || user.user_metadata?.first_name || null,
          last_name: lastName || user.user_metadata?.last_name || null,
          role,
        },
        session: {
          expires_at: session?.expires_at || null,
        },
      },
    });
  } catch {
    return NextResponse.json(
      { errors: [{ message: 'Failed to get session' }] },
      { status: 500 }
    );
  }
}
