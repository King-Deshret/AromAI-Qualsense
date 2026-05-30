import { getServerSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { makeApiError } from '@/lib/utils';

export async function GET() {
  const user = await getServerSession();
  if (!user) return makeApiError(401, 'UNAUTHORIZED', 'Unauthenticated');
  if (user.role !== 'Admin') return makeApiError(403, 'FORBIDDEN', 'Admin only');

  const { data, error } = await supabaseAdmin
    .from('lots')
    .select(`
      *,
      operator:operator_id(id, name),
      inspection_sessions!inner(id, started_at, status)
    `)
    .eq('status', 'INSPECTION_RUNNING')
    .order('created_at', { ascending: false });

  if (error) return makeApiError(500, 'INTERNAL_ERROR', error.message);
  return Response.json({ data: data ?? [] });
}
