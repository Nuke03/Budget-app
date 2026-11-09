import type { SupabaseClient } from '@supabase/supabase-js';
import { createGoal, getOpenGoals } from './goals';
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
  // Un fondo aperto uguale c'è già (tentativo precedente o un altro membro): si collega quello.
  const aperti = await getOpenGoals(supabase, casa(householdId));
  const esistente = aperti.find(
    (g) =>
      g.ricorrente && g.categoriaId === item.categoriaId && g.nome.toLowerCase() === item.nome.toLowerCase()
  );
  const fondo =
    esistente ??
    (await createGoal(
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
    ));
  const { error } = await supabase.rpc('link_plan_item_goal', {
    p_household: householdId,
    p_item: item.id,
    p_goal: fondo.id,
  });
  if (error) throw error;
  return fondo;
}

// Una spesa da pagare una volta sola (anticipo, caparra, mobile): fondo graduale con scadenza.
export async function creaFondoUnaVolta(
  supabase: SupabaseClient,
  input: { householdId: string; nome: string; importo: number; scadenza: string; oggi: string }
): Promise<BudgetGoal> {
  return createGoal(
    supabase,
    {
      nome: input.nome,
      importoTarget: input.importo,
      modalita: 'dilazionato',
      scadenza: input.scadenza,
      categoriaId: null,
      ricorrente: false,
      frequenzaMesi: null,
      accantonaDa: input.oggi,
    },
    casa(input.householdId)
  );
}

// Un fondo per voce, in sequenza. I nomi già presenti si saltano, così ripetere dopo un errore a metà non duplica.
// onCreato dice alla pagina quali voci sono già state scritte anche se una successiva fallisce.
export async function creaFondiIngresso(
  supabase: SupabaseClient,
  input: {
    householdId: string;
    scadenza: string;
    oggi: string;
    voci: { nome: string; importo: number }[];
    esistenti: string[];
    onCreato?: (nome: string) => void;
  }
): Promise<BudgetGoal[]> {
  const presenti = new Set(input.esistenti.map((n) => n.trim().toLowerCase()));
  const creati: BudgetGoal[] = [];
  for (const v of input.voci) {
    if (!(v.importo > 0)) continue;
    if (presenti.has(v.nome.trim().toLowerCase())) continue;
    const fondo = await creaFondoUnaVolta(supabase, {
      householdId: input.householdId,
      nome: v.nome,
      importo: v.importo,
      scadenza: input.scadenza,
      oggi: input.oggi,
    });
    presenti.add(v.nome.trim().toLowerCase());
    creati.push(fondo);
    input.onCreato?.(v.nome);
  }
  return creati;
}
