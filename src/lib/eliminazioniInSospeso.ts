// Eliminazioni di movimenti in attesa della scrittura vera (finestra di Annulla). Se iOS chiude l'app
// prima che la richiesta parta o finisca, l'eliminazione resta scritta in localStorage (una chiave per
// movimento) e all'apertura successiva si ripete con elimina_movimento, che è idempotente: una riga già
// sparita non fa niente e il saldo non si muove due volte. Tutto dentro try/catch: senza localStorage
// (navigazione privata, spazio pieno) l'app funziona come prima, solo senza la ripresa.
import type { SupabaseClient } from '@supabase/supabase-js';
import { eliminaMovimento } from './data/transactions';

const PREFISSO = 'eliminazione-in-sospeso:';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function salvaInSospeso(id: string): void {
  try {
    window.localStorage.setItem(PREFISSO + id, JSON.stringify({ id, salvataIl: Date.now() }));
  } catch {}
}

export function togliInSospeso(id: string): void {
  try {
    window.localStorage.removeItem(PREFISSO + id);
  } catch {}
}

function idRimasti(): string[] {
  try {
    const ids: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(PREFISSO)) ids.push(k.slice(PREFISSO.length));
    }
    return ids;
  } catch {
    return [];
  }
}

// Ripete le eliminazioni rimaste. Ritorna quante ne ha eseguite. Una chiave si toglie solo a scrittura
// riuscita (o se non potrà mai riuscire); un errore di rete la lascia per la volta dopo.
export async function riprendiEliminazioniInSospeso(
  creaClient: () => SupabaseClient,
  escludi: string[] = []
): Promise<number> {
  const ids = idRimasti().filter((id) => !escludi.includes(id));
  if (ids.length === 0) return 0;
  let fatte = 0;
  let supabase: SupabaseClient;
  try {
    supabase = creaClient();
  } catch {
    return 0;
  }
  for (const id of ids) {
    if (!UUID.test(id)) {
      togliInSospeso(id); // una chiave che non è un id non potrà mai riuscire
      continue;
    }
    try {
      await eliminaMovimento(supabase, id);
      togliInSospeso(id);
      fatte++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : '';
      // Il movimento non è più modificabile da chi è qui (non è suo): riprovare non servirebbe mai.
      if (/non modificabile/i.test(msg)) togliInSospeso(id);
    }
  }
  return fatte;
}
