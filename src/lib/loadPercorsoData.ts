import type { SupabaseClient } from '@supabase/supabase-js';
import { format } from 'date-fns';
import { loadHomeBase, type HomeData } from '@/lib/loadHomeData';
import { oggiRomaISO } from '@/lib/calculations/casa/oggi';
import type { PrimiPassi } from '@/lib/calculations/percorso/passi';
import type { Account } from '@/lib/types';
import type { DatiRegole } from '@/lib/calculations/percorso/regole';

// Tutto ciò che serve a decidere e a scrivere le lezioni: i dati della home più lo stato del percorso.
// Le letture sono quelle della Home, una volta sola: nessuna lettura in più.
export async function loadPercorsoData(
  supabase: SupabaseClient,
  today: Date = new Date(),
  userId: string | null = null
): Promise<DatiRegole & { primiPassi: PrimiPassi; conti: Account[]; riservati: HomeData['riservati'] }> {
  const { home, grezzi } = await loadHomeBase(supabase, today, userId);
  return {
    oggi: oggiRomaISO(today),
    transazioni: grezzi.transazioni,
    categorie: home.categories,
    goals: home.goals,
    lezioni: grezzi.percorso.lezioni,
    percorso: grezzi.percorso.utente,
    disponibileReale: home.disponibileReale,
    disponibileLibero: home.disponibileLibero,
    ultimaEntrataIl: grezzi.ultimaEntrata ? format(grezzi.ultimaEntrata, 'yyyy-MM-dd') : null,
    primiPassiVisibili: home.primiPassi.visibile,
    primiPassi: home.primiPassi,
    // Per l'avviso sui fondi: i conti (con il conto tasse già fuori) e i soldi già promessi.
    conti: home.accounts,
    riservati: home.riservati,
  };
}
