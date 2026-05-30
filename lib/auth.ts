import { createSupabaseServerClient, supabaseAdmin } from './supabase';
import type { User, UserRole } from './types';

export async function getServerSession(): Promise<User | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error || !data) return null;
  if (data.status !== 'ACTIVE') return null;
  return data as User;
}

export function requireRole(user: User | null, ...roles: UserRole[]): boolean {
  if (!user) return false;
  return roles.includes(user.role as UserRole);
}

export const SESSION_DURATION_HOURS = 8;
