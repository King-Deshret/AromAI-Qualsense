import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getServerSession } from '@/lib/auth';
import { makeApiError } from '@/lib/utils';

export async function GET(request: NextRequest) {
  const user = await getServerSession();
  if (!user) return makeApiError(401, 'UNAUTHORIZED', 'Unauthenticated');
  if (user.role === 'Operator') return makeApiError(403, 'FORBIDDEN', 'Access denied');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: lotsRaw } = await supabaseAdmin
    .from('lots')
    .select('*, operator:operator_id(name), inspection_reports(final_grade, avg_confidence, avg_rot_level)')
    .order('created_at', { ascending: false })
    .limit(5000);

  type ExportLot = {
    lot_code: string; batch_name: string; product_type: string; shift: string;
    status: string; production_date: string;
    operator: { name?: string } | null;
    inspection_reports: { final_grade?: string; avg_confidence?: number; avg_rot_level?: number }[] | null;
  };
  const lots = (lotsRaw ?? []) as unknown as ExportLot[];

  const headers = ['lot_code', 'batch_name', 'product_type', 'operator', 'shift', 'status', 'production_date', 'grade', 'avg_confidence', 'avg_rot_level'];
  const rows = lots.map((lot) => {
    const report = lot.inspection_reports?.[0];
    return [
      lot.lot_code,
      lot.batch_name,
      lot.product_type,
      lot.operator?.name ?? '',
      lot.shift,
      lot.status,
      lot.production_date,
      report?.final_grade ?? '',
      report?.avg_confidence?.toFixed(4) ?? '',
      report?.avg_rot_level?.toFixed(2) ?? '',
    ].join(',');
  });

  const csv = [headers.join(','), ...rows].join('\n');

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="lots-export-${Date.now()}.csv"`,
    },
  });
}
