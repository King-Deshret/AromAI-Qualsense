import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getServerSession } from '@/lib/auth';
import { makeApiError } from '@/lib/utils';

export async function GET(request: NextRequest) {
  const user = await getServerSession();
  if (!user) return makeApiError(401, 'UNAUTHORIZED', 'Unauthenticated');

  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get('limit') ?? 20), 100);

  const { data, error } = await supabaseAdmin
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return makeApiError(500, 'INTERNAL_ERROR', error.message);
  return Response.json({ data: data ?? [] });
}

export async function PATCH(request: NextRequest) {
  const user = await getServerSession();
  if (!user) return makeApiError(401, 'UNAUTHORIZED', 'Unauthenticated');

  const body = await request.json().catch(() => null);
  if (!body?.id) return makeApiError(400, 'VALIDATION_ERROR', 'Missing notification id');

  const { error } = await supabaseAdmin
    .from('notifications')
    .update({ is_read: true })
    .eq('id', body.id)
    .eq('user_id', user.id); // scoped to user

  if (error) return makeApiError(500, 'INTERNAL_ERROR', error.message);
  return Response.json({ ok: true });
}
