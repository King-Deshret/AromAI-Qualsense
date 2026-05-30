import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getServerSession } from '@/lib/auth';
import { makeApiError } from '@/lib/utils';

export async function GET(request: NextRequest) {
  const user = await getServerSession();
  if (!user) return makeApiError(401, 'UNAUTHORIZED', 'Unauthenticated');
  if (user.role === 'Operator') return makeApiError(403, 'FORBIDDEN', 'Access denied');

  const url = new URL(request.url);
  const q = url.searchParams.get('q') ?? '';
  const status = url.searchParams.get('status');
  const grade = url.searchParams.get('grade');
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const shift = url.searchParams.get('shift');
  const page = Number(url.searchParams.get('page') ?? 1);
  const perPage = Math.min(Number(url.searchParams.get('per_page') ?? 25), 100);
  const offset = (page - 1) * perPage;

  let query = supabaseAdmin
    .from('lots')
    .select('*, operator:operator_id(id,name), inspection_reports(final_grade)', { count: 'exact' });

  if (q) query = query.ilike('batch_name', `%${q}%`);
  if (status) query = query.eq('status', status);
  if (from) query = query.gte('production_date', from);
  if (to) query = query.lte('production_date', to);
  if (shift) query = query.eq('shift', shift);

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + perPage - 1);

  if (error) return makeApiError(500, 'INTERNAL_ERROR', error.message);

  // Client-side grade filter (since it comes from a joined table)
  const filtered = grade
    ? (data ?? []).filter((lot: { inspection_reports?: { final_grade: string }[] }) =>
        lot.inspection_reports?.some((r) => r.final_grade === grade)
      )
    : (data ?? []);

  return Response.json({ data: filtered, total: count ?? 0, page, per_page: perPage });
}
