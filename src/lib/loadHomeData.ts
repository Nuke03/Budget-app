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
import type { Account, BudgetGoal, Category } from '@/lib/types';

export interface HomeData {
  disponibileLibero: number;
  margineGiornaliero: number;
  dataTarget: Date;
  accounts: Account[];
  categories: Category[];
  goals: (BudgetGoal & { accantonato: number })[];
}

// Tutto ciò che la home mostra: solo dati personali (scope di default).
export async function loadHomeData(
  supabase: SupabaseClient,
  today: Date = new Date()
): Promise<HomeData> {
  const [accounts, categories, goals, ultimaEntrata] = await Promise.all([
    getAccounts(supabase),
    getCategories(supabase),
    getOpenGoals(supabase),
    getLastIncomeDate(supabase),
  ]);

  // Quanto di ogni obiettivo è già stato speso (transazioni esplicitamente
  // collegate): va sottratto da quanto resta riservato, altrimenti quei soldi
  // verrebbero contati sia come spesi dal conto sia come ancora bloccati.
  const speseCollegate = await Promise.all(
    goals.map((g) => getSpecoCollegato(supabase, g, today))
  );
  const goalsConSpeso = goals.map((g, i) => ({ ...g, specoCollegato: speseCollegate[i] }));

  const disponibileLibero = computeDisponibileLibero(accounts, goalsConSpeso, today);
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
  };
}
