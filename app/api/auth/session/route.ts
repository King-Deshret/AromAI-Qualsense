import { getServerSession } from '@/lib/auth';
import { makeApiError } from '@/lib/utils';

export async function GET() {
  const user = await getServerSession();
  if (!user) {
    return makeApiError(401, 'UNAUTHORIZED', 'No active session');
  }
  return Response.json({ user });
}
