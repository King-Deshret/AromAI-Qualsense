'use client';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Lot, InspectionReport, Decision } from '@/lib/types';

interface Props {
  selectedLot?: Lot | null;
}

export function ManagerDecisionPanel({ selectedLot }: Props) {
  const [report, setReport] = useState<InspectionReport | null>(null);
  const [autoDecision, setAutoDecision] = useState<Decision | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [escalationReason, setEscalationReason] = useState('');
  const [showEscalate, setShowEscalate] = useState(false);

  async function loadLotDetail(lot: Lot) {
    setReport(null);
    setAutoDecision(null);
    setDone(false);
    setLoading(true);
    try {
      const [reportRes, decisionRes] = await Promise.all([
        fetch(`/api/inspection/reports/${lot.id}`),
        fetch(`/api/decision/${lot.id}`, { method: 'POST' }),
      ]);
      if (reportRes.ok) setReport(await reportRes.json());
      if (decisionRes.ok) {
        const d = await decisionRes.json();
        setAutoDecision(d.decision);
      }
    } finally {
      setLoading(false);
    }
  }

  async function confirmDecision(decision: string) {
    if (!selectedLot) return;
    setConfirming(true);
    try {
      await fetch(`/api/decision/${selectedLot.id}/override`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, override_reason: overrideReason || undefined }),
      });
      setDone(true);
    } finally {
      setConfirming(false);
    }
  }

  async function escalate() {
    if (!selectedLot || !escalationReason) return;
    setConfirming(true);
    try {
      await fetch(`/api/decision/${selectedLot.id}/override`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision: 'ESCALATED', escalation_reason: escalationReason }),
      });
      setDone(true);
    } finally {
      setConfirming(false);
    }
  }

  if (!selectedLot) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-sm">
        Pilih lot dari queue untuk melihat detail
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 text-green-600">
        <p className="font-semibold text-lg">Keputusan telah diambil</p>
        <p className="text-sm text-gray-500">Lot telah dihapus dari review queue.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto p-4 gap-4">
      <h2 className="text-base font-semibold text-gray-800 pb-2 border-b border-gray-100">
        Action & Decision
      </h2>

      {loading && <p className="text-sm text-gray-500">Memuat detail inspeksi...</p>}

      {report && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Detail Inspeksi</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-2 text-sm">
            <DetailRow label="Batch" value={selectedLot.batch_name} />
            <DetailRow label="Grade" value={<Badge variant={report.final_grade === 'A' ? 'success' : report.final_grade === 'B' ? 'default' : report.final_grade === 'C' ? 'warning' : 'destructive'}>{report.final_grade}</Badge>} />
            <DetailRow label="Avg Confidence" value={`${(report.avg_confidence * 100).toFixed(1)}%`} />
            <DetailRow label="Avg Rot Level" value={`${report.avg_rot_level.toFixed(1)}%`} />
            <DetailRow label="Anomaly Score" value={report.final_anomaly_score.toFixed(3)} />
            <DetailRow label="Total Objek" value={report.total_objects_scanned} />
            <DetailRow label="Pass / Fail" value={`${report.pass_count} / ${report.fail_count}`} />
            <DetailRow label="Total Defects" value={report.total_defects} />
            <DetailRow label="Durasi" value={`${Math.round(report.inspection_duration / 60)} menit`} />
          </CardContent>
        </Card>
      )}

      {autoDecision && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Hasil Auto-Decision</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Badge
              variant={
                autoDecision.decision === 'APPROVED' ? 'success'
                : autoDecision.decision === 'REJECTED' ? 'destructive'
                : 'warning'
              }
              className="text-base px-4 py-1.5 self-start"
            >
              {autoDecision.decision}
            </Badge>

            {!showEscalate && (
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => confirmDecision(autoDecision.decision)} loading={confirming}>
                    Konfirmasi {autoDecision.decision}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setShowEscalate(true)}>
                    Eskalasi Manual
                  </Button>
                </div>
                <div className="flex gap-2">
                  {(['APPROVED', 'REJECTED', 'QUARANTINED'] as const)
                    .filter((d) => d !== autoDecision.decision)
                    .map((d) => (
                      <Button key={d} size="sm" variant="secondary" onClick={() => confirmDecision(d)} loading={confirming}>
                        Override → {d}
                      </Button>
                    ))}
                </div>
                <input
                  className="border border-gray-200 rounded px-2 py-1 text-xs text-gray-600"
                  placeholder="Alasan override (opsional)"
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                />
              </div>
            )}

            {showEscalate && (
              <div className="flex flex-col gap-2">
                <p className="text-xs text-gray-600">Alasan eskalasi (wajib):</p>
                <textarea
                  className="border border-gray-300 rounded px-2 py-1 text-sm resize-none h-20"
                  placeholder="Jelaskan alasan eskalasi..."
                  value={escalationReason}
                  onChange={(e) => setEscalationReason(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={escalate} disabled={!escalationReason} loading={confirming}>
                    Kirim Eskalasi
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowEscalate(false)}>Batal</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}
