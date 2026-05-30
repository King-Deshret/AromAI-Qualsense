'use client';
import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { AuditLog } from '@/lib/types';

export function AdminAuditModule() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState({ action_type: '', from: '', to: '' });

  const fetchLogs = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), per_page: '20' });
    if (filter.action_type) params.set('action_type', filter.action_type);
    if (filter.from) params.set('from', filter.from);
    if (filter.to) params.set('to', filter.to);

    const res = await fetch(`/api/audit?${params}`);
    if (res.ok) {
      const data = await res.json();
      setLogs(data.data ?? []);
      setTotal(data.total ?? 0);
    }
  }, [page, filter]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Audit Log</h1>
        <Badge variant="secondary" className="text-xs">Read-only · Immutable</Badge>
      </div>

      {/* Filters */}
      <div className="flex gap-3 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500">Jenis Aksi</label>
          <input
            className="border border-gray-200 rounded px-2 py-1.5 text-sm focus:ring-1 focus:ring-brand-500 focus:outline-none"
            placeholder="Contoh: LOGIN_SUCCESS"
            value={filter.action_type}
            onChange={(e) => setFilter(p => ({ ...p, action_type: e.target.value }))}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500">Dari Tanggal</label>
          <input type="date" className="border border-gray-200 rounded px-2 py-1.5 text-sm" value={filter.from} onChange={(e) => setFilter(p => ({...p, from: e.target.value}))} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500">Sampai Tanggal</label>
          <input type="date" className="border border-gray-200 rounded px-2 py-1.5 text-sm" value={filter.to} onChange={(e) => setFilter(p => ({...p, to: e.target.value}))} />
        </div>
        <Button size="sm" onClick={() => { setPage(1); fetchLogs(); }}>Filter</Button>
        <Button size="sm" variant="ghost" onClick={() => setFilter({ action_type: '', from: '', to: '' })}>Reset</Button>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Waktu</TableHead>
              <TableHead>Jenis Aksi</TableHead>
              <TableHead>Pelaku</TableHead>
              <TableHead>Target</TableHead>
              <TableHead>IP</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map((log) => (
              <TableRow key={log.id}>
                <TableCell className="text-xs whitespace-nowrap">{new Date(log.created_at).toLocaleString('id-ID')}</TableCell>
                <TableCell className="text-xs font-mono">{log.action_type}</TableCell>
                <TableCell className="text-xs">{(log.actor as { name?: string } | null)?.name ?? 'SYSTEM'}</TableCell>
                <TableCell className="text-xs">{log.target_type} / <span className="font-mono">{log.target_id.slice(0, 8)}</span></TableCell>
                <TableCell className="text-xs font-mono">{log.ip_address ?? '-'}</TableCell>
                <TableCell>
                  <Badge variant={log.status === 'SUCCESS' ? 'success' : 'destructive'} className="text-xs">{log.status}</Badge>
                </TableCell>
              </TableRow>
            ))}
            {logs.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-gray-400 py-8">Tidak ada data audit log</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <div className="flex items-center justify-between text-sm text-gray-500">
        <span>Total: {total} entri</span>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Prev</Button>
          <span className="self-center">Hal {page} / {Math.ceil(total / 20)}</span>
          <Button size="sm" variant="outline" disabled={page * 20 >= total} onClick={() => setPage(p => p + 1)}>Next</Button>
        </div>
      </div>
    </div>
  );
}
