import type { SupabaseClient } from '@supabase/supabase-js';
import { format } from 'date-fns';
import { computeFinestraGoal } from '../calculations/accantonato';
import { getTransactionAmountsForGoal } from './transactions';
import type { BudgetGoal } from '../types';

export async function getSpecoCollegato(
  supabase: SupabaseClient,
  goal: BudgetGoal,
  today: Date
): Promise<number> {
  const { windowStart, windowEnd } = computeFinestraGoal(goal, today);
  const importi = await getTransactionAmountsForGoal(
    supabase,
    goal.id,
    format(windowStart, 'yyyy-MM-dd'),
    windowEnd ? format(windowEnd, 'yyyy-MM-dd') : null
  );
  return importi.reduce((sum, v) => sum + v, 0);
}
