import { supabaseAdmin } from './supabase';
import type { NotificationType } from './types';

export async function dispatchNotification(params: {
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  reference_type?: string;
  reference_id?: string;
}) {
  const { error } = await supabaseAdmin.from('notifications').insert({
    user_id: params.user_id,
    type: params.type,
    title: params.title,
    message: params.message,
    is_read: false,
    reference_type: params.reference_type ?? null,
    reference_id: params.reference_id ?? null,
  });

  if (error) {
    console.error('[notifications] Failed to dispatch notification:', error.message);
  }
}

export async function dispatchNotificationToMany(
  user_ids: string[],
  params: Omit<Parameters<typeof dispatchNotification>[0], 'user_id'>
) {
  await Promise.all(user_ids.map((uid) => dispatchNotification({ ...params, user_id: uid })));
}

// Get manager IDs to notify (all active managers or escalation target)
export async function getManagerIds(): Promise<string[]> {
  const { data } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('role', 'Manager')
    .eq('status', 'ACTIVE');
  return (data ?? []).map((u) => u.id);
}
