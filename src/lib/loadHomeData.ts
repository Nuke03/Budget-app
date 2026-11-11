import type { SupabaseClient } from '@supabase/supabase-js';
import { getAccounts } from '@/lib/data/accounts';
import { getCategories } from '@/lib/data/categories';
import { getOpenGoals } from '@/lib/data/goals';
import { getLastIncomeDate, getTransactions } from '@/lib/data/transactions';
import { getSpecoCollegatoPerObiettivi } from '@/lib/data/goalSpending';
import { PERSONALE } from '@/lib/data/scope';
import { computeDisponibileLibero } from '@/lib/calculations/disponibile';
import { computeMargineGiornaliero } from '@/lib/calculations/margine';
import { stimaDataTarget } from '@/lib/calculations/stimaDataTarget';
import { computeAccantonatoFinora } from '@/lib/calculations/accantonato';
import { leggiPromemoriaUtente } from '@/lib/data/notifiche';
import { oggiRomaISO } from '@/lib/calculations/casa/oggi';
import { calcolaAndamento, type Andamento } from '@/lib/calculations/supporto/andamento';
import { scegliConsiglio, obiettiviCorti, type Consiglio } from '@/lib/calculations/supporto/consiglio';
import { periodoDaRecuperare } from '@/lib/calculations/supporto/notifiche';
import {
  righeLibretto,
  prossimaCosa,
  promemoriaDaCasa,
  type RigaLibretto,
  type Prossimo,
} from '@/lib/calculations/supporto/home';
import { getMyHousehold } from '@/lib/data/households';
import { loadCasaAggiunta, type CasaAggiunta } from '@/lib/loadCasaData';
import { loadCasaStato, type CasaStato } from '@/lib/loadCasaStato';
import type { Account, BudgetGoal, Category, Transaction } from '@/lib/types';

// Le due parti si leggono a parte: se manca lo stato, la casa esiste ma il disponibile
// personale non tiene conto della quota (la home lo dice).
export interface CasaPerHome {
  aggiunta: CasaAggiunta | null;
  stato: CasaStato | null;
}

export interface HomeData {
  disponibileLibero: number;
  margineGiornaliero: number;
  dataTarget: Date;
  accounts: Account[];
  categories: Category[];
  goals: (BudgetGoal & { accantonato: number })[];
  casa: CasaPerHome | null;
  righe: RigaLibretto[];
  // Le transazioni dei 3 mesi già lette per la Home: da qui si indovina la categoria di una nuova spesa.
  storico: Pick<Transaction, 'descrizione' | 'categoriaId' | 'data' | 'tipo'>[];
  andamento: Andamento;
  consiglio: Consiglio;
  prossimo: Prossimo | null;
  // null: non ha ancora risposto (o non si legge).
  notificheAttive: boolean | null;
}

// Primo giorno del mese di 3 mesi fa (YYYY-MM-DD), da un giorno YYYY-MM-DD.
function inizioFinestra(oggi: string): string {
  const totale = Number(oggi.slice(0, 4)) * 12 + (Number(oggi.slice(5, 7)) - 1) - 3;
  return `${Math.floor(totale / 12)}-${String((totale % 12) + 1).padStart(2, '0')}-01`;
}

// La parte di casa non deve mai rompere la home personale. Se non si legge la casa corrente
// si apre come senza casa; se si legge ma non il suo stato, si tiene il numero personale e
// si segnala che la quota non è inclusa.
async function casaOpzionale(
  supabase: SupabaseClient,
  userId: string | null,
  now: Date
): Promise<CasaPerHome | null> {
  if (!userId) return null;
  let corrente;
  try {
    corrente = await getMyHousehold(supabase, userId);
  } catch {
    return null;
  }
  if (!corrente) return null;
  const [aggiunta, stato] = await Promise.all([
    loadCasaAggiunta(supabase, corrente).catch(() => null),
    loadCasaStato(supabase, corrente, now).catch(() => null),
  ]);
  return { aggiunta, stato };
}

// Tutto ciò che la home mostra: solo dati personali (scope di default).
export async function loadHomeData(
  supabase: SupabaseClient,
  today: Date = new Date(),
  userId: string | null = null
): Promise<HomeData> {
  // Tutto parte insieme; lo speso collegato agli obiettivi segue subito la lettura degli obiettivi
  // (una sola query per tutti), senza aspettare la parte di casa.
  const obiettivi = getOpenGoals(supabase);
  const oggi = oggiRomaISO(today);
  const [accounts, categories, goals, speso, ultimaEntrata, casa, transazioni, scelte] = await Promise.all([
    getAccounts(supabase),
    getCategories(supabase),
    obiettivi,
    // Quanto di ogni obiettivo è già stato speso (transazioni esplicitamente
    // collegate): va sottratto da quanto resta riservato, altrimenti quei soldi
    // verrebbero contati sia come spesi dal conto sia come ancora bloccati.
    obiettivi.then((g) => getSpecoCollegatoPerObiettivi(supabase, g, today, PERSONALE)),
    getLastIncomeDate(supabase),
    casaOpzionale(supabase, userId, today),
    // Una sola lettura: righe, andamento, stime e ultimo giorno segnato.
    getTransactions(supabase, PERSONALE, { da: inizioFinestra(oggi) }),
    // Le scelte sui promemoria non devono rompere la home.
    leggiPromemoriaUtente(supabase).catch(() => ({ notificheAttive: null, nessunaSpesaFinoAl: null })),
  ]);
  const goalsConSpeso = goals.map((g) => ({ ...g, specoCollegato: speso[g.id] ?? 0 }));

  const disponibileLibero = computeDisponibileLibero(
    accounts,
    goalsConSpeso,
    today,
    casa?.stato?.riservaVersamento ?? 0,
    casa?.stato?.debitoDaRestituire ?? 0
  );
  const dataTarget = stimaDataTarget(ultimaEntrata, today);
  const margineGiornaliero = computeMargineGiornaliero(disponibileLibero, dataTarget, today);

  // Il breakdown mostrato in HomeDashboard deve riconciliarsi con `disponibileLibero`:
  // per gli obiettivi dilazionati questo significa mostrare quanto è stato effettivamente
  // accantonato finora (non l'intero importoTarget), esattamente come fa computeDisponibileLibero.
  const goalsWithAccantonato = goalsConSpeso.map((g) => ({
    ...g,
    accantonato: computeAccantonatoFinora(g, today, g.specoCollegato),
  }));

  const andamento = calcolaAndamento(transazioni, oggi);
  const spesoStime = transazioni
    .filter((t) => t.tipo === 'expense' && t.stima && t.data.slice(0, 7) === oggi.slice(0, 7) && t.data <= oggi)
    .reduce((tot, t) => tot + t.importo, 0);
  const consiglio = scegliConsiglio({
    andamento,
    spesoStime,
    nomiCategorie: Object.fromEntries(categories.map((c) => [c.id, c.nome])),
    obiettiviCorti: obiettiviCorti(goalsConSpeso, disponibileLibero, today),
    oggi,
  });
  const ultimaCreazione = transazioni.reduce<string | null>(
    (max, t) => (max === null || t.createdAt > max ? t.createdAt : max),
    null
  );
  const inPari = periodoDaRecuperare(
    ultimaCreazione ? oggiRomaISO(new Date(ultimaCreazione)) : null,
    scelte.nessunaSpesaFinoAl,
    oggi
  );
  const prossimo = prossimaCosa({
    inPari,
    promemoriaCasa: promemoriaDaCasa(casa, oggi).map((p) => ({ testo: p.testo, href: p.azione?.href })),
  });

  return {
    disponibileLibero,
    margineGiornaliero,
    dataTarget,
    accounts,
    categories,
    goals: goalsWithAccantonato,
    casa,
    righe: righeLibretto(transazioni, oggi),
    storico: transazioni.map((t) => ({
      descrizione: t.descrizione,
      categoriaId: t.categoriaId,
      data: t.data,
      tipo: t.tipo,
    })),
    andamento,
    consiglio,
    prossimo,
    notificheAttive: scelte.notificheAttive,
  };
}
