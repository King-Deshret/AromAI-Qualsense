/**
 * Auth Signup API Route
 *
 * Creates a new user account via Supabase Admin API (bypasses email confirmation)
 * and assigns the OPERATOR role in DaaS. All new signups default to OPERATOR role.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { getDaasUrl } from '@/lib/api/auth-headers';

// The operator role ID from DaaS
const OPERATOR_ROLE_ID = '36d2468d-c436-45c9-9576-7c489ad8ee15';

export async function POST(request: NextRequest) {
  try {
    const { email, password, firstName, lastName } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { errors: [{ message: 'Email and password are required' }] },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { errors: [{ message: 'Password must be at least 6 characters' }] },
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

    // Use admin client to create user (bypasses email confirmation)
    const adminClient = createAdminClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: createData, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        first_name: firstName || '',
        last_name: lastName || '',
      },
    });

    if (createError) {
      if (createError.message.includes('already been registered') || createError.message.includes('already exists')) {
        return NextResponse.json(
          { errors: [{ message: 'An account with this email already exists. Please sign in.' }] },
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
        { errors: [{ message: 'Failed to create account' }] },
        { status: 500 }
      );
    }

    // Create user in DaaS and assign operator role
    try {
      const daasUrl = getDaasUrl();
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceRoleKey}`,
      };

      // Create user in DaaS
      await fetch(`${daasUrl}/api/users`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          id: createData.user.id,
          email: createData.user.email,
          first_name: firstName || null,
          last_name: lastName || null,
          status: 'active',
          provider: 'default',
        }),
      });

      // Assign operator role
      await fetch(`${daasUrl}/api/users/${createData.user.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          add_roles: [OPERATOR_ROLE_ID],
        }),
      });
    } catch {
      // DaaS user creation failed — user can still log in
      console.error('Failed to create DaaS user record');
    }

    // Sign in the user immediately after signup
    const supabase = await createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      return NextResponse.json({
        data: { message: 'Account created. Please sign in.' },
      });
    }

    return NextResponse.json({
      data: {
        user: {
          id: createData.user.id,
          email: createData.user.email,
          role: 'operator',
        },
        message: 'Account created successfully',
      },
    });
  } catch (err) {
    console.error('Signup error:', err);
    return NextResponse.json(
      { errors: [{ message: 'Failed to create account. Please try again.' }] },
      { status: 500 }
    );
  }
}
