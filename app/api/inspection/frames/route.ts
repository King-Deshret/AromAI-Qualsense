import { NextRequest } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase';
import { makeApiError } from '@/lib/utils';
import { runSessionCompletionCheck } from '@/lib/inspection-hooks';

const frameSchema = z.object({
  lot_id: z.string().uuid(),
  session_id: z.string().uuid(),
  object_class: z.string().min(1),
  confidence_score: z.number().min(0).max(1),
  rot_level: z.number().min(0).max(100),
  color_rgb: z.object({ r: z.number(), g: z.number(), b: z.number() }),
  color_deviation: z.number(),
  color_category: z.enum(['Normal', 'Pucat', 'Terlalu Matang', 'Abnormal']),
  defect_types: z.array(z.string()),
  defect_count: z.number().int().min(0),
  defect_severity: z.enum(['Minor', 'Moderate', 'Severe']),
  anomaly_score: z.number().min(0).max(1),
  bbox_coordinates: z.object({ x: z.number(), y: z.number(), width: z.number(), height: z.number() }),
  frame_timestamp: z.string().optional(),
});

export async function POST(request: NextRequest) {
  // Validate internal service token
  const token = request.headers.get('x-internal-token');
  const expectedToken = process.env.INTERNAL_SERVICE_TOKEN;
  if (expectedToken && token !== expectedToken) {
    return makeApiError(401, 'UNAUTHORIZED', 'Invalid internal token');
  }

  const body = await request.json().catch(() => null);
  const parsed = frameSchema.safeParse(body);
  if (!parsed.success) {
    return makeApiError(400, 'VALIDATION_ERROR', 'Invalid frame data');
  }

  const frame = {
    ...parsed.data,
    frame_timestamp: parsed.data.frame_timestamp ?? new Date().toISOString(),
  };

  const { error } = await supabaseAdmin.from('frame_data').insert(frame);
  if (error) return makeApiError(500, 'INTERNAL_ERROR', error.message);

  // Asynchronously check session completion conditions (non-blocking)
  runSessionCompletionCheck(parsed.data.session_id, parsed.data.lot_id).catch(console.error);

  return Response.json({ ok: true }, { status: 201 });
}
