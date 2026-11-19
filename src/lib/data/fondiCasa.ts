import type { SupabaseClient } from '@supabase/supabase-js';
import { createGoal, getGoalCasa } from './goals';
import { casa } from './scope';
import type { BudgetGoal, PlanItem } from '../types';

// Mette da parte una bolletta: il fondo ricorrente della voce si cerca o si crea e si collega alla voce
// in un colpo solo, dentro il database (crea_fondo_bolletta, con un blocco): due soci che toccano
// "Metti da parte" insieme ottengono lo stesso fondo. Ripetere dopo un errore non duplica niente.
export async function creaFondoBolletta(
  supabase: SupabaseClient,
  input: { householdId: string; item: PlanItem; scadenza: string; oggi: string }
): Promise<BudgetGoal> {
  const { householdId, item, scadenza, oggi } = input;
  if (!item.categoriaId) throw new Error('voce senza categoria');
  const { data, error } = await supabase.rpc('crea_fondo_bolletta', {
    p_household: householdId,
    p_item: item.id,
    p_scadenza: scadenza,
    p_oggi: oggi,
  });
  if (error) throw error;
  const fondo = await getGoalCasa(supabase, data as string, householdId);
  if (!fondo) throw new Error('fondo non trovato');
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
