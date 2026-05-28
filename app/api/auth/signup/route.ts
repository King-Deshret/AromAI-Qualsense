/**
 * Auth Signup API Route
 *
 * Flow per diagram:
 * 1. Check admin slot availability (count users with admin role)
 * 2. If admin slots available → allow Admin/Manager/Operator role choice
 * 3. If admin slots full → only Manager/Operator
 * 4. Create user with email_confirm: false → Supabase sends verification email
 * 5. Store role in user_metadata for login redirect
 *
 * GET  /api/auth/signup  — Check admin slot availability
 * POST /api/auth/signup  — Create new user account
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { getDaasUrl } from '@/lib/api/auth-headers';

const ROLE_IDS: Record<string, string> = {
  operator: '36d2468d-c436-45c9-9576-7c489ad8ee15',
  qc_manager: 'ac071131-8041-4aac-9dcc-152fda9afec8',
  admin: '23c23016-1986-4f03-a62d-1d45bf5a991d',
};

/** Max number of admin accounts allowed */
const MAX_ADMIN_SLOTS = 3;

/**
 * GET /api/auth/signup
 * Returns whether admin role is available for signup.
 */
export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ adminAvailable: false });
    }

    const daasUrl = getDaasUrl();
    const headers = {
      'Authorization': `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
    };

    // Count users with admin role in DaaS
    const res = await fetch(
      `${daasUrl}/api/user_roles?filter[role_id][_eq]=${ROLE_IDS.admin}&meta=total_count&limit=0`,
      { headers, cache: 'no-store' }
    );

    if (res.ok) {
      const data = await res.json();
      const adminCount = data.meta?.total_count ?? 0;
      return NextResponse.json({ adminAvailable: adminCount < MAX_ADMIN_SLOTS });
    }

    return NextResponse.json({ adminAvailable: false });
  } catch {
    return NextResponse.json({ adminAvailable: false });
  }
}

/**
 * POST /api/auth/signup
 * Creates a new user. Sends email verification automatically.
 */
export async function POST(request: NextRequest) {
  try {
    const { email, password, firstName, lastName, role } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { errors: [{ message: 'Email dan password wajib diisi.' }] },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { errors: [{ message: 'Password minimal 6 karakter.' }] },
        { status: 400 }
      );
    }

    const validRoles = ['operator', 'qc_manager', 'admin'];
    const selectedRole = validRoles.includes(role) ? role : 'operator';

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { errors: [{ message: 'Server configuration error.' }] },
        { status: 500 }
      );
    }

    // If admin role requested, verify slot is still available
    if (selectedRole === 'admin') {
      const daasUrl = getDaasUrl();
      const daasHeaders = {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
      };
      try {
        const countRes = await fetch(
          `${daasUrl}/api/user_roles?filter[role_id][_eq]=${ROLE_IDS.admin}&meta=total_count&limit=0`,
          { headers: daasHeaders, cache: 'no-store' }
        );
        if (countRes.ok) {
          const countData = await countRes.json();
          const adminCount = countData.meta?.total_count ?? 0;
          if (adminCount >= MAX_ADMIN_SLOTS) {
            return NextResponse.json(
              { errors: [{ message: 'Slot admin sudah penuh. Pilih role Manager atau Operator.' }] },
              { status: 409 }
            );
          }
        }
      } catch {
        // If check fails, deny admin signup for safety
        return NextResponse.json(
          { errors: [{ message: 'Tidak dapat memverifikasi slot admin. Coba lagi.' }] },
          { status: 500 }
        );
      }
    }

    const adminClient = createAdminClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Create user — email_confirm: false so Supabase sends verification email
    const { data: createData, error: createError } = await adminClient.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password,
      email_confirm: false, // Require email verification
      user_metadata: {
        first_name: firstName?.trim() || '',
        last_name: lastName?.trim() || '',
        role: selectedRole, // Store role in metadata for login redirect
      },
    });

    if (createError) {
      if (
        createError.message.includes('already been registered') ||
        createError.message.includes('already exists')
      ) {
        return NextResponse.json(
          { errors: [{ message: 'Email sudah terdaftar. Silakan login.' }] },
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
        { errors: [{ message: 'Gagal membuat akun.' }] },
        { status: 500 }
      );
    }

    // Create user in DaaS and assign role
    try {
      const daasUrl = getDaasUrl();
      const daasHeaders = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceRoleKey}`,
      };

      await fetch(`${daasUrl}/api/users`, {
        method: 'POST',
        headers: daasHeaders,
        body: JSON.stringify({
          id: createData.user.id,
          email: createData.user.email,
          first_name: firstName?.trim() || null,
          last_name: lastName?.trim() || null,
          status: 'active',
          provider: 'default',
        }),
      });

      if (ROLE_IDS[selectedRole]) {
        await fetch(`${daasUrl}/api/users/${createData.user.id}`, {
          method: 'PATCH',
          headers: daasHeaders,
          body: JSON.stringify({ add_roles: [ROLE_IDS[selectedRole]] }),
        });
      }
    } catch {
      console.error('Failed to sync new user to DaaS');
    }

    return NextResponse.json({
      data: {
        message: 'Akun berhasil dibuat. Cek email kamu untuk verifikasi.',
        requiresVerification: true,
      },
    });
  } catch (err) {
    console.error('Signup error:', err);
    return NextResponse.json(
      { errors: [{ message: 'Gagal membuat akun. Coba lagi.' }] },
      { status: 500 }
    );
  }
}
