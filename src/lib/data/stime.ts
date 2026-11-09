import type { SupabaseClient } from '@supabase/supabase-js';
import type { BudgetGoal } from '../types';
import { pianoConStimaAggiornata, type PropostaStima } from '../calculations/casa/stimaVsReale';
import { updateGoal } from './goals';
import { savePlan, type PlanBundle } from './householdPlans';

// Ricorda che la stima è stata ignorata quando le spese reali erano n: si ripropone solo con una in più.
export async function ignoraStima(
  supabase: SupabaseClient,
  householdId: string,
  itemId: string,
  n: number,
): Promise<void> {
  const { error } = await supabase.rpc('set_plan_item_stima_ignorata', {
    p_household: householdId,
    p_item: itemId,
    p_n: n,
  });
  if (error) throw error;
}

// Prima l'obiettivo collegato (se c'è), poi il piano: se il primo passo fallisce il piano non cambia,
// e si può riprovare perché entrambi i passi scrivono gli stessi valori.
export async function applicaStima(
  supabase: SupabaseClient,
  input: {
    householdId: string;
    bundle: PlanBundle;
    proposta: PropostaStima;
    goal: BudgetGoal | null;
    validoDal: string;
  },
): Promise<void> {
  const { householdId, bundle, proposta, goal, validoDal } = input;
  const versione = pianoConStimaAggiornata(bundle, proposta, validoDal);
  if (!versione) throw new Error('piano non aggiornabile');

  if (goal) {
    await updateGoal(supabase, goal.id, {
      nome: goal.nome,
      importoTarget: proposta.nuovoImportoRicorrenza,
      modalita: goal.modalita,
      scadenza: goal.scadenza,
      categoriaId: goal.categoriaId,
      ricorrente: goal.ricorrente,
      frequenzaMesi: goal.frequenzaMesi,
    });
  }
  await savePlan(supabase, householdId, [versione]);
}
