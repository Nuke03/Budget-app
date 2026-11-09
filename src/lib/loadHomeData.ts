import type { SupabaseClient } from '@supabase/supabase-js';
import { getAccounts } from '@/lib/data/accounts';
import { getCategories } from '@/lib/data/categories';
import { getOpenGoals } from '@/lib/data/goals';
import { getLastIncomeDate } from '@/lib/data/transactions';
import { getSpecoCollegato } from '@/lib/data/goalSpending';
import { computeDisponibileLibero } from '@/lib/calculations/disponibile';
import { computeMargineGiornaliero } from '@/lib/calculations/margine';
import { stimaDataTarget } from '@/lib/calculations/stimaDataTarget';
import { computeAccantonatoFinora } from '@/lib/calculations/accantonato';
import { getMyHousehold } from '@/lib/data/households';
import { loadCasaAggiunta, type CasaAggiunta } from '@/lib/loadCasaData';
import { loadCasaStato, type CasaStato } from '@/lib/loadCasaStato';
import type { Account, BudgetGoal, Category } from '@/lib/types';

export interface CasaPerHome {
  aggiunta: CasaAggiunta;
  stato: CasaStato;
}

export interface HomeData {
  disponibileLibero: number;
  margineGiornaliero: number;
  dataTarget: Date;
  accounts: Account[];
  categories: Category[];
  goals: (BudgetGoal & { accantonato: number })[];
  casa: CasaPerHome | null;
}

// La parte di casa non deve mai rompere la home personale: se non si riesce a
// leggerla, la home si apre senza il selettore Casa e senza riserva.
async function casaOpzionale(
  supabase: SupabaseClient,
  userId: string | null,
  now: Date
): Promise<CasaPerHome | null> {
  if (!userId) return null;
  try {
    const corrente = await getMyHousehold(supabase, userId);
    if (!corrente) return null;
    const [aggiunta, stato] = await Promise.all([
      loadCasaAggiunta(supabase, corrente),
      loadCasaStato(supabase, corrente, now),
    ]);
    return { aggiunta, stato };
  } catch {
    return null;
  }
}

// Tutto ciò che la home mostra: solo dati personali (scope di default).
export async function loadHomeData(
  supabase: SupabaseClient,
  today: Date = new Date(),
  userId: string | null = null
): Promise<HomeData> {
  const [accounts, categories, goals, ultimaEntrata, casa] = await Promise.all([
    getAccounts(supabase),
    getCategories(supabase),
    getOpenGoals(supabase),
    getLastIncomeDate(supabase),
    casaOpzionale(supabase, userId, today),
  ]);

  // Quanto di ogni obiettivo è già stato speso (transazioni esplicitamente
  // collegate): va sottratto da quanto resta riservato, altrimenti quei soldi
  // verrebbero contati sia come spesi dal conto sia come ancora bloccati.
  const speseCollegate = await Promise.all(
    goals.map((g) => getSpecoCollegato(supabase, g, today))
  );
  const goalsConSpeso = goals.map((g, i) => ({ ...g, specoCollegato: speseCollegate[i] }));

  const disponibileLibero = computeDisponibileLibero(
    accounts,
    goalsConSpeso,
    today,
    casa?.stato.riservaVersamento ?? 0,
    casa?.stato.debitoDaRestituire ?? 0
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

  return {
    disponibileLibero,
    margineGiornaliero,
    dataTarget,
    accounts,
    categories,
    goals: goalsWithAccantonato,
    casa,
  };
}
