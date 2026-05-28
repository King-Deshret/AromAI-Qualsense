/**
 * Admin Users by ID API Route
 *
 * PATCH /api/admin/users/[id] — Update user name, role, and/or status
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { getDaasUrl } from '@/lib/api/auth-headers';

/** Role ID constants */
const ROLE_IDS: Record<string, string> = {
  operator: '36d2468d-c436-45c9-9576-7c489ad8ee15',
  qc_manager: 'ac071131-8041-4aac-9dcc-152fda9afec8',
  admin: '23c23016-1986-4f03-a62d-1d45bf5a991d',
};

type Params = { params: Promise<{ id: string }> };

/**
 * PATCH /api/admin/users/[id]
 *
 * Updates user name, role, and/or status.
 * Body: { first_name?, role?, status? }
 */
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;

    // Verify admin access
    const supabase = await createClient();
    const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser();
    if (authError || !currentUser) {
      return NextResponse.json(
        { errors: [{ message: 'Authentication required' }] },
        { status: 401 }
      );
    }

    const daasUrl = getDaasUrl();
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!serviceRoleKey) {
      return NextResponse.json(
        { errors: [{ message: 'Server configuration error' }] },
        { status: 500 }
      );
    }

    const daasServiceHeaders = {
      'Authorization': `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
    };

    // Verify admin role using service role key
    let isAdmin = false;
    try {
      const userRes = await fetch(
        `${daasUrl}/api/users/${currentUser.id}?fields[]=id&fields[]=roles`,
        { headers: daasServiceHeaders, cache: 'no-store' }
      );
      if (userRes.ok) {
        const userData = await userRes.json();
        const daasUser = userData.data || userData;
        const roles: Array<{ id?: string; role?: { id?: string } }> = daasUser.roles || [];
        isAdmin = roles.some((r) => {
          const roleId = r.id || r.role?.id;
          return roleId === ROLE_IDS.admin;
        });
      }
    } catch {
      // ignore
    }

    if (!isAdmin) {
      return NextResponse.json(
        { errors: [{ message: 'Admin access required' }] },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { first_name, role, status } = body as {
      first_name?: string;
      role?: string;
      status?: string;
    };

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

    if (!supabaseUrl) {
      return NextResponse.json(
        { errors: [{ message: 'Server configuration error' }] },
        { status: 500 }
      );
    }

    const adminClient = createAdminClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const daasHeaders = daasServiceHeaders;

    // Update Supabase user metadata if name changed
    if (first_name !== undefined) {
      const { error: updateError } = await adminClient.auth.admin.updateUserById(id, {
        user_metadata: { first_name: first_name.trim() },
      });
      if (updateError) {
        return NextResponse.json(
          { errors: [{ message: updateError.message }] },
          { status: 400 }
        );
      }
    }

    // Handle status change (ban/unban in Supabase)
    if (status !== undefined) {
      if (status === 'suspended') {
        // Ban user by setting ban_duration to a far future date
        await adminClient.auth.admin.updateUserById(id, {
          ban_duration: '876600h', // ~100 years
        });
      } else if (status === 'active') {
        // Unban user
        await adminClient.auth.admin.updateUserById(id, {
          ban_duration: 'none',
        });
      }
    }

    // Update DaaS user record
    const daasUpdateBody: Record<string, unknown> = {};
    if (first_name !== undefined) daasUpdateBody.first_name = first_name.trim();
    if (status !== undefined) daasUpdateBody.status = status;

    if (Object.keys(daasUpdateBody).length > 0) {
      try {
        await fetch(`${daasUrl}/api/users/${id}`, {
          method: 'PATCH',
          headers: daasHeaders,
          body: JSON.stringify(daasUpdateBody),
        });
      } catch {
        // DaaS sync failed — non-fatal
        console.error('Failed to sync user update to DaaS');
      }
    }

    // Handle role change in DaaS
    if (role !== undefined && ROLE_IDS[role]) {
      try {
        // Remove all existing app roles, then add the new one
        const allRoleIds = Object.values(ROLE_IDS);
        await fetch(`${daasUrl}/api/users/${id}`, {
          method: 'PATCH',
          headers: daasHeaders,
          body: JSON.stringify({
            remove_roles: allRoleIds,
            add_roles: [ROLE_IDS[role]],
          }),
        });
      } catch {
        console.error('Failed to update user role in DaaS');
      }
    }

    return NextResponse.json({ data: { id, first_name, role, status } });
  } catch (err) {
    console.error('Admin users PATCH error:', err);
    return NextResponse.json(
      { errors: [{ message: 'Failed to update user' }] },
      { status: 500 }
    );
  }
}
