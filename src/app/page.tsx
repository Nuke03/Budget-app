import { createClient } from '@/lib/supabase/server';
import { getAccounts } from '@/lib/data/accounts';
import { getCategories } from '@/lib/data/categories';
import { getOpenGoals, } from '@/lib/data/goals';
import { getLastIncomeDate } from '@/lib/data/transactions';
import { getSpecoCollegato } from '@/lib/data/goalSpending';
import { computeDisponibileLibero } from '@/lib/calculations/disponibile';
import { computeMargineGiornaliero } from '@/lib/calculations/margine';
import { stimaDataTarget } from '@/lib/calculations/stimaDataTarget';
import { computeAccantonatoFinora } from '@/lib/calculations/accantonato';
import { HomeDashboard } from './HomeDashboard';

export default async function HomePage() {
  const supabase = await createClient();
  const [accounts, categories, goals, ultimaEntrata] = await Promise.all([
    getAccounts(supabase),
    getCategories(supabase),
    getOpenGoals(supabase),
    getLastIncomeDate(supabase),
  ]);

  const today = new Date();

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

  return (
    <HomeDashboard
      disponibileLibero={disponibileLibero}
      margineGiornaliero={margineGiornaliero}
      dataTarget={dataTarget.toISOString()}
      accounts={accounts}
      categories={categories}
      goals={goalsWithAccantonato}
    />
  );
}
