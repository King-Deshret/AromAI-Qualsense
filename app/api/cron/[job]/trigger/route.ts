import { NextRequest } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { makeApiError, getClientIp } from '@/lib/utils';
import { writeAuditLog } from '@/lib/audit';
import { runJob } from '@/lib/cron-jobs';

export async function POST(request: NextRequest, { params }: { params: Promise<{ job: string }> }) {
  const user = await getServerSession();
  if (!user) return makeApiError(401, 'UNAUTHORIZED', 'Unauthenticated');
  if (user.role !== 'Admin') return makeApiError(403, 'FORBIDDEN', 'Admin only');

  const { job } = await params;

  try {
    await runJob(job);
    await writeAuditLog({
      actor_id: user.id,
      action_type: 'CRON_TRIGGERED',
      target_type: 'cron',
      target_id: job,
      ip_address: getClientIp(request),
    });
    return Response.json({ ok: true, job });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return makeApiError(500, 'INTERNAL_ERROR', `CRON job ${job} failed: ${msg}`);
  }
}
