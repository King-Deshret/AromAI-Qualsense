'use client';
import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { LiveSessionAggregate } from '@/lib/types';

const PRODUCT_TYPES = [
  { value: 'bawang_merah', label: 'Bawang Merah' },
  { value: 'bawang_putih', label: 'Bawang Putih' },
  { value: 'cabai_merah', label: 'Cabai Merah' },
  { value: 'tomat', label: 'Tomat' },
  { value: 'kentang', label: 'Kentang' },
  { value: 'wortel', label: 'Wortel' },
];

const SHIFT_OPTIONS = [
  { value: 'Pagi', label: 'Pagi (06:00 – 14:00)' },
  { value: 'Siang', label: 'Siang (14:00 – 22:00)' },
  { value: 'Malam', label: 'Malam (22:00 – 06:00)' },
];

interface Props {
  operatorId: string;
  operatorName: string;
}

export function OperatorLotPanel({ operatorId, operatorName }: Props) {
  const [sessionActive, setSessionActive] = useState(false);
  const [activeLotId, setActiveLotId] = useState<string | null>(null);
  const [aggregate, setAggregate] = useState<LiveSessionAggregate | null>(null);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    product_type: '',
    batch_name: '',
    estimated_units: '',
    production_date: new Date().toISOString().split('T')[0],
    shift: 'Pagi',
  });

  function setField(field: string, value: string) {
    setForm((p) => ({ ...p, [field]: value }));
    setErrors((p) => ({ ...p, [field]: '' }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const newErrors: Record<string, string> = {};
    if (!form.product_type) newErrors.product_type = 'Pilih jenis produk';
    if (!form.batch_name.trim() || form.batch_name.length > 200) newErrors.batch_name = 'Nama batch 1–200 karakter';
    if (!form.estimated_units || Number(form.estimated_units) <= 0) newErrors.estimated_units = 'Masukkan jumlah unit positif';
    if (!form.production_date) newErrors.production_date = 'Pilih tanggal produksi';

    if (Object.keys(newErrors).length) { setErrors(newErrors); return; }

    setLoading(true);
    try {
      const res = await fetch('/api/lots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, estimated_units: Number(form.estimated_units) }),
      });
      const data = await res.json();
      if (!res.ok) { setErrors({ _global: data.message }); return; }
      setActiveLotId(data.lot.id);
      setSessionActive(true);
    } catch {
      setErrors({ _global: 'Gagal memulai sesi. Coba lagi.' });
    } finally {
      setLoading(false);
    }
  }

  // Poll live aggregate when session is active
  useEffect(() => {
    if (!activeLotId) return;
    const fetchAgg = async () => {
      const res = await fetch(`/api/inspection/live/${activeLotId}`);
      if (res.ok) setAggregate(await res.json());
    };
    fetchAgg();
    const id = setInterval(fetchAgg, 3000);
    return () => clearInterval(id);
  }, [activeLotId]);

  return (
    <div className="flex flex-col h-full overflow-y-auto p-4 gap-4">
      <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
        <h2 className="text-base font-semibold text-gray-800">Lot Management</h2>
        {sessionActive && <Badge variant="success">Sesi Aktif</Badge>}
      </div>

      {!sessionActive ? (
        <Card>
          <CardHeader><CardTitle className="text-sm">Form Inisialisasi Lot</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <Select
                label="Jenis Bahan/Produk"
                options={PRODUCT_TYPES}
                value={form.product_type}
                onChange={(e) => setField('product_type', e.target.value)}
                placeholder="Pilih jenis..."
                error={errors.product_type}
                required
              />
              <Input
                label="Nama/Kode Batch"
                value={form.batch_name}
                onChange={(e) => setField('batch_name', e.target.value)}
                placeholder="Contoh: BATCH-2024-001"
                error={errors.batch_name}
                required
              />
              <Input
                label="Estimasi Jumlah Unit"
                type="number"
                min={1}
                value={form.estimated_units}
                onChange={(e) => setField('estimated_units', e.target.value)}
                placeholder="500"
                error={errors.estimated_units}
                required
              />
              <Input
                label="Tanggal Produksi"
                type="date"
                value={form.production_date}
                onChange={(e) => setField('production_date', e.target.value)}
                error={errors.production_date}
                required
              />
              <Select
                label="Shift"
                options={SHIFT_OPTIONS}
                value={form.shift}
                onChange={(e) => setField('shift', e.target.value)}
                required
              />
              <Input
                label="Nama Operator"
                value={operatorName}
                readOnly
                className="bg-gray-50 cursor-not-allowed"
              />
              {errors._global && (
                <p className="text-xs text-red-600">{errors._global}</p>
              )}
              <Button type="submit" loading={loading} className="w-full mt-1">
                Mulai Sesi Inspeksi
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : (
        aggregate && (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-gray-500">Lot ID: <span className="font-mono">{activeLotId}</span></p>
            <div className="grid grid-cols-2 gap-3">
              <MetricCard label="Total Terpindai" value={aggregate.total_objects_scanned} />
              <MetricCard label="Pass" value={aggregate.pass_count} color="text-green-700" />
              <MetricCard label="Fail" value={aggregate.fail_count} color="text-red-700" />
              <MetricCard label="Avg Confidence" value={`${(aggregate.avg_confidence * 100).toFixed(1)}%`} />
              <MetricCard label="Avg Rot Level" value={`${aggregate.avg_rot_level.toFixed(1)}%`} />
              <MetricCard label="Avg Anomaly" value={aggregate.avg_anomaly_score.toFixed(3)} />
            </div>
            <Card>
              <CardContent className="pt-3">
                <p className="text-xs font-medium text-gray-600 mb-2">Estimasi Grade</p>
                <Badge
                  variant={
                    aggregate.estimated_grade === 'A' ? 'success'
                    : aggregate.estimated_grade === 'B' ? 'default'
                    : aggregate.estimated_grade === 'C' ? 'warning'
                    : 'destructive'
                  }
                  className="text-sm px-3 py-1"
                >
                  Grade {aggregate.estimated_grade}
                </Badge>
              </CardContent>
            </Card>
          </div>
        )
      )}
    </div>
  );
}

function MetricCard({ label, value, color = 'text-gray-900' }: { label: string; value: string | number; color?: string }) {
  return (
    <Card>
      <CardContent className="pt-3 pb-3">
        <p className="text-xs text-gray-500">{label}</p>
        <p className={`text-lg font-semibold ${color}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
