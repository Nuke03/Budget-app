import type { SupabaseClient } from '@supabase/supabase-js';
import { dataNellaFinestraSpese, finestraSpeseGoal, type FinestraSpese } from '../calculations/accantonato';
import { getTransactionAmountsForGoal } from './transactions';
import { applyScope, type Scope } from './scope';
import type { BudgetGoal } from '../types';

export async function getSpecoCollegato(
  supabase: SupabaseClient,
  goal: BudgetGoal,
  today: Date
): Promise<number> {
  const f = finestraSpeseGoal(goal, today);
  const importi = await getTransactionAmountsForGoal(supabase, goal.id, f.da, f.a, f.daEscluso);
  return importi.reduce((sum, v) => sum + v, 0);
}

// Lo speso collegato di tutti gli obiettivi di uno scope con una sola lettura
// (al posto di una per obiettivo): la query prende le spese dal primo inizio
// finestra in poi, poi si somma in JS dentro la finestra di ciascun obiettivo
// (stesse regole di getSpecoCollegato: per i ricorrenti l'inizio è escluso).
export async function getSpecoCollegatoPerObiettivi(
  supabase: SupabaseClient,
  goals: BudgetGoal[],
  today: Date,
  scope: Scope
): Promise<Record<string, number>> {
  if (goals.length === 0) return {};

  const finestre: (FinestraSpese & { id: string })[] = goals.map((g) => ({ id: g.id, ...finestraSpeseGoal(g, today) }));
  const minDa = finestre.reduce((m, f) => (f.da < m ? f.da : m), finestre[0].da);

  const { data, error } = await applyScope(
    supabase
      .from('transactions')
      .select('goal_id, importo, data')
      .in(
        'goal_id',
        goals.map((g) => g.id)
      )
      .eq('tipo', 'expense')
      .gte('data', minDa),
    scope
  );
  if (error) throw error;

  const righe = data as { goal_id: string; importo: number; data: string }[];
  const risultato: Record<string, number> = {};
  for (const f of finestre) {
    risultato[f.id] = righe
      .filter((r) => r.goal_id === f.id && dataNellaFinestraSpese(r.data, f))
      .reduce((sum, r) => sum + r.importo, 0);
  }
  return risultato;
}
