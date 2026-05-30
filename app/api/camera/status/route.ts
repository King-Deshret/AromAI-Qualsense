import { getServerSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { makeApiError } from '@/lib/utils';

export async function GET() {
  const user = await getServerSession();
  if (!user) return makeApiError(401, 'UNAUTHORIZED', 'Unauthenticated');

  const { data: config } = await supabaseAdmin.from('system_config').select('ai_service_status, camera_url').single();
  return Response.json({ status: config?.ai_service_status ?? 'UNKNOWN', camera_url: config?.camera_url });
}
