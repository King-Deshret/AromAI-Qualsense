'use client';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { SystemConfig } from '@/lib/types';

const TABS = ['Threshold', 'Kamera', 'Notifikasi', 'CRON'] as const;
type Tab = typeof TABS[number];

export function AdminConfigModule() {
  const [tab, setTab] = useState<Tab>('Threshold');
  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => { fetchConfig(); }, []);

  async function fetchConfig() {
    const res = await fetch('/api/config');
    if (res.ok) setConfig(await res.json());
  }

  async function saveConfig(updates: Partial<SystemConfig>) {
    setSaving(true); setMsg('');
    const res = await fetch('/api/config', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    setSaving(false);
    if (res.ok) { setMsg('Konfigurasi berhasil disimpan'); fetchConfig(); }
    else setMsg('Gagal menyimpan konfigurasi');
  }

  if (!config) return <p className="text-gray-500 text-sm">Memuat konfigurasi...</p>;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-gray-900">Konfigurasi Sistem</h1>

      <div className="flex gap-1 border-b border-gray-200">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t ? 'border-brand-500 text-brand-700' : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {msg && <p className={`text-sm ${msg.includes('berhasil') ? 'text-green-600' : 'text-red-600'}`}>{msg}</p>}

      {tab === 'Threshold' && (
        <ThresholdTab config={config} onSave={saveConfig} saving={saving} />
      )}
      {tab === 'Kamera' && (
        <CameraTab config={config} onSave={saveConfig} saving={saving} />
      )}
      {tab === 'CRON' && (
        <CronTab config={config} saving={saving} />
      )}
      {tab === 'Notifikasi' && (
        <p className="text-sm text-gray-500">Konfigurasi notifikasi — gunakan API /api/config untuk mengubah notification_config.</p>
      )}
    </div>
  );
}

function ThresholdTab({ config, onSave, saving }: { config: SystemConfig; onSave: (u: Partial<SystemConfig>) => void; saving: boolean }) {
  const [f, setF] = useState({
    confidence_min: config.confidence_min,
    rot_threshold_a: config.rot_threshold_a,
    rot_threshold_b: config.rot_threshold_b,
    rot_threshold_c: config.rot_threshold_c,
    defect_threshold_a: config.defect_threshold_a,
    defect_threshold_b: config.defect_threshold_b,
    defect_threshold_c: config.defect_threshold_c,
    anomaly_quarantine_threshold: config.anomaly_quarantine_threshold,
    anomaly_escalation_threshold: config.anomaly_escalation_threshold,
    session_max_duration_sec: config.session_max_duration_sec,
    conveyor_stop_detect_sec: config.conveyor_stop_detect_sec,
  });

  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Threshold YOLO & Decision Engine</CardTitle></CardHeader>
      <CardContent className="grid grid-cols-2 gap-4">
        <Input label="Confidence Min (0–1)" type="number" step="0.01" min={0} max={1} value={f.confidence_min} onChange={(e) => setF(p => ({...p, confidence_min: Number(e.target.value)}))} />
        <Input label="Rot Threshold Grade A (%)" type="number" value={f.rot_threshold_a} onChange={(e) => setF(p => ({...p, rot_threshold_a: Number(e.target.value)}))} />
        <Input label="Rot Threshold Grade B (%)" type="number" value={f.rot_threshold_b} onChange={(e) => setF(p => ({...p, rot_threshold_b: Number(e.target.value)}))} />
        <Input label="Rot Threshold Grade C (%)" type="number" value={f.rot_threshold_c} onChange={(e) => setF(p => ({...p, rot_threshold_c: Number(e.target.value)}))} />
        <Input label="Defect Threshold Grade A" type="number" value={f.defect_threshold_a} onChange={(e) => setF(p => ({...p, defect_threshold_a: Number(e.target.value)}))} />
        <Input label="Defect Threshold Grade B" type="number" value={f.defect_threshold_b} onChange={(e) => setF(p => ({...p, defect_threshold_b: Number(e.target.value)}))} />
        <Input label="Defect Threshold Grade C" type="number" value={f.defect_threshold_c} onChange={(e) => setF(p => ({...p, defect_threshold_c: Number(e.target.value)}))} />
        <Input label="Anomaly Quarantine Threshold" type="number" step="0.01" value={f.anomaly_quarantine_threshold} onChange={(e) => setF(p => ({...p, anomaly_quarantine_threshold: Number(e.target.value)}))} />
        <Input label="Anomaly Escalation Threshold" type="number" step="0.01" value={f.anomaly_escalation_threshold} onChange={(e) => setF(p => ({...p, anomaly_escalation_threshold: Number(e.target.value)}))} />
        <Input label="Durasi Maks Sesi (detik)" type="number" value={f.session_max_duration_sec} onChange={(e) => setF(p => ({...p, session_max_duration_sec: Number(e.target.value)}))} />
        <Input label="Conveyor Stop Detect (detik)" type="number" value={f.conveyor_stop_detect_sec} onChange={(e) => setF(p => ({...p, conveyor_stop_detect_sec: Number(e.target.value)}))} />
        <div className="col-span-2">
          <Button onClick={() => onSave(f)} loading={saving}>Simpan Threshold</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function CameraTab({ config, onSave, saving }: { config: SystemConfig; onSave: (u: Partial<SystemConfig>) => void; saving: boolean }) {
  const [f, setF] = useState({ camera_url: config.camera_url, camera_resolution: config.camera_resolution, camera_fps: config.camera_fps });
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState('');

  async function testConnection() {
    setTesting(true);
    const res = await fetch('/api/camera/status');
    setTestResult(res.ok ? 'Koneksi berhasil' : 'Koneksi gagal');
    setTesting(false);
  }

  async function restart() {
    await fetch('/api/camera/restart', { method: 'POST' });
    alert('Camera Service direstart');
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Konfigurasi Kamera</CardTitle></CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Input label="URL Stream Kamera" value={f.camera_url} onChange={(e) => setF(p => ({...p, camera_url: e.target.value}))} />
        <Input label="Resolusi" value={f.camera_resolution} onChange={(e) => setF(p => ({...p, camera_resolution: e.target.value}))} placeholder="1920x1080" />
        <Input label="Frame Rate (FPS)" type="number" value={f.camera_fps} onChange={(e) => setF(p => ({...p, camera_fps: Number(e.target.value)}))} />
        {testResult && <p className={`text-sm ${testResult.includes('berhasil') ? 'text-green-600' : 'text-red-600'}`}>{testResult}</p>}
        <div className="flex gap-2">
          <Button onClick={() => onSave(f)} loading={saving}>Simpan</Button>
          <Button variant="outline" onClick={testConnection} loading={testing}>Test Koneksi</Button>
          <Button variant="destructive" onClick={restart}>Restart Camera Service</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function CronTab({ config, saving }: { config: SystemConfig; saving: boolean }) {
  const [triggering, setTriggering] = useState<string | null>(null);

  async function triggerJob(job: string) {
    setTriggering(job);
    await fetch(`/api/cron/${job}/trigger`, { method: 'POST' });
    setTriggering(null);
  }

  const jobs = [
    { id: 'metrics-refresh', label: 'Rekap Metrics', schedule: config.cron_config?.metrics_refresh_cron ?? '0 * * * *' },
    { id: 'daily-report', label: 'Laporan Harian', schedule: config.cron_config?.daily_report_cron ?? '0 0 * * *' },
    { id: 'archive-frame-data', label: 'Arsip Frame Data', schedule: config.cron_config?.archive_frame_data_cron ?? '0 0 * * *' },
    { id: 'weekly-report', label: 'Laporan Mingguan', schedule: config.cron_config?.weekly_report_cron ?? '0 0 * * 1' },
    { id: 'monthly-report', label: 'Laporan Bulanan', schedule: config.cron_config?.monthly_report_cron ?? '0 0 1 * *' },
  ];

  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Konfigurasi CRON Jobs</CardTitle></CardHeader>
      <CardContent>
        <div className="divide-y divide-gray-100">
          {jobs.map((job) => (
            <div key={job.id} className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm font-medium">{job.label}</p>
                <p className="text-xs text-gray-400 font-mono">{job.schedule}</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => triggerJob(job.id)}
                loading={triggering === job.id}
              >
                Trigger Manual
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
