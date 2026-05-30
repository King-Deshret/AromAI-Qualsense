'use client';
import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { Notification } from '@/lib/types';

const ALERT_TYPES = ['SYSTEM_ALERT', 'USER_ALERT', 'DATA_ALERT', 'PERFORMANCE_ALERT', 'CRON_REPORT_READY'];

const TYPE_VARIANT: Record<string, 'destructive' | 'warning' | 'secondary' | 'default'> = {
  SYSTEM_ALERT: 'destructive',
  USER_ALERT: 'warning',
  DATA_ALERT: 'warning',
  PERFORMANCE_ALERT: 'destructive',
  CRON_REPORT_READY: 'default',
};

export function AdminNotificationsModule() {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => { fetchNotifs(); }, []);

  async function fetchNotifs() {
    const res = await fetch('/api/notifications?limit=50');
    if (res.ok) {
      const data = await res.json();
      setNotifications((data.data ?? []).filter((n: Notification) => ALERT_TYPES.includes(n.type)));
    }
  }

  async function markHandled(id: string) {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, is_read: true }),
    });
    fetchNotifs();
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-gray-900">Notifikasi Admin</h1>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Waktu</TableHead>
              <TableHead>Tipe</TableHead>
              <TableHead>Judul</TableHead>
              <TableHead>Pesan</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {notifications.map((n) => (
              <TableRow key={n.id} className={!n.is_read ? 'bg-orange-50' : ''}>
                <TableCell className="text-xs whitespace-nowrap">
                  {new Date(n.created_at).toLocaleString('id-ID')}
                </TableCell>
                <TableCell>
                  <Badge variant={TYPE_VARIANT[n.type] ?? 'secondary'} className="text-xs">
                    {n.type}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm font-medium">{n.title}</TableCell>
                <TableCell className="text-xs text-gray-600 max-w-xs">{n.message}</TableCell>
                <TableCell>
                  <Badge variant={n.is_read ? 'secondary' : 'warning'} className="text-xs">
                    {n.is_read ? 'Ditangani' : 'Belum'}
                  </Badge>
                </TableCell>
                <TableCell>
                  {!n.is_read && (
                    <Button size="sm" variant="outline" onClick={() => markHandled(n.id)} className="text-xs h-7">
                      Tandai Ditangani
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {notifications.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-gray-400 py-8">Tidak ada notifikasi admin</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
