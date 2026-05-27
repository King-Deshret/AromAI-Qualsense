/**
 * @buildpad-origin @buildpad/cli/supabase-auth/middleware
 * @buildpad-version 1.0.0
 *
 * This file was copied from Buildpad UI Packages.
 * To update, run: npx @buildpad/cli add supabase-auth/middleware --overwrite
 *
 * Docs: https://buildpad.dev/components/supabase-auth/middleware
 */

/**
 * Next.js Middleware
 *
 * Root middleware file that handles:
 * 1. HTTPS enforcement in production (HTTP → HTTPS 301 redirect) (Requirement 18.3)
 * 2. Auth session refresh
 *
 * @buildpad/origin: middleware
 * @buildpad/version: 1.0.0
 */

import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  // HTTPS enforcement: redirect HTTP → HTTPS in production (Requirement 18.3)
  if (process.env.NODE_ENV === 'production') {
    const proto = request.headers.get('x-forwarded-proto');
    if (proto === 'http') {
      const httpsUrl = new URL(request.url);
      httpsUrl.protocol = 'https:';
      return NextResponse.redirect(httpsUrl.toString(), 301);
    }
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
