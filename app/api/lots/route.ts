import { NextRequest } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase';
import { getServerSession } from '@/lib/auth';
import { makeApiError, getClientIp, generateLotCode } from '@/lib/utils';
import { writeAuditLog } from '@/lib/audit';
import { dispatchNotification } from '@/lib/notifications';

const createLotSchema = z.object({
  batch_name: z.string().min(1).max(200),
  product_type: z.string().min(1),
  estimated_units: z.number().int().positive(),
  production_date: z.string().min(1),
  shift: z.enum(['Pagi', 'Siang', 'Malam']),
});

export async function GET(request: NextRequest) {
  const user = await getServerSession();
  if (!user) return makeApiError(401, 'UNAUTHORIZED', 'Unauthenticated');

  const url = new URL(request.url);
  const page = Number(url.searchParams.get('page') ?? 1);
  const perPage = Math.min(Number(url.searchParams.get('per_page') ?? 25), 100);
  const status = url.searchParams.get('status');
  const offset = (page - 1) * perPage;

  let query = supabaseAdmin.from('lots').select('*, operator:operator_id(id,name,email)', { count: 'exact' });

  if (user.role === 'Operator') {
    query = query.eq('operator_id', user.id);
  }
  if (status) query = query.eq('status', status);

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + perPage - 1);

  if (error) return makeApiError(500, 'INTERNAL_ERROR', error.message);

  return Response.json({ data: data ?? [], total: count ?? 0, page, per_page: perPage });
}

export async function POST(request: NextRequest) {
  const user = await getServerSession();
  if (!user) return makeApiError(401, 'UNAUTHORIZED', 'Unauthenticated');
  if (user.role !== 'Operator' && user.role !== 'Admin') {
    return makeApiError(403, 'FORBIDDEN', 'Only operators can create lots');
  }

  const body = await request.json().catch(() => null);
  const parsed = createLotSchema.safeParse(body);
  if (!parsed.success) {
    return makeApiError(400, 'VALIDATION_ERROR', 'Invalid input', [
      ...parsed.error.errors.map((e) => ({
        field: e.path.join('.'),
        constraint: e.code,
        message: e.message,
      })),
    ]);
  }

  const lot_code = generateLotCode();
  const { data: lot, error } = await supabaseAdmin
    .from('lots')
    .insert({
      ...parsed.data,
      lot_code,
      operator_id: user.id,
      status: 'INSPECTION_RUNNING',
    })
    .select()
    .single();

  if (error || !lot) return makeApiError(500, 'INTERNAL_ERROR', error?.message ?? 'Create failed');

  // Create inspection session
  const { data: session } = await supabaseAdmin
    .from('inspection_sessions')
    .insert({ lot_id: lot.id, operator_id: user.id, status: 'RUNNING' })
    .select()
    .single();

  await writeAuditLog({
    actor_id: user.id,
    action_type: 'LOT_CREATED',
    target_type: 'lots',
    target_id: lot.id,
    value_after: { lot_code, status: 'INSPECTION_RUNNING' },
    ip_address: getClientIp(request),
  });

  return Response.json({ lot, session }, { status: 201 });
}
