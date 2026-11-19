import type { SupabaseClient } from '@supabase/supabase-js';
import type { BudgetGoal, GoalModalita } from '../types';
import { applyScope, PERSONALE, scopeHouseholdId, type Scope } from './scope';

const GOAL_COLUMNS =
  'id, nome, importo_target, modalita, scadenza, categoria_id, ricorrente, frequenza_mesi, stato, created_at, accantona_da, ruolo';

interface GoalRow {
  id: string;
  nome: string;
  importo_target: number;
  modalita: GoalModalita;
  scadenza: string | null;
  categoria_id: string | null;
  ricorrente: boolean;
  frequenza_mesi: number | null;
  stato: 'aperto' | 'chiuso' | 'scaduto';
  created_at: string;
  accantona_da: string | null;
  ruolo?: 'imprevisti' | null;
}

function mapRow(row: GoalRow): BudgetGoal {
  return {
    id: row.id,
    nome: row.nome,
    importoTarget: row.importo_target,
    modalita: row.modalita,
    scadenza: row.scadenza,
    categoriaId: row.categoria_id,
    ricorrente: row.ricorrente,
    frequenzaMesi: row.frequenza_mesi,
    stato: row.stato,
    createdAt: row.created_at,
    accantonaDa: row.accantona_da,
    ruolo: row.ruolo ?? null,
  };
}

export async function getOpenGoals(supabase: SupabaseClient, scope: Scope = PERSONALE): Promise<BudgetGoal[]> {
  const { data, error } = await applyScope(supabase.from('budget_goals').select(GOAL_COLUMNS), scope)
    .eq('stato', 'aperto')
    .order('scadenza', { ascending: true });

  if (error) throw error;
  return (data as GoalRow[]).map(mapRow);
}

// Un obiettivo personale di questo utente per id, aperto o chiuso. null se non c'è o non è suo.
export async function getGoalPersonale(
  supabase: SupabaseClient,
  id: string,
  userId: string
): Promise<BudgetGoal | null> {
  const { data, error } = await applyScope(supabase.from('budget_goals').select(GOAL_COLUMNS), PERSONALE)
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapRow(data as GoalRow) : null;
}

export async function createGoal(
  supabase: SupabaseClient,
  input: {
    nome: string;
    importoTarget: number;
    modalita: GoalModalita;
    scadenza: string | null;
    categoriaId: string | null;
    ricorrente: boolean;
    frequenzaMesi: number | null;
    accantonaDa?: string | null;
    ruolo?: 'imprevisti' | null;
  },
  scope: Scope = PERSONALE
): Promise<BudgetGoal> {
  const { data, error } = await supabase
    .from('budget_goals')
    .insert({
      nome: input.nome,
      importo_target: input.importoTarget,
      modalita: input.modalita,
      scadenza: input.scadenza,
      categoria_id: input.categoriaId,
      ricorrente: input.ricorrente,
      frequenza_mesi: input.frequenzaMesi,
      stato: 'aperto',
      accantona_da: input.accantonaDa ?? null,
      ruolo: input.ruolo ?? null,
      household_id: scopeHouseholdId(scope),
    })
    .select(GOAL_COLUMNS)
    .single();

  if (error) throw error;
  return mapRow(data as GoalRow);
}

export async function updateGoal(
  supabase: SupabaseClient,
  id: string,
  input: {
    nome: string;
    importoTarget: number;
    modalita: GoalModalita;
    scadenza: string | null;
    categoriaId: string | null;
    ricorrente: boolean;
    frequenzaMesi: number | null;
  }
): Promise<BudgetGoal> {
  // household: per id
  const { data, error } = await supabase
    .from('budget_goals')
    .update({
      nome: input.nome,
      importo_target: input.importoTarget,
      modalita: input.modalita,
      scadenza: input.scadenza,
      categoria_id: input.categoriaId,
      ricorrente: input.ricorrente,
      frequenza_mesi: input.frequenzaMesi,
    })
    .eq('id', id)
    .select(GOAL_COLUMNS)
    .single();

  if (error) throw error;
  return mapRow(data as GoalRow);
}

export async function closeGoal(supabase: SupabaseClient, id: string): Promise<void> {
  // household: per id
  const { error } = await supabase.from('budget_goals').update({ stato: 'chiuso' }).eq('id', id);
  if (error) throw error;
}

// Annulla una chiusura (solo per rimediare a un errore a metà di un'operazione).
export async function reopenGoal(supabase: SupabaseClient, id: string): Promise<void> {
  // household: per id
  const { error } = await supabase.from('budget_goals').update({ stato: 'aperto' }).eq('id', id);
  if (error) throw error;
}

// Cambia solo traguardo e scadenza, come il cuscinetto che si allunga dopo una spesa.
export async function updateGoalPiano(
  supabase: SupabaseClient,
  id: string,
  input: { importoTarget: number; scadenza: string }
): Promise<void> {
  // household: per id
  const { error } = await supabase
    .from('budget_goals')
    .update({ importo_target: input.importoTarget, scadenza: input.scadenza })
    .eq('id', id);
  if (error) throw error;
}
