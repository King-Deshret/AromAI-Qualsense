/**
 * Auth Signup API Route
 *
 * Creates a new user account via Supabase Auth and assigns the OPERATOR role
 * in DaaS. All new signups default to OPERATOR role.
 */

import { NextRequest, NextResponse } from 'next/server';
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

    const supabase = await createClient();

    // Create user in Supabase Auth
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: firstName || '',
          last_name: lastName || '',
        },
      },
    });

    if (error) {
      // Handle common errors
      if (error.message.includes('already registered')) {
        return NextResponse.json(
          { errors: [{ message: 'An account with this email already exists' }] },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { errors: [{ message: error.message }] },
        { status: 400 }
      );
    }

    if (!data.user) {
      return NextResponse.json(
        { errors: [{ message: 'Failed to create account' }] },
        { status: 500 }
      );
    }

    // Create user in DaaS and assign operator role
    try {
      const daasUrl = getDaasUrl();
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (serviceRoleKey) {
        // Use service role to create the DaaS user record
        const headers = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceRoleKey}`,
        };

        // Create user in DaaS
        await fetch(`${daasUrl}/api/users`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            id: data.user.id,
            email: data.user.email,
            first_name: firstName || null,
            last_name: lastName || null,
            status: 'active',
            provider: 'default',
          }),
        });

        // Assign operator role
        await fetch(`${daasUrl}/api/users/${data.user.id}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({
            add_roles: [OPERATOR_ROLE_ID],
          }),
        });
      }
    } catch {
      // DaaS user creation failed — user can still log in, role will be null
      console.error('Failed to create DaaS user record');
    }

    // Sign in the user immediately after signup
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      // Account created but auto-login failed — user can log in manually
      return NextResponse.json({
        data: { message: 'Account created. Please log in.' },
      });
    }

    return NextResponse.json({
      data: {
        user: {
          id: data.user.id,
          email: data.user.email,
          role: 'operator',
        },
        message: 'Account created successfully',
      },
    });
  } catch {
    return NextResponse.json(
      { errors: [{ message: 'Failed to create account' }] },
      { status: 500 }
    );
  }
}
