import type { SupabaseClient } from '@supabase/supabase-js';
import { createGoal } from './goals';
import { casa } from './scope';
import type { BudgetGoal, PlanItem } from '../types';

// Mette da parte una bolletta: crea il fondo della casa e lo collega alla voce del piano.
// Se il collegamento fallisce l'errore sale ma il fondo resta: la pagina lo riconosce da sola
// (stessa categoria e stesso nome) e basta riprovare.
export async function creaFondoBolletta(
  supabase: SupabaseClient,
  input: { householdId: string; item: PlanItem; scadenza: string; oggi: string }
): Promise<BudgetGoal> {
  const { householdId, item, scadenza, oggi } = input;
  if (!item.categoriaId) throw new Error('voce senza categoria');
  const fondo = await createGoal(
    supabase,
    {
      nome: item.nome,
      importoTarget: item.importoRicorrenza,
      modalita: 'dilazionato',
      scadenza,
      categoriaId: item.categoriaId,
      ricorrente: true,
      frequenzaMesi: item.frequenzaMesi,
      accantonaDa: oggi,
    },
    casa(householdId)
  );
  const { error } = await supabase.rpc('link_plan_item_goal', {
    p_household: householdId,
    p_item: item.id,
    p_goal: fondo.id,
  });
  if (error) throw error;
  return fondo;
}
