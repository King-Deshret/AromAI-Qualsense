import { NextRequest } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { makeApiError, getClientIp } from '@/lib/utils';
import { writeAuditLog } from '@/lib/audit';

export async function POST(request: NextRequest) {
  const user = await getServerSession();
  if (!user) return makeApiError(401, 'UNAUTHORIZED', 'Unauthenticated');
  if (user.role !== 'Admin') return makeApiError(403, 'FORBIDDEN', 'Admin only');

  await writeAuditLog({
    actor_id: user.id,
    action_type: 'CAMERA_RESTARTED',
    target_type: 'system',
    target_id: 'camera-service',
    ip_address: getClientIp(request),
  });

  return Response.json({ ok: true, message: 'Camera Service restart triggered' });
}
