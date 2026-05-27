/**
 * AI Fruit Inspection Proxy Route
 *
 * Proxies POST /api/inspect/fruit to the AI_Service POST /api/inspect/fruit.
 * Enforces configurable timeout from system_config.ai_timeout_seconds.
 * Validates AI_Service TLS certificate (Node.js default behavior).
 * Returns structured error responses for timeout, unreachable, TLS failure, or non-200.
 * Requires authentication (session cookie validation).
 *
 * Requirements: 4.1, 4.4, 4.7, 18.4, 18.5
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAiServiceConfig } from '@/lib/api/ai-service-config';
import { isTlsError, getTlsErrorReason } from '@/lib/api/tls-error-handler';

export async function POST(request: NextRequest) {
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

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { errors: [{ message: 'Invalid JSON request body' }] },
        { status: 400 }
      );
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${aiServiceUrl}/api/inspect/fruit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
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

      // TLS certificate validation failures are treated as AI service errors
      // with standard retry mechanism (Requirements 18.4, 18.5)
      if (isTlsError(error)) {
        return NextResponse.json(
          {
            errors: [
              {
                message: 'AI service TLS certificate validation failed',
                details: getTlsErrorReason(error),
              },
            ],
          },
          { status: 502 }
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
