/**
 * DaaS Activity Log Proxy Route
 *
 * Proxies GET /api/activity to the DaaS backend activity endpoint.
 * Used by the Audit Log page to display system activity entries.
 *
 * Requirements: 10.3
 */

import { type NextRequest, NextResponse } from 'next/server';
import { getAuthHeaders, getDaaSUrl } from '@/lib/api/auth-headers';

export async function GET(request: NextRequest) {
  try {
    const daasUrl = getDaaSUrl();
    const headers = await getAuthHeaders();
    const searchParams = request.nextUrl.searchParams.toString();
    const url = `${daasUrl}/api/activity${searchParams ? `?${searchParams}` : ''}`;

    const response = await fetch(url, {
      method: 'GET',
      headers,
      cache: 'no-store',
    });

    const text = await response.text();

    if (!response.ok) {
      return NextResponse.json(
        { errors: [{ message: `Activity log error: ${response.status}` }] },
        { status: response.status }
      );
    }

    try {
      const data = JSON.parse(text);
      return NextResponse.json(data);
    } catch {
      return NextResponse.json(
        { errors: [{ message: 'Invalid response from activity log' }] },
        { status: 502 }
      );
    }
  } catch (err) {
    return NextResponse.json(
      { errors: [{ message: err instanceof Error ? err.message : 'Failed to fetch activity log' }] },
      { status: 500 }
    );
  }
}
