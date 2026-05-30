'use client';
import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { Lot } from '@/lib/types';

const TABS = ['Semua Lot', 'Monitor Aktif'] as const;
type Tab = typeof TABS[number];

const STATUS_VARIANT: Record<string, 'success' | 'destructive' | 'warning' | 'default' | 'secondary'> = {
  APPROVED: 'success',
  REJECTED: 'destructive',
  QUARANTINED: 'warning',
  INSPECTION_RUNNING: 'default',
  MANAGER_REVIEW: 'secondary',
  ESCALATED: 'warning',
};

export function AdminLotsModule() {
  const [tab, setTab] = useState<Tab>('Semua Lot');
  const [lots, setLots] = useState<Lot[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const perPage = 25;

  const fetchLots = useCallback(async () => {
    const endpoint = tab === 'Monitor Aktif' ? '/api/lots/active' : `/api/lots?page=${page}&per_page=${perPage}`;
    const res = await fetch(endpoint);
    if (res.ok) {
      const data = await res.json();
      setLots(data.data ?? []);
      setTotal(data.total ?? 0);
    }
  }, [tab, page]);

  useEffect(() => { fetchLots(); }, [fetchLots]);

  // Auto-refresh monitor aktif
  useEffect(() => {
    if (tab !== 'Monitor Aktif') return;
    const id = setInterval(fetchLots, 10_000);
    return () => clearInterval(id);
  }, [tab, fetchLots]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Manajemen Lot & Inspeksi</h1>
        <Button size="sm" variant="outline" onClick={() => window.open('/api/reports/export', '_blank')}>
          Ekspor CSV
        </Button>
      </div>

      <div className="flex gap-1 border-b border-gray-200">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setPage(1); }}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t ? 'border-brand-500 text-brand-700' : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            {t}
            {t === 'Monitor Aktif' && <span className="ml-1 text-xs text-orange-500">LIVE</span>}
          </button>
        ))}
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kode Lot</TableHead>
              <TableHead>Batch</TableHead>
              <TableHead>Produk</TableHead>
              <TableHead>Operator</TableHead>
              <TableHead>Shift</TableHead>
              <TableHead>Tanggal</TableHead>
              <TableHead>Status</TableHead>
              {tab === 'Monitor Aktif' && <TableHead>Waktu Mulai</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {lots.map((lot) => (
              <TableRow key={lot.id} className="cursor-pointer">
                <TableCell className="font-mono text-xs">{lot.lot_code}</TableCell>
                <TableCell className="text-sm font-medium">{lot.batch_name}</TableCell>
                <TableCell className="text-xs">{lot.product_type}</TableCell>
                <TableCell className="text-xs">{(lot.operator as { name?: string } | undefined)?.name ?? '-'}</TableCell>
                <TableCell className="text-xs">{lot.shift}</TableCell>
                <TableCell className="text-xs">{new Date(lot.production_date).toLocaleDateString('id-ID')}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[lot.status] ?? 'secondary'} className="text-xs">
                    {lot.status}
                  </Badge>
                </TableCell>
                {tab === 'Monitor Aktif' && (
                  <TableCell className="text-xs">
                    {new Date(lot.created_at).toLocaleString('id-ID')}
                  </TableCell>
                )}
              </TableRow>
            ))}
            {lots.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-gray-400 py-8">
                  {tab === 'Monitor Aktif' ? 'Tidak ada sesi inspeksi aktif' : 'Tidak ada data lot'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {tab === 'Semua Lot' && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>Total: {total} lot</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Prev</Button>
            <span className="self-center">Hal {page} / {Math.ceil(total / perPage)}</span>
            <Button size="sm" variant="outline" disabled={page * perPage >= total} onClick={() => setPage(p => p + 1)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}
