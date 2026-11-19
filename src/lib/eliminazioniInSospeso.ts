// Eliminazioni di movimenti in attesa della scrittura vera (finestra di Annulla). Se iOS chiude l'app
// prima che la richiesta parta o finisca, l'eliminazione resta scritta in localStorage (una chiave per
// movimento) e all'apertura successiva si ripete con elimina_movimento, che è idempotente: una riga già
// sparita non fa niente e il saldo non si muove due volte. Tutto dentro try/catch: senza localStorage
// (navigazione privata, spazio pieno) l'app funziona come prima, solo senza la ripresa.
import type { SupabaseClient } from '@supabase/supabase-js';
import { eliminaMovimento } from './data/transactions';

const PREFISSO = 'eliminazione-in-sospeso:';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Sotto questa età la voce è ancora nella finestra di Annulla (anche di un'altra scheda): non si tocca.
export const ATTESA_MINIMA_MS = 6000;
// Sopra questa età la voce è troppo vecchia per essere ancora una volontà: si scarta.
export const SCADENZA_MS = 7 * 24 * 60 * 60 * 1000;

// La chiave porta anche l'utente: sullo stesso telefono ognuno riprende solo le proprie eliminazioni.
const chiave = (utenteId: string, id: string) => `${PREFISSO}${utenteId}:${id}`;

export function salvaInSospeso(id: string, utenteId: string, adesso: number = Date.now()): void {
  try {
    window.localStorage.setItem(chiave(utenteId, id), JSON.stringify({ id, utenteId, salvataIl: adesso }));
  } catch {}
}

export function togliInSospeso(id: string, utenteId: string): void {
  try {
    window.localStorage.removeItem(chiave(utenteId, id));
  } catch {}
}

function chiaviDi(utenteId: string): string[] {
  try {
    const prefisso = `${PREFISSO}${utenteId}:`;
    const chiavi: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(prefisso)) chiavi.push(k);
    }
    return chiavi;
  } catch {
    return [];
  }
}

function togliChiave(k: string): void {
  try {
    window.localStorage.removeItem(k);
  } catch {}
}

// Ripete le eliminazioni rimaste di QUESTO utente (le chiavi degli altri non si toccano). Ritorna quante ne ha
// eseguite. Una chiave si toglie solo a scrittura riuscita, o se non potrà mai riuscire o è scaduta; un errore di
// rete la lascia per la volta dopo. Le voci più giovani di ATTESA_MINIMA_MS si saltano (finestra di Annulla).
export async function riprendiEliminazioniInSospeso(
  creaClient: () => SupabaseClient,
  utenteId: string,
  adesso: number = Date.now()
): Promise<number> {
  if (!utenteId) return 0;
  const pronte: { k: string; id: string }[] = [];
  for (const k of chiaviDi(utenteId)) {
    let voce: { id?: unknown; utenteId?: unknown; salvataIl?: unknown } | null = null;
    try {
      voce = JSON.parse(window.localStorage.getItem(k) ?? 'null');
    } catch {}
    const id = k.slice(`${PREFISSO}${utenteId}:`.length);
    if (!voce || voce.utenteId !== utenteId || voce.id !== id || typeof voce.salvataIl !== 'number') {
      togliChiave(k); // illeggibile o non sua: non potrà mai riuscire
      continue;
    }
    const eta = adesso - voce.salvataIl;
    if (eta > SCADENZA_MS) {
      togliChiave(k);
      continue;
    }
    if (eta < ATTESA_MINIMA_MS) continue;
    if (!UUID.test(id)) {
      togliChiave(k);
      continue;
    }
    pronte.push({ k, id });
  }
  if (pronte.length === 0) return 0;
  let supabase: SupabaseClient;
  try {
    supabase = creaClient();
  } catch {
    return 0;
  }
  let fatte = 0;
  for (const { k, id } of pronte) {
    try {
      await eliminaMovimento(supabase, id);
      togliChiave(k);
      fatte++;
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : '';
      // Il movimento non è più modificabile da chi è qui: riprovare non servirebbe mai.
      if (/non modificabile/i.test(msg)) togliChiave(k);
    }
  }
  return fatte;
}
