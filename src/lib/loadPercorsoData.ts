import type { SupabaseClient } from '@supabase/supabase-js';
import { format } from 'date-fns';
import { loadHomeData, type HomeData } from '@/lib/loadHomeData';
import { leggiPercorso } from '@/lib/data/percorso';
import { getPivaSettings } from '@/lib/data/pivaSettings';
import { getLastIncomeDate, getTransactions } from '@/lib/data/transactions';
import { PERSONALE } from '@/lib/data/scope';
import { inizioMesiFa } from '@/lib/pivaHome';
import { oggiRomaISO } from '@/lib/calculations/casa/oggi';
import { statoPrimiPassi, type PrimiPassi } from '@/lib/calculations/percorso/passi';
import type { StatiLezioni } from '@/lib/percorso/tipi';
import type { Account, Transaction } from '@/lib/types';
import type { DatiRegole } from '@/lib/calculations/percorso/regole';

// Tutto ciò che serve a decidere e a scrivere le lezioni: i dati della home più lo stato del percorso.
export async function loadPercorsoData(
  supabase: SupabaseClient,
  today: Date = new Date(),
  userId: string | null = null
): Promise<DatiRegole & { primiPassi: PrimiPassi; conti: Account[]; riservati: HomeData['riservati'] }> {
  const oggi = oggiRomaISO(today);
  const [home, percorso, piva, transazioni, ultimaEntrata] = await Promise.all([
    loadHomeData(supabase, today, userId),
    leggiPercorso(supabase).catch(() => ({ utente: null, lezioni: {} as StatiLezioni })),
    getPivaSettings(supabase).catch(() => null),
    getTransactions(supabase, PERSONALE, { da: inizioMesiFa(oggi, 3) }).catch(() => [] as Transaction[]),
    getLastIncomeDate(supabase).catch(() => null),
  ]);
  const primiPassi = statoPrimiPassi({
    conti: home.accounts,
    goals: home.goals,
    percorso: percorso.utente,
    pivaGuidata: !!piva?.guidataDal,
    oggi,
  });
  return {
    oggi,
    transazioni,
    categorie: home.categories,
    goals: home.goals,
    lezioni: percorso.lezioni,
    percorso: percorso.utente,
    disponibileReale: home.disponibileReale,
    ultimaEntrataIl: ultimaEntrata ? format(ultimaEntrata, 'yyyy-MM-dd') : null,
    primiPassiVisibili: primiPassi.visibile,
    primiPassi,
    // Per l'avviso sui fondi: i conti (con il conto tasse già fuori) e i soldi già promessi.
    conti: home.accounts,
    riservati: home.riservati,
  };
}
