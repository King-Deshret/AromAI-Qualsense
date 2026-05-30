'use client';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { MetricsSummary, AuditLog } from '@/lib/types';

export function AdminOverview() {
  const [metrics, setMetrics] = useState<MetricsSummary | null>(null);
  const [activities, setActivities] = useState<AuditLog[]>([]);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 30_000);
    return () => clearInterval(id);
  }, []);

  async function fetchData() {
    const [mRes, aRes] = await Promise.all([
      fetch('/api/metrics/summary'),
      fetch('/api/audit?per_page=20'),
    ]);
    if (mRes.ok) setMetrics(await mRes.json());
    if (aRes.ok) {
      const d = await aRes.json();
      setActivities(d.data ?? []);
    }
  }

  const summaryCards = metrics
    ? [
        { label: 'Pending Review', value: metrics.pending_lots, color: 'text-orange-600' },
        { label: 'Approved Hari Ini', value: metrics.total_approved_today, color: 'text-green-600' },
        { label: 'Rejected Hari Ini', value: metrics.total_rejected_today, color: 'text-red-600' },
        { label: 'Quarantined Hari Ini', value: metrics.total_quarantined_today, color: 'text-yellow-600' },
        { label: 'Operator Aktif', value: metrics.active_operators, color: 'text-blue-600' },
        { label: 'Manager Aktif', value: metrics.active_managers, color: 'text-purple-600' },
        { label: 'Alert Belum Ditangani', value: metrics.unhandled_alerts, color: 'text-red-700' },
        { label: 'Avg Confidence', value: `${(metrics.avg_confidence * 100).toFixed(1)}%`, color: 'text-brand-600' },
      ]
    : [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Overview Sistem</h1>
        <p className="text-sm text-gray-500">Update otomatis setiap 30 detik</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {summaryCards.map((c) => (
          <Card key={c.label}>
            <CardContent className="py-4">
              <p className="text-xs text-gray-500">{c.label}</p>
              <p className={`text-2xl font-bold ${c.color}`}>{c.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Aktivitas Terkini</CardTitle></CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Waktu</TableHead>
              <TableHead>Jenis Aksi</TableHead>
              <TableHead>Target</TableHead>
              <TableHead>Pelaku</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {activities.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="text-xs whitespace-nowrap">
                  {new Date(a.created_at).toLocaleString('id-ID')}
                </TableCell>
                <TableCell className="text-xs font-mono">{a.action_type}</TableCell>
                <TableCell className="text-xs">{a.target_type} / {a.target_id.slice(0, 8)}</TableCell>
                <TableCell className="text-xs">
                  {(a.actor as { name?: string } | null)?.name ?? 'SYSTEM'}
                </TableCell>
                <TableCell>
                  <Badge variant={a.status === 'SUCCESS' ? 'success' : 'destructive'} className="text-xs">
                    {a.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
            {activities.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-gray-400 py-8">Tidak ada aktivitas</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
