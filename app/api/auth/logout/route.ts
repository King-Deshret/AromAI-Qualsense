/**
 * Auth Logout API Route (Proxy)
 *
 * Proxies logout requests through the Next.js server.
 * Clears the Supabase session cookie server-side.
 *
 * Pattern: Browser → Next.js API Route → Supabase Auth (server-side)
 *
 * Requirements: 17.4
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/auth/logout
 *
 * Signs out the current user and clears session cookies.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signOut();

    if (error) {
      return NextResponse.json(
        { errors: [{ message: 'Failed to logout' }] },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: { message: 'Logged out successfully' },
    });
  } catch {
    return NextResponse.json(
      { errors: [{ message: 'Failed to logout' }] },
      { status: 500 }
    );
  }
}

/**
 * GET /api/auth/logout
 *
 * Browser-redirect logout. Signs out and redirects to /login.
 * Use as href for logout links.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();

    return NextResponse.redirect(new URL('/login', request.url));
  } catch {
    return NextResponse.redirect(new URL('/login', request.url));
  }
}
