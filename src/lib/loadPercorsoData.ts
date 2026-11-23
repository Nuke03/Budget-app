import type { SupabaseClient } from '@supabase/supabase-js';
import { format } from 'date-fns';
import {
  calcolaNumeriDisponibile,
  casaOpzionale,
  categorieConPartenza,
  loadHomeBase,
  pivaOpzionale,
  type HomeData,
} from '@/lib/loadHomeData';
import { getAccounts } from '@/lib/data/accounts';
import { getOpenGoals } from '@/lib/data/goals';
import { getLastIncomeDate, getTransactions } from '@/lib/data/transactions';
import { getSpecoCollegatoPerObiettivi } from '@/lib/data/goalSpending';
import { getConfermePerObiettivi, type ConfermeObiettivo } from '@/lib/data/goalVersamenti';
import { leggiRientriESpostamenti } from '@/lib/data/rientriLetti';
import { PERSONALE } from '@/lib/data/scope';
import { getPivaSettings } from '@/lib/data/pivaSettings';
import { leggiPercorso } from '@/lib/data/percorso';
import { accantonatoObiettivo } from '@/lib/calculations/accantonato';
import { inizioMesiFa } from '@/lib/pivaHome';
import { statoPrimiPassi } from '@/lib/calculations/percorso/passi';
import type { StatiLezioni } from '@/lib/percorso/tipi';
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

type DatiPercorso = DatiRegole & { primiPassi: PrimiPassi; conti: Account[]; riservati: HomeData['riservati'] };

// Gli stessi dati di loadPercorsoData con meno letture: per Impara e per il dopo-salvataggio, che non
// mostrano la Home. Niente lista d'attesa, promemoria, ultima creazione, scadenze e fatture P.IVA, e della
// casa solo lo stato (la riserva e i debiti, che servono al disponibile). I numeri vengono dallo stesso
// calcolo della Home (`calcolaNumeriDisponibile`): non possono divergere.
export async function loadPercorsoLeggero(
  supabase: SupabaseClient,
  today: Date = new Date(),
  userId: string | null = null
): Promise<DatiPercorso> {
  const oggi = oggiRomaISO(today);
  const obiettivi = getOpenGoals(supabase);
  const pivaSettings = getPivaSettings(supabase).catch(() => null);
  const [contiLetti, categorie, goals, speso, conferme, ultimaEntrata, casa, transazioni, pivaLetta, percorso, pivaImpostazioni, rientriGrezzi] =
    await Promise.all([
      getAccounts(supabase),
      categorieConPartenza(supabase),
      obiettivi,
      obiettivi.then((g) => getSpecoCollegatoPerObiettivi(supabase, g, today, PERSONALE)),
      obiettivi.then((g) => getConfermePerObiettivi(supabase, g, today)).catch(() => ({}) as Record<string, ConfermeObiettivo>),
      getLastIncomeDate(supabase),
      casaOpzionale(supabase, userId, today, true),
      getTransactions(supabase, PERSONALE, { da: inizioMesiFa(oggi, 3) }),
      pivaOpzionale(supabase, pivaSettings, today, () => {}, true),
      leggiPercorso(supabase).catch(() => ({ utente: null, lezioni: {} as StatiLezioni })),
      pivaSettings,
      leggiRientriESpostamenti(supabase),
    ]);
  const n = calcolaNumeriDisponibile({
    contiLetti,
    goals,
    speso,
    conferme,
    rientriGrezzi,
    pivaLetta,
    stato: casa?.stato ?? null,
    transazioni,
    today,
  });
  const goalsConAccantonato = n.goalsConSpeso.map((g) => ({ ...g, accantonato: accantonatoObiettivo(g, today) }));
  const primiPassi = statoPrimiPassi({
    conti: n.accounts,
    goals: goalsConAccantonato,
    percorso: percorso.utente,
    pivaGuidata: !!pivaImpostazioni?.guidataDal,
    oggi,
  });
  return {
    oggi,
    transazioni,
    categorie,
    goals: goalsConAccantonato,
    lezioni: percorso.lezioni,
    percorso: percorso.utente,
    disponibileReale: n.disponibileReale,
    disponibileLibero: n.disponibileLibero,
    ultimaEntrataIl: ultimaEntrata ? format(ultimaEntrata, 'yyyy-MM-dd') : null,
    primiPassiVisibili: primiPassi.visibile,
    primiPassi,
    conti: n.accounts,
    riservati: n.riservati,
  };
}
