import type { SupabaseClient } from '@supabase/supabase-js';
import type { Category, CategoriaTipo } from '../types';
import { applyScope, PERSONALE, scopeHouseholdId, type Scope } from './scope';

interface CategoryRow {
  id: string;
  nome: string;
  tipo: CategoriaTipo;
  colore: string | null;
  archiviata: boolean;
}

function mapRow(row: CategoryRow): Category {
  return {
    id: row.id,
    nome: row.nome,
    tipo: row.tipo,
    colore: row.colore,
    archiviata: row.archiviata,
  };
}

export async function getCategories(supabase: SupabaseClient, scope: Scope = PERSONALE): Promise<Category[]> {
  const { data, error } = await applyScope(
    supabase.from('categories').select('id, nome, tipo, colore, archiviata'),
    scope
  ).order('nome');

  if (error) throw error;
  return (data as CategoryRow[]).map(mapRow);
}

export async function createCategory(
  supabase: SupabaseClient,
  input: { nome: string; tipo: CategoriaTipo; colore: string | null },
  scope: Scope = PERSONALE
): Promise<Category> {
  const { data, error } = await supabase
    .from('categories')
    .insert({
      nome: input.nome,
      tipo: input.tipo,
      colore: input.colore,
      archiviata: false,
      household_id: scopeHouseholdId(scope),
    })
    .select('id, nome, tipo, colore, archiviata')
    .single();

  if (error) throw error;
  return mapRow(data as CategoryRow);
}

export async function updateCategory(
  supabase: SupabaseClient,
  id: string,
  input: { nome: string; colore: string | null }
): Promise<Category> {
  // household: per id
  const { data, error } = await supabase
    .from('categories')
    .update({ nome: input.nome, colore: input.colore })
    .eq('id', id)
    .select('id, nome, tipo, colore, archiviata')
    .single();

  if (error) throw error;
  return mapRow(data as CategoryRow);
}

export async function archiveCategory(supabase: SupabaseClient, id: string): Promise<void> {
  // household: per id
  const { error } = await supabase.from('categories').update({ archiviata: true }).eq('id', id);
  if (error) throw error;
}
