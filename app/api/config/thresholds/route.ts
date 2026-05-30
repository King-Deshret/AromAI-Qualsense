import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getServerSession } from '@/lib/auth';
import { makeApiError, getClientIp } from '@/lib/utils';
import { writeAuditLog } from '@/lib/audit';

export async function GET() {
  const user = await getServerSession();
  if (!user) return makeApiError(401, 'UNAUTHORIZED', 'Unauthenticated');
  if (user.role !== 'Admin') return makeApiError(403, 'FORBIDDEN', 'Admin only');

  const { data, error } = await supabaseAdmin.from('thresholds').select('*').order('grade');
  if (error) return makeApiError(500, 'INTERNAL_ERROR', error.message);
  return Response.json({ data: data ?? [] });
}

export async function PATCH(request: NextRequest) {
  const user = await getServerSession();
  if (!user) return makeApiError(401, 'UNAUTHORIZED', 'Unauthenticated');
  if (user.role !== 'Admin') return makeApiError(403, 'FORBIDDEN', 'Admin only');

  const body = await request.json().catch(() => null);
  if (!Array.isArray(body)) return makeApiError(400, 'VALIDATION_ERROR', 'Expected array of thresholds');

  const results = [];
  for (const threshold of body) {
    const { id, ...rest } = threshold;
    const { data, error } = await supabaseAdmin
      .from('thresholds')
      .update(rest)
      .eq('id', id)
      .select()
      .single();

    if (!error && data) results.push(data);

    await writeAuditLog({
      actor_id: user.id,
      action_type: 'THRESHOLD_UPDATED',
      target_type: 'thresholds',
      target_id: id,
      value_after: rest,
      ip_address: getClientIp(request),
    });
  }

  return Response.json({ data: results });
}
