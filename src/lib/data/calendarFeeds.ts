import type { SupabaseClient } from '@supabase/supabase-js';
import type { CalendarFeed } from '../types';

interface CalendarFeedRow {
  id: string;
  household_id: string;
  user_id: string;
  token: string;
  created_at: string;
  revocato_il: string | null;
}

// calendar_feeds non è una tabella con scope: la RLS lascia leggere solo il feed di chi chiede.
export async function getMyCalendarFeed(supabase: SupabaseClient): Promise<CalendarFeed | null> {
  const { data, error } = await supabase
    .from('calendar_feeds')
    .select('id, household_id, user_id, token, created_at, revocato_il')
    .is('revocato_il', null)
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) throw error;
  const r = ((data ?? []) as CalendarFeedRow[])[0];
  if (!r) return null;
  return {
    id: r.id,
    householdId: r.household_id,
    userId: r.user_id,
    token: r.token,
    createdAt: r.created_at,
    revocatoIl: r.revocato_il,
  };
}

export async function rotateCalendarFeed(supabase: SupabaseClient): Promise<string> {
  const { data, error } = await supabase.rpc('rotate_calendar_feed');
  if (error) throw error;
  return data as string;
}

export async function revokeCalendarFeed(supabase: SupabaseClient): Promise<void> {
  const { error } = await supabase.rpc('revoke_calendar_feed');
  if (error) throw error;
}
