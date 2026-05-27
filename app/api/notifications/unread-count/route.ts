import { NextResponse } from 'next/server';
import { getAuthHeaders, getDaasUrl } from '@/lib/api/auth-headers';

/**
 * GET /api/notifications/unread-count
 *
 * Returns the count of unread notifications for the current authenticated user.
 * Uses DaaS aggregate endpoint with filter on is_read = false.
 * DaaS permissions automatically scope notifications to user_id = $CURRENT_USER.
 *
 * Validates: Requirement 13.7
 */
export async function GET() {
  try {
    const headers = await getAuthHeaders();
    const daasUrl = getDaasUrl();

    // Use DaaS aggregate endpoint to count unread notifications
    const response = await fetch(
      `${daasUrl}/api/items/notifications?aggregate[count]=id&filter[is_read][_eq]=false`,
      { headers, cache: 'no-store' }
    );

    if (!response.ok) {
      return NextResponse.json({ data: { count: 0 } });
    }

    const result = await response.json();
    // DaaS aggregate returns: { data: [{ count: { id: "5" } }] }
    const count = parseInt(result.data?.[0]?.count?.id || '0', 10);

    return NextResponse.json({ data: { count } });
  } catch {
    return NextResponse.json({ data: { count: 0 } });
  }
}
