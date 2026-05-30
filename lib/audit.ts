import { supabaseAdmin } from './supabase';
import type { Json } from './database.types';

export async function writeAuditLog(params: {
  actor_id?: string;
  action_type: string;
  target_type: string;
  target_id: string;
  value_before?: Record<string, unknown>;
  value_after?: Record<string, unknown>;
  ip_address?: string;
  status?: string;
}) {
  const payload = {
    actor_id: params.actor_id ?? null,
    action_type: params.action_type,
    target_type: params.target_type,
    target_id: params.target_id,
    value_before: (params.value_before ?? null) as Json | null,
    value_after: (params.value_after ?? null) as Json | null,
    ip_address: params.ip_address ?? null,
    status: params.status ?? 'SUCCESS',
  };

  const { error } = await supabaseAdmin.from('audit_logs').insert(payload);

  if (error) {
    // FK violation: actor_id not yet in public.users — retry with null actor
    if (error.code === '23503' && params.actor_id) {
      await supabaseAdmin.from('audit_logs').insert({ ...payload, actor_id: null });
      return;
    }
    console.error('[audit] Failed to write audit log:', error.message);
  }
}
