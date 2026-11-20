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

// Le scelte e i rimandati insieme, con una sola lettura della riga (la Home li vuole tutti e tre).
export async function leggiPromemoriaUtenteCompleto(
  supabase: SupabaseClient
): Promise<{ notificheAttive: boolean | null; nessunaSpesaFinoAl: string | null; rimandati: Rimandati }> {
  const { data, error } = await supabase
    .from('promemoria_utente')
    .select('notifiche_attive, nessuna_spesa_fino_al, rimandati')
    .maybeSingle();
  if (error) throw error;
  const riga = data as { notifiche_attive?: boolean | null; nessuna_spesa_fino_al?: string | null; rimandati?: unknown } | null;
  return {
    notificheAttive: riga?.notifiche_attive ?? null,
    nessunaSpesaFinoAl: riga?.nessuna_spesa_fino_al ?? null,
    rimandati: pulisciRimandati(riga?.rimandati),
  };
}

// "Più tardi" e "Va bene così" dei promemoria della casa: { id: primo giorno in cui ricompaiono }.
// Stanno nel database, così valgono su ogni telefono.
export type Rimandati = Record<string, string>;

function pulisciRimandati(grezzi: unknown): Rimandati {
  const out: Rimandati = {};
  if (typeof grezzi !== 'object' || grezzi === null || Array.isArray(grezzi)) return out;
  for (const [id, fino] of Object.entries(grezzi)) {
    if (typeof fino === 'string' && GIORNO.test(fino)) out[id] = fino;
  }
  return out;
}

// Aggiunge una chiave e toglie quelle già scadute (la data è il primo giorno in cui il promemoria ricompare).
export function unisciRimandati(attuali: Rimandati, id: string, finoAl: string, oggi: string): Rimandati {
  const out: Rimandati = {};
  for (const [k, v] of Object.entries(pulisciRimandati(attuali))) if (oggi < v && k !== id) out[k] = v;
  if (oggi < finoAl) out[id] = finoAl;
  return out;
}

export async function leggiRimandati(supabase: SupabaseClient): Promise<Rimandati> {
  const { data, error } = await supabase.from('promemoria_utente').select('rimandati').maybeSingle();
  if (error) throw error;
  return pulisciRimandati((data as { rimandati?: unknown } | null)?.rimandati);
}

// Rimanda un solo promemoria: rilegge la riga, unisce la chiave (le altre restano) e scrive.
export async function salvaRimandato(
  supabase: SupabaseClient,
  id: string,
  finoAl: string,
  oggi: string
): Promise<Rimandati> {
  if (!GIORNO.test(finoAl)) throw new Error('data non valida');
  const rimandati = unisciRimandati(await leggiRimandati(supabase), id, finoAl, oggi);
  const { error } = await supabase.from('promemoria_utente').upsert({ rimandati }, { onConflict: 'user_id' });
  if (error) throw error;
  return rimandati;
}
