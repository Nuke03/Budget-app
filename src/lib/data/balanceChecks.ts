import type { SupabaseClient } from '@supabase/supabase-js';

const ERRORE_GENERICO = 'Salvataggio fallito, controlla la connessione e riprova.';

// Registra il saldo della banca per un conto. Con creaMovimento la differenza diventa una spesa o
// un'entrata non registrata nel mese. Restituisce l'id del controllo.
export async function recordBalanceCheck(
  supabase: SupabaseClient,
  input: { accountId: string; saldoDichiarato: number; data: string; creaMovimento: boolean }
): Promise<string> {
  const { data, error } = await supabase.rpc('record_balance_check', {
    p_account: input.accountId,
    p_saldo_dichiarato: input.saldoDichiarato,
    p_data: input.data,
    p_crea_movimento: input.creaMovimento,
  });
  if (error) throw error;
  return data as string;
}

// Solo l'ultimo controllo e l'ultimo check-in: due letture con limit 1, in parallelo.
export async function getControlliRecenti(
  supabase: SupabaseClient,
  householdId: string
): Promise<{ ultimoControllo: string | null; ultimoCheckinMese: string | null }> {
  // household: per id
  const [controlli, checkin] = await Promise.all([
    supabase
      .from('balance_checks')
      .select('data')
      .eq('household_id', householdId)
      .order('data', { ascending: false })
      .limit(1),
    supabase
      .from('household_checkins')
      .select('mese')
      .eq('household_id', householdId)
      .order('mese', { ascending: false })
      .limit(1),
  ]);
  if (controlli.error) throw controlli.error;
  if (checkin.error) throw checkin.error;
  const ultimoControllo = (controlli.data?.[0]?.data as string | undefined) ?? null;
  const ultimoCheckinMese = (checkin.data?.[0]?.mese as string | undefined) ?? null;
  return { ultimoControllo, ultimoCheckinMese };
}

// Traduce gli errori di record_balance_check in frasi per chi usa la pagina.
export function messaggioErroreControllo(e: unknown): string {
  let testo = '';
  if (e instanceof Error) testo = e.message;
  else if (typeof e === 'object' && e !== null && 'message' in e) testo = String(e.message);
  if (testo.includes('conto non valido')) return 'Quel conto non è più disponibile.';
  if (testo.includes('data non valida')) return 'Quella data non è valida.';
  return ERRORE_GENERICO;
}
