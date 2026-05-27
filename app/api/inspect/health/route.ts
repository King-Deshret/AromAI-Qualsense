/**
 * AI Health Check Proxy Route
 *
 * Proxies GET /api/inspect/health to the AI_Service GET /api/health.
 * Enforces configurable timeout from system_config.ai_timeout_seconds.
 * Returns structured error responses for timeout, unreachable, or non-200.
 * Requires authentication (session cookie validation).
 *
 * Requirements: 4.6, 4.7
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAiServiceConfig } from '@/lib/api/ai-service-config';

export async function GET() {
  try {
    // Authenticate: require valid session
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { errors: [{ message: 'Authentication required' }] },
        { status: 401 }
      );
    }

    const { aiServiceUrl, timeoutMs } = await getAiServiceConfig();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${aiServiceUrl}/api/health`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        let errorBody = '';
        try {
          errorBody = await response.text();
        } catch {
          // ignore read errors
        }
        return NextResponse.json(
          {
            errors: [
              {
                message: `AI service returned HTTP ${response.status}`,
                details: errorBody || undefined,
              },
            ],
          },
          { status: 502 }
        );
      }

      const data = await response.json();
      return NextResponse.json({ data });
    } catch (error: unknown) {
      clearTimeout(timeout);

      if (error instanceof Error && error.name === 'AbortError') {
        return NextResponse.json(
          {
            errors: [
              {
                message: `AI service timeout after ${timeoutMs}ms`,
              },
            ],
          },
          { status: 504 }
        );
      }

      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      return NextResponse.json(
        {
          errors: [
            {
              message: 'AI service unreachable',
              details: errorMessage,
            },
          ],
        },
        { status: 502 }
      );
    }
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        errors: [
          {
            message: 'Internal proxy error',
            details: errorMessage,
          },
        ],
      },
      { status: 500 }
    );
  }
}
