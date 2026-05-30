const YOLO_SERVICE = process.env.YOLO_SERVICE_URL ?? 'http://localhost:8000';

export async function GET() {
  try {
    const res = await fetch(`${YOLO_SERVICE}/health`, {
      signal: AbortSignal.timeout(2000),
    });
    const data = await res.json();
    return Response.json(data);
  } catch {
    return Response.json({ status: 'offline', model_loaded: false }, { status: 503 });
  }
}
