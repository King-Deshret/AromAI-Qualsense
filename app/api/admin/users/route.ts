/**
 * Admin Users API Route
 *
 * Provides admin-level user management via Supabase Admin API + DaaS.
 * Uses service role key to bypass RLS for listing/creating/updating users.
 *
 * GET  /api/admin/users        — List all users with role info
 * POST /api/admin/users        — Create a new user (admin-initiated, no auto-login)
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

/** Reverse map: role ID → role name */
const ROLE_ID_TO_NAME: Record<string, string> = Object.fromEntries(
  Object.entries(ROLE_IDS).map(([name, id]) => [id, name])
);

/**
 * Verify the requesting user is an admin.
 * Returns the Supabase user or null if not authenticated/authorized.
 */
async function requireAdmin(): Promise<{ id: string; email: string | undefined } | null> {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return null;

    // Use service role key to look up the user's roles in DaaS
    // (the user's own JWT doesn't include role info in /api/users/me response)
    const daasUrl = getDaasUrl();
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) return null;

    const headers = {
      'Authorization': `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
    };

    // Fetch user's role assignments from DaaS using service role
    const userRes = await fetch(
      `${daasUrl}/api/users/${user.id}?fields[]=id&fields[]=roles`,
      { headers, cache: 'no-store' }
    );

    if (userRes.ok) {
      const userData = await userRes.json();
      const daasUser = userData.data || userData;
      const roles: Array<{ id?: string; role?: { id?: string } }> = daasUser.roles || [];
      const isAdmin = roles.some((r) => {
        const roleId = r.id || r.role?.id;
        return roleId === ROLE_IDS.admin;
      });
      if (isAdmin) return { id: user.id, email: user.email };
    }

    // Fallback: check via user_roles junction
    const rolesRes = await fetch(
      `${daasUrl}/api/user_roles?filter[user_id][_eq]=${user.id}&filter[role_id][_eq]=${ROLE_IDS.admin}&limit=1`,
      { headers, cache: 'no-store' }
    );
    if (rolesRes.ok) {
      const rolesData = await rolesRes.json();
      const entries = rolesData.data || rolesData;
      if (Array.isArray(entries) && entries.length > 0) {
        return { id: user.id, email: user.email };
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * GET /api/admin/users
 *
 * Lists all users from Supabase admin API, enriched with DaaS role info.
 */
export async function GET() {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json(
        { errors: [{ message: 'Admin access required' }] },
        { status: 403 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { errors: [{ message: 'Server configuration error' }] },
        { status: 500 }
      );
    }

    const adminClient = createAdminClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // List all users from Supabase
    const { data: listData, error: listError } = await adminClient.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });

    if (listError) {
      return NextResponse.json(
        { errors: [{ message: listError.message }] },
        { status: 500 }
      );
    }

    const supabaseUsers = listData?.users ?? [];

    // Fetch DaaS user records to get role assignments
    const daasUrl = getDaasUrl();
    const daasHeaders = {
      'Authorization': `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
    };

    let daasUserMap: Record<string, { first_name?: string; last_name?: string; roles?: Array<{ id?: string; role?: { id?: string } }> }> = {};
    try {
      const daasRes = await fetch(
        `${daasUrl}/api/users?limit=1000&fields[]=id&fields[]=first_name&fields[]=last_name&fields[]=roles`,
        { headers: daasHeaders, cache: 'no-store' }
      );
      if (daasRes.ok) {
        const daasData = await daasRes.json();
        const daasUsers: Array<{ id: string; first_name?: string; last_name?: string; roles?: Array<{ id?: string; role?: { id?: string } }> }> = Array.isArray(daasData.data) ? daasData.data : [];
        daasUserMap = Object.fromEntries(daasUsers.map((u) => [u.id, u]));
      }
    } catch {
      // DaaS unavailable — proceed without role info
    }

    // Merge Supabase users with DaaS role info
    const users = supabaseUsers.map((u) => {
      const daasUser = daasUserMap[u.id];
      const roles: Array<{ id?: string; role?: { id?: string } }> = daasUser?.roles ?? [];

      // Find the highest-priority role
      let roleName: string | null = null;
      for (const r of roles) {
        const roleId = r.id || r.role?.id;
        if (roleId && ROLE_ID_TO_NAME[roleId]) {
          roleName = ROLE_ID_TO_NAME[roleId];
          break;
        }
      }

      return {
        id: u.id,
        email: u.email ?? '',
        first_name: daasUser?.first_name ?? u.user_metadata?.first_name ?? null,
        last_name: daasUser?.last_name ?? u.user_metadata?.last_name ?? null,
        role: roleName,
        status: u.banned_until ? 'suspended' : (u.confirmed_at ? 'active' : 'invited'),
      };
    });

    return NextResponse.json({ data: users });
  } catch (err) {
    console.error('Admin users GET error:', err);
    return NextResponse.json(
      { errors: [{ message: 'Failed to list users' }] },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/users
 *
 * Creates a new user (admin-initiated). Does NOT auto-login the new user.
 * Body: { email, first_name, role, password? }
 */
export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json(
        { errors: [{ message: 'Admin access required' }] },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { email, first_name, role } = body as {
      email?: string;
      first_name?: string;
      role?: string;
    };

    if (!email || !email.trim()) {
      return NextResponse.json(
        { errors: [{ message: 'Email is required' }] },
        { status: 400 }
      );
    }

    if (!role || !ROLE_IDS[role]) {
      return NextResponse.json(
        { errors: [{ message: 'Valid role is required' }] },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { errors: [{ message: 'Server configuration error' }] },
        { status: 500 }
      );
    }

    const adminClient = createAdminClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Generate a temporary password if none provided
    const tempPassword = body.password || `Temp${Math.random().toString(36).slice(2, 10)}!`;

    const { data: createData, error: createError } = await adminClient.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        first_name: first_name?.trim() || '',
      },
    });

    if (createError) {
      if (
        createError.message.includes('already been registered') ||
        createError.message.includes('already exists')
      ) {
        return NextResponse.json(
          { errors: [{ message: 'A user with this email already exists', extensions: { code: 'RECORD_NOT_UNIQUE', field: 'email' } }] },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { errors: [{ message: createError.message }] },
        { status: 400 }
      );
    }

    if (!createData.user) {
      return NextResponse.json(
        { errors: [{ message: 'Failed to create user' }] },
        { status: 500 }
      );
    }

    const daasUrl = getDaasUrl();
    const daasHeaders = {
      'Authorization': `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
    };

    // Create user record in DaaS
    try {
      await fetch(`${daasUrl}/api/users`, {
        method: 'POST',
        headers: daasHeaders,
        body: JSON.stringify({
          id: createData.user.id,
          email: createData.user.email,
          first_name: first_name?.trim() || null,
          status: 'active',
          provider: 'default',
        }),
      });

      // Assign the selected role
      await fetch(`${daasUrl}/api/users/${createData.user.id}`, {
        method: 'PATCH',
        headers: daasHeaders,
        body: JSON.stringify({ add_roles: [ROLE_IDS[role]] }),
      });
    } catch {
      // DaaS sync failed — user created in Supabase but role not assigned
      console.error('Failed to sync new user to DaaS');
    }

    return NextResponse.json({
      data: {
        id: createData.user.id,
        email: createData.user.email,
        first_name: first_name?.trim() || null,
        role,
        status: 'active',
      },
    });
  } catch (err) {
    console.error('Admin users POST error:', err);
    return NextResponse.json(
      { errors: [{ message: 'Failed to create user' }] },
      { status: 500 }
    );
  }
}
