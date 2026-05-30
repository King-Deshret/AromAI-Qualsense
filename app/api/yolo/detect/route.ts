import { NextRequest } from 'next/server';

const YOLO_SERVICE = process.env.YOLO_SERVICE_URL ?? 'http://localhost:8000';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body?.image_b64) {
    return Response.json({ error: 'image_b64 required' }, { status: 400 });
  }

  try {
    const res = await fetch(`${YOLO_SERVICE}/detect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_b64: body.image_b64, conf: body.conf ?? 0.45 }),
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      return Response.json({ error: err.detail ?? 'YOLO service error' }, { status: res.status });
    }

    const data = await res.json();
    return Response.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ error: `YOLO service tidak tersedia: ${msg}` }, { status: 503 });
  }
}
