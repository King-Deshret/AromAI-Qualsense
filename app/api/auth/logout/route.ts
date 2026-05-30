import { NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase';
import { getServerSession } from '@/lib/auth';
import { writeAuditLog } from '@/lib/audit';
import { getClientIp } from '@/lib/utils';

export async function POST(request: NextRequest) {
  const user = await getServerSession();
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();

  if (user) {
    await writeAuditLog({
      actor_id: user.id,
      action_type: 'LOGOUT',
      target_type: 'users',
      target_id: user.id,
      ip_address: getClientIp(request),
    });
  }

  return Response.json({ message: 'Logged out' });
}
