import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getServerSession } from '@/lib/auth';
import { makeApiError } from '@/lib/utils';

export async function GET(request: NextRequest) {
  const user = await getServerSession();
  if (!user) return makeApiError(401, 'UNAUTHORIZED', 'Unauthenticated');
  if (user.role !== 'Admin') return makeApiError(403, 'FORBIDDEN', 'Admin only');

  const url = new URL(request.url);
  const page = Number(url.searchParams.get('page') ?? 1);
  const perPage = Math.min(Number(url.searchParams.get('per_page') ?? 20), 100);
  const action_type = url.searchParams.get('action_type');
  const actor_id = url.searchParams.get('actor_id');
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const offset = (page - 1) * perPage;

  let query = supabaseAdmin
    .from('audit_logs')
    .select('*, actor:actor_id(id,name,role)', { count: 'exact' });

  if (action_type) query = query.eq('action_type', action_type);
  if (actor_id) query = query.eq('actor_id', actor_id);
  if (from) query = query.gte('created_at', from);
  if (to) query = query.lte('created_at', to);

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + perPage - 1);

  if (error) return makeApiError(500, 'INTERNAL_ERROR', error.message);
  return Response.json({ data: data ?? [], total: count ?? 0, page, per_page: perPage });
}
