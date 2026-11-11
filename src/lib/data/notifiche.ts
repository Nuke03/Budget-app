import type { SupabaseClient } from '@supabase/supabase-js';
import { endpointAmmesso } from '@/lib/pushEndpoint';

const GIORNO = /^\d{4}-\d{2}-\d{2}$/;

// Salva l'iscrizione di questo dispositivo (una riga per endpoint). Il server manderà le notifiche
// all'indirizzo scelto dal telefono: si accetta solo quello di un servizio push noto.
export async function salvaIscrizione(supabase: SupabaseClient, sub: PushSubscriptionJSON): Promise<void> {
  const endpoint = sub.endpoint;
  const p256dh = sub.keys?.p256dh;
  const auth = sub.keys?.auth;
  if (!endpoint || !p256dh || !auth || !endpointAmmesso(endpoint)) {
    throw new Error('iscrizione non valida');
  }
  const { error } = await supabase
    .from('push_iscrizioni')
    .upsert({ endpoint, p256dh, auth }, { onConflict: 'endpoint' });
  if (error) throw error;
}

// L'utente ha detto sì o no alle notifiche. user_id è quello della sessione (default del database).
export async function rispondiNotifiche(supabase: SupabaseClient, attive: boolean): Promise<void> {
  const { error } = await supabase
    .from('promemoria_utente')
    .upsert({ notifiche_attive: attive }, { onConflict: 'user_id' });
  if (error) throw error;
}

// "Non ho speso niente" fino a quel giorno: il promemoria delle spese non scatta prima.
export async function segnaNessunaSpesa(supabase: SupabaseClient, finoAl: string): Promise<void> {
  if (!GIORNO.test(finoAl)) throw new Error('data non valida');
  const { error } = await supabase
    .from('promemoria_utente')
    .upsert({ nessuna_spesa_fino_al: finoAl }, { onConflict: 'user_id' });
  if (error) throw error;
}

// Le scelte dell'utente sui promemoria (RLS: solo la sua riga). Senza riga: tutto sconosciuto.
export async function leggiPromemoriaUtente(
  supabase: SupabaseClient
): Promise<{ notificheAttive: boolean | null; nessunaSpesaFinoAl: string | null }> {
  const { data, error } = await supabase
    .from('promemoria_utente')
    .select('notifiche_attive, nessuna_spesa_fino_al')
    .maybeSingle();
  if (error) throw error;
  return {
    notificheAttive: data?.notifiche_attive ?? null,
    nessunaSpesaFinoAl: data?.nessuna_spesa_fino_al ?? null,
  };
}
