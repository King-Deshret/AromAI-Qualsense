import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getServerSession } from '@/lib/auth';
import { makeApiError } from '@/lib/utils';

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getServerSession();
  if (!user) return makeApiError(401, 'UNAUTHORIZED', 'Unauthenticated');
  if (user.role === 'Operator') return makeApiError(403, 'FORBIDDEN', 'Access denied');

  const { id } = await params;

  // id can be either report id or lot_id
  const { data, error } = await supabaseAdmin
    .from('inspection_reports')
    .select('*')
    .or(`id.eq.${id},lot_id.eq.${id}`)
    .single();

  if (error || !data) return makeApiError(404, 'NOT_FOUND', 'Report not found');

  return Response.json(data);
}
