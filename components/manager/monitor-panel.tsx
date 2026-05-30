'use client';
import { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { Lot, MetricsSummary } from '@/lib/types';

interface Props {
  onSelectLot?: (lot: Lot) => void;
}

export function ManagerMonitorPanel({ onSelectLot }: Props) {
  const [metrics, setMetrics] = useState<MetricsSummary | null>(null);
  const [lots, setLots] = useState<Lot[]>([]);
  const [q, setQ] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    fetchMetrics();
    fetchLots();
    const id = setInterval(() => { fetchMetrics(); fetchLots(); }, 30_000);
    return () => clearInterval(id);
  }, []);

  async function fetchMetrics() {
    const res = await fetch('/api/metrics/summary');
    if (res.ok) setMetrics(await res.json());
  }

  async function fetchLots(search = q) {
    const params = new URLSearchParams({ status: 'MANAGER_REVIEW', per_page: '50' });
    if (search) params.set('q', search);
    const res = await fetch(`/api/search/lots?${params}`);
    if (res.ok) {
      const data = await res.json();
      setLots(data.data ?? []);
    }
  }

  function handleSearch(val: string) {
    setQ(val);
    fetchLots(val);
  }

  function selectLot(lot: Lot) {
    setSelectedId(lot.id);
    onSelectLot?.(lot);
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto p-4 gap-4">
      <h2 className="text-base font-semibold text-gray-800 pb-2 border-b border-gray-100">Monitoring</h2>

      {/* Metrics Cards */}
      {metrics && (
        <div className="grid grid-cols-2 gap-2">
          <Card><CardContent className="py-2 px-3"><p className="text-xs text-gray-500">Pending Review</p><p className="text-xl font-bold text-orange-600">{metrics.pending_lots}</p></CardContent></Card>
          <Card><CardContent className="py-2 px-3"><p className="text-xs text-gray-500">Pass Rate</p><p className="text-xl font-bold text-green-600">{metrics.pass_rate}%</p></CardContent></Card>
          <Card><CardContent className="py-2 px-3"><p className="text-xs text-gray-500">Fail Rate</p><p className="text-xl font-bold text-red-600">{metrics.fail_rate}%</p></CardContent></Card>
          <Card><CardContent className="py-2 px-3"><p className="text-xs text-gray-500">Avg Confidence</p><p className="text-xl font-bold text-blue-600">{(metrics.avg_confidence * 100).toFixed(1)}%</p></CardContent></Card>
        </div>
      )}

      {/* Review Queue */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Review Queue</CardTitle>
          <div className="relative mt-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-500"
              placeholder="Cari batch, operator..."
              value={q}
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Batch</TableHead>
                <TableHead>Produk</TableHead>
                <TableHead>Operator</TableHead>
                <TableHead>Tanggal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lots.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center text-gray-400 py-8">Tidak ada lot pending</TableCell></TableRow>
              ) : (
                lots.map((lot) => (
                  <TableRow
                    key={lot.id}
                    onClick={() => selectLot(lot)}
                    className={`cursor-pointer ${selectedId === lot.id ? 'bg-brand-50' : ''}`}
                  >
                    <TableCell className="font-medium text-xs">{lot.batch_name}</TableCell>
                    <TableCell className="text-xs">{lot.product_type}</TableCell>
                    <TableCell className="text-xs">{(lot.operator as { name?: string } | undefined)?.name ?? '-'}</TableCell>
                    <TableCell className="text-xs">{new Date(lot.created_at).toLocaleDateString('id-ID')}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
