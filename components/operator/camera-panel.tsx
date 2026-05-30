'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { bboxColor, rotCategory } from '@/lib/utils';

interface Detection {
  object_class: string;
  confidence_score: number;
  rot_level: number;
  color_category: string;
  defect_count: number;
  defect_severity: string;
  anomaly_score: number;
  bbox: { x: number; y: number; w: number; h: number };
}

type YoloStatus = 'checking' | 'online' | 'offline' | 'no-model';

// ---------- fallback mock (dipakai bila YOLO service offline) ----------
function mockDetection(w: number, h: number): Detection {
  const conf = 0.65 + Math.random() * 0.34;
  const rot = Math.random() * 40;
  return {
    object_class: ['apel', 'pisang', 'jeruk', 'tomat'][Math.floor(Math.random() * 4)],
    confidence_score: conf,
    rot_level: rot,
    color_category: rot < 15 ? 'Normal' : rot < 40 ? 'Pucat' : 'Terlalu Matang',
    defect_count: Math.floor(Math.random() * 4),
    defect_severity: rot < 20 ? 'Minor' : rot < 50 ? 'Moderate' : 'Severe',
    anomaly_score: rot / 100 + (1 - conf) * 0.2,
    bbox: {
      x: 40 + Math.random() * (w - 200),
      y: 40 + Math.random() * (h - 200),
      w: 80 + Math.random() * 120,
      h: 80 + Math.random() * 120,
    },
  };
}

// ---------- frame capture ----------
function captureFrame(video: HTMLVideoElement, quality = 0.75): string | null {
  const tmp = document.createElement('canvas');
  tmp.width = video.videoWidth || 640;
  tmp.height = video.videoHeight || 480;
  const ctx = tmp.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, tmp.width, tmp.height);
  const dataUrl = tmp.toDataURL('image/jpeg', quality);
  // strip "data:image/jpeg;base64,"
  return dataUrl.split(',')[1] ?? null;
}

export function OperatorCameraPanel() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingRef = useRef(false); // avoid overlapping inference calls

  const [cameraOn, setCameraOn] = useState(false);
  const [error, setError] = useState('');
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDevice, setSelectedDevice] = useState('');
  const [detections, setDetections] = useState<Detection[]>([]);
  const [yoloStatus, setYoloStatus] = useState<YoloStatus>('checking');
  const [inferenceMs, setInferenceMs] = useState<number | null>(null);
  const [indicators, setIndicators] = useState({
    rot_level: 0,
    anomaly_score: 0,
    color_category: 'Normal',
    defect_count: 0,
    defect_severity: 'Minor',
    confidence: 0,
  });

  // --- Check YOLO service health on mount ---
  useEffect(() => {
    let mounted = true;
    async function checkYolo() {
      try {
        const res = await fetch('/api/yolo/health');
        if (!res.ok) throw new Error('offline');
        const data = await res.json();
        if (!mounted) return;
        if (data.status === 'offline') {
          setYoloStatus('offline');
        } else if (!data.model_loaded) {
          setYoloStatus('no-model');
        } else {
          setYoloStatus('online');
        }
      } catch {
        if (mounted) setYoloStatus('offline');
      }
    }
    checkYolo();
    const t = setInterval(checkYolo, 10_000); // re-check every 10s
    return () => { mounted = false; clearInterval(t); };
  }, []);

  // --- Enumerate cameras ---
  useEffect(() => {
    if (!navigator.mediaDevices?.enumerateDevices) {
      setError(
        'Camera API tidak tersedia. Akses via localhost atau aktifkan HTTPS. ' +
        '(http://192.168.x.x tidak didukung oleh browser untuk akses kamera)'
      );
      return;
    }
    navigator.mediaDevices
      .enumerateDevices()
      .then((all) => {
        const cams = all.filter((d) => d.kind === 'videoinput');
        setDevices(cams);
        if (cams.length > 0) setSelectedDevice(cams[0].deviceId);
      })
      .catch(() => {});
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOn(false);
    setDetections([]);
    pendingRef.current = false;
  }, []);

  // --- Run one inference tick ---
  const runInference = useCallback(async () => {
    if (pendingRef.current) return; // skip if previous call still running
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return;

    // If YOLO online, call real service; otherwise use mock
    if (yoloStatus === 'online') {
      const b64 = captureFrame(video);
      if (!b64) return;

      pendingRef.current = true;
      try {
        const res = await fetch('/api/yolo/detect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image_b64: b64, conf: 0.45 }),
        });
        if (!res.ok) throw new Error('detect failed');
        const data = await res.json();
        const dets: Detection[] = data.detections ?? [];
        setInferenceMs(data.inference_ms ?? null);
        setDetections(dets);
        updateIndicators(dets);
        drawOverlay(dets, canvas, data.frame_w ?? canvas.width, data.frame_h ?? canvas.height);
      } catch {
        // Service went offline mid-session, fallback
        setYoloStatus('offline');
      } finally {
        pendingRef.current = false;
      }
    } else {
      // Mock mode
      const count = 1 + Math.floor(Math.random() * 2);
      const dets = Array.from({ length: count }, () => mockDetection(canvas.width, canvas.height));
      setDetections(dets);
      updateIndicators(dets);
      drawOverlay(dets, canvas, canvas.width, canvas.height);
    }
  }, [yoloStatus]);

  const startCamera = useCallback(async () => {
    setError('');
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Camera API tidak tersedia. Gunakan localhost atau HTTPS.');
      return;
    }
    try {
      const constraints: MediaStreamConstraints = {
        video: selectedDevice
          ? { deviceId: { exact: selectedDevice }, width: 1280, height: 720 }
          : { width: 1280, height: 720, facingMode: 'environment' },
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraOn(true);
      // Start inference loop (1.5s interval)
      intervalRef.current = setInterval(runInference, 1500);
    } catch (err) {
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError') setError('Izin kamera ditolak. Izinkan akses kamera di browser.');
        else if (err.name === 'NotFoundError') setError('Tidak ada kamera yang terdeteksi.');
        else setError(`Gagal mengakses kamera: ${err.message}`);
      }
    }
  }, [selectedDevice, runInference]);

  // Restart interval when yoloStatus changes (so it uses updated closure)
  useEffect(() => {
    if (!cameraOn) return;
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(runInference, 1500);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [yoloStatus, cameraOn, runInference]);

  useEffect(() => () => stopCamera(), [stopCamera]);

  function updateIndicators(dets: Detection[]) {
    if (!dets.length) return;
    const avg = (key: keyof Detection) =>
      dets.reduce((s, d) => s + (d[key] as number), 0) / dets.length;
    setIndicators({
      rot_level: avg('rot_level'),
      anomaly_score: avg('anomaly_score'),
      color_category: dets[0].color_category,
      defect_count: dets.reduce((s, d) => s + d.defect_count, 0),
      defect_severity: dets[0].defect_severity,
      confidence: avg('confidence_score'),
    });
  }

  function drawOverlay(
    dets: Detection[],
    canvas: HTMLCanvasElement,
    srcW: number,
    srcH: number,
  ) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Scale bbox from source frame size to canvas display size
    const scaleX = canvas.width / srcW;
    const scaleY = canvas.height / srcH;

    for (const d of dets) {
      const color = bboxColor(d.confidence_score, d.rot_level);
      const x = d.bbox.x * scaleX;
      const y = d.bbox.y * scaleY;
      const w = d.bbox.w * scaleX;
      const h = d.bbox.h * scaleY;

      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, w, h);

      const label = `${d.object_class} ${(d.confidence_score * 100).toFixed(0)}%`;
      ctx.font = 'bold 12px monospace';
      const textW = ctx.measureText(label).width + 8;
      ctx.fillStyle = color;
      ctx.fillRect(x, y - 20, textW, 20);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(label, x + 4, y - 5);
    }
  }

  // --- Status badge helper ---
  const yoloBadge = {
    checking: { label: 'Memeriksa AI...', variant: 'secondary' as const },
    online:   { label: 'YOLO Online',    variant: 'success' as const },
    'no-model': { label: 'Model Belum Ada', variant: 'warning' as const },
    offline:  { label: 'AI Offline (Mock)', variant: 'secondary' as const },
  }[yoloStatus];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100">
        <h2 className="text-base font-semibold text-gray-800">Live Camera & QC Monitor</h2>
        <div className="flex items-center gap-2">
          <Badge variant={yoloBadge.variant}>{yoloBadge.label}</Badge>
          <Badge variant={cameraOn ? 'success' : 'secondary'}>
            {cameraOn ? 'Live' : 'Standby'}
          </Badge>
        </div>
      </div>

      {/* Video feed */}
      <div className="relative flex-1 bg-gray-900 overflow-hidden min-h-0">
        <video ref={videoRef} className="w-full h-full object-contain" muted playsInline />
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
          width={1280}
          height={720}
        />
        {!cameraOn && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white bg-black/70">
            {error ? (
              <p className="text-sm text-red-400 text-center px-6">{error}</p>
            ) : (
              <p className="text-sm text-gray-300">Klik tombol di bawah untuk mengaktifkan kamera</p>
            )}
          </div>
        )}
        {/* Inference latency overlay */}
        {cameraOn && inferenceMs !== null && yoloStatus === 'online' && (
          <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded font-mono">
            {inferenceMs.toFixed(0)} ms
          </div>
        )}
        {cameraOn && yoloStatus !== 'online' && (
          <div className="absolute top-2 right-2 bg-yellow-600/80 text-white text-xs px-2 py-1 rounded">
            SIMULASI
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="px-4 py-2 border-t border-gray-100 flex items-center gap-3 bg-white shrink-0">
        {devices.length > 1 && (
          <select
            aria-label="Pilih kamera"
            title="Pilih kamera"
            className="text-xs border border-gray-200 rounded px-2 py-1 flex-1 focus:outline-none"
            value={selectedDevice}
            onChange={(e) => setSelectedDevice(e.target.value)}
            disabled={cameraOn}
          >
            {devices.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || `Kamera ${d.deviceId.slice(0, 8)}`}
              </option>
            ))}
          </select>
        )}
        {!cameraOn ? (
          <Button size="sm" onClick={startCamera} className="shrink-0">
            Aktifkan Kamera
          </Button>
        ) : (
          <Button size="sm" variant="destructive" onClick={stopCamera} className="shrink-0">
            Matikan Kamera
          </Button>
        )}
      </div>

      {/* Real-time indicators */}
      <div className="grid grid-cols-2 gap-2 p-3 bg-gray-50 shrink-0">
        <IndicatorCard
          label="Rot Level"
          value={`${indicators.rot_level.toFixed(1)}%`}
          sub={rotCategory(indicators.rot_level)}
          color={
            indicators.rot_level < 15 ? 'text-green-700'
            : indicators.rot_level < 40 ? 'text-yellow-700'
            : 'text-red-700'
          }
        />
        <IndicatorCard
          label="Confidence"
          value={`${(indicators.confidence * 100).toFixed(1)}%`}
          sub={indicators.confidence >= 0.8 ? 'Tinggi' : indicators.confidence >= 0.6 ? 'Sedang' : 'Rendah'}
          color={
            indicators.confidence >= 0.8 ? 'text-green-700'
            : indicators.confidence >= 0.6 ? 'text-yellow-700'
            : 'text-red-700'
          }
        />
        <IndicatorCard
          label="Anomaly Score"
          value={indicators.anomaly_score.toFixed(3)}
          sub={indicators.anomaly_score > 0.8 ? 'Kritis' : indicators.anomaly_score > 0.5 ? 'Waspada' : 'Normal'}
          color={
            indicators.anomaly_score > 0.8 ? 'text-red-700'
            : indicators.anomaly_score > 0.5 ? 'text-yellow-700'
            : 'text-green-700'
          }
        />
        <IndicatorCard
          label="Defect"
          value={`${indicators.defect_count} cacat`}
          sub={indicators.defect_severity}
          color={
            indicators.defect_severity === 'Severe' ? 'text-red-700'
            : indicators.defect_severity === 'Moderate' ? 'text-yellow-700'
            : 'text-gray-700'
          }
        />
      </div>

      {/* YOLO info bar */}
      {yoloStatus !== 'online' && (
        <div className="px-4 py-2 bg-amber-50 border-t border-amber-100 text-xs text-amber-800 shrink-0">
          {yoloStatus === 'no-model' && (
            <span>Model belum ada. Jalankan <code className="font-mono bg-amber-100 px-1 rounded">python train.py</code> di folder <code className="font-mono bg-amber-100 px-1 rounded">yolo_service/</code></span>
          )}
          {yoloStatus === 'offline' && (
            <span>YOLO service offline. Jalankan: <code className="font-mono bg-amber-100 px-1 rounded">uvicorn main:app --port 8000</code> di folder <code className="font-mono bg-amber-100 px-1 rounded">yolo_service/</code></span>
          )}
          {yoloStatus === 'checking' && <span>Memeriksa koneksi ke YOLO service...</span>}
        </div>
      )}
    </div>
  );
}

function IndicatorCard({
  label, value, sub, color = 'text-gray-900',
}: {
  label: string; value: string; sub?: string; color?: string;
}) {
  return (
    <Card>
      <CardContent className="py-2 px-3">
        <p className="text-xs text-gray-500">{label}</p>
        <p className={`text-base font-semibold ${color}`}>{value}</p>
        {sub && <p className="text-xs text-gray-400">{sub}</p>}
      </CardContent>
    </Card>
  );
}
