import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

// Mock the supabase middleware
const mockUpdateSession = vi.fn();
vi.mock('@/lib/supabase/middleware', () => ({
  updateSession: (...args: unknown[]) => mockUpdateSession(...args),
}));

describe('HTTPS enforcement middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.unstubAllEnvs();
    mockUpdateSession.mockResolvedValue(NextResponse.next());
  });

  it('redirects HTTP to HTTPS with 301 in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');

    const { middleware } = await import('../middleware');

    const request = new NextRequest('http://example.com/dashboard', {
      headers: {
        'x-forwarded-proto': 'http',
      },
    });

    const response = await middleware(request);

    expect(response.status).toBe(301);
    const location = response.headers.get('location');
    expect(location).toContain('https://');
    expect(location).toContain('/dashboard');
  });

  it('does not redirect HTTPS requests in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');

    const { middleware } = await import('../middleware');

    const request = new NextRequest('https://example.com/dashboard', {
      headers: {
        'x-forwarded-proto': 'https',
      },
    });

    await middleware(request);

    // Should proceed to updateSession instead of redirecting
    expect(mockUpdateSession).toHaveBeenCalledWith(request);
  });

  it('does not redirect in development even with HTTP', async () => {
    vi.stubEnv('NODE_ENV', 'development');

    const { middleware } = await import('../middleware');

    const request = new NextRequest('http://localhost:3000/dashboard', {
      headers: {
        'x-forwarded-proto': 'http',
      },
    });

    await middleware(request);

    // Should proceed to updateSession without redirect
    expect(mockUpdateSession).toHaveBeenCalledWith(request);
  });

  it('preserves the full URL path and query params on redirect', async () => {
    vi.stubEnv('NODE_ENV', 'production');

    const { middleware } = await import('../middleware');

    const request = new NextRequest('http://example.com/lots/123?tab=details', {
      headers: {
        'x-forwarded-proto': 'http',
      },
    });

    const response = await middleware(request);

    expect(response.status).toBe(301);
    const location = response.headers.get('location');
    expect(location).toContain('https://');
    expect(location).toContain('/lots/123');
    expect(location).toContain('tab=details');
  });

  it('does not redirect when x-forwarded-proto header is absent in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');

    const { middleware } = await import('../middleware');

    const request = new NextRequest('https://example.com/dashboard');

    await middleware(request);

    // No x-forwarded-proto header means we can't determine protocol from proxy
    // Should proceed to updateSession
    expect(mockUpdateSession).toHaveBeenCalledWith(request);
  });
});
