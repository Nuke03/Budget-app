import type { SupabaseClient } from '@supabase/supabase-js';

export type PingResult = { ok: true } | { ok: false; error: string };

// Una lettura minima (al massimo una riga) basta perché Supabase registri
// attività sul progetto: sul piano gratuito un progetto senza richieste per
// circa 7 giorni viene messo in pausa e il suo indirizzo smette di esistere.
export async function pingDatabase(supabase: SupabaseClient): Promise<PingResult> {
  try {
    const { error } = await supabase.from('accounts').select('id').limit(1);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// Vercel Cron invia `Authorization: Bearer <CRON_SECRET>` quando la variabile
// d'ambiente CRON_SECRET è impostata. Senza segreto la route resta aperta: fa
// solo una lettura che, senza login, le policy RLS restituiscono vuota.
export function isAuthorizedCron(header: string | null, secret: string | undefined): boolean {
  if (!secret) return true;
  return header === `Bearer ${secret}`;
}
