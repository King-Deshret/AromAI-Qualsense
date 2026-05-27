/**
 * Supabase Server Client
 *
 * Server-side Supabase client for use in Server Components, API routes, and Server Actions.
 * Configured with 8-hour session duration (Requirement 17.6).
 *
 * Pattern: All auth operations go through this server client — never expose
 * Supabase directly to the browser.
 */

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/** Session duration: 8 hours in seconds (Requirement 17.6) */
const SESSION_DURATION_SECONDS = 8 * 60 * 60; // 28800 seconds

export async function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing Supabase environment variables. ' +
      'Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local'
    );
  }

  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, {
              ...options,
              // Enforce 8-hour session duration via cookie maxAge
              maxAge: SESSION_DURATION_SECONDS,
              httpOnly: true,
              secure: process.env.NODE_ENV === 'production',
              sameSite: 'lax',
              path: '/',
            })
          );
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing
          // user sessions.
        }
      },
    },
  });
}
