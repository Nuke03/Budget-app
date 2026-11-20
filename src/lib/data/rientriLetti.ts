import type { SupabaseClient } from '@supabase/supabase-js';
import type { Rientro, Spostamento } from '../calculations/rientri';
import { getRientri } from './rientri';
import { getSpostamenti } from './spostamenti';

// I rientri personali con gli spostamenti dal più vecchio rientro verso un conto in poi (nessuna lettura se
// non ce ne sono). Non lancia mai: rientri che non si leggono = nessun rientro; spostamenti che non si
// leggono = `null` (chi calcola ignora i rientri verso i conti, vedi rientriEffettivi).
export async function leggiRientriESpostamenti(
  supabase: SupabaseClient
): Promise<{ rientri: Rientro[]; spostamenti: Spostamento[] | null }> {
  let rientri: Rientro[];
  try {
    rientri = await getRientri(supabase);
  } catch {
    return { rientri: [], spostamenti: [] };
  }
  const inizi = rientri.filter((r) => r.accountId !== null).map((r) => r.creatoIl);
  if (inizi.length === 0) return { rientri, spostamenti: [] };
  try {
    return { rientri, spostamenti: await getSpostamenti(supabase, inizi.reduce((min, d) => (d < min ? d : min))) };
  } catch {
    return { rientri, spostamenti: null };
  }
}
