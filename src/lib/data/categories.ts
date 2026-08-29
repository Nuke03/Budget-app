import type { SupabaseClient } from '@supabase/supabase-js';
import type { Category, CategoriaTipo } from '../types';

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

export async function getCategories(supabase: SupabaseClient): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('id, nome, tipo, colore, archiviata')
    .order('nome');

  if (error) throw error;
  return (data as CategoryRow[]).map(mapRow);
}

export async function createCategory(
  supabase: SupabaseClient,
  input: { nome: string; tipo: CategoriaTipo; colore: string | null }
): Promise<Category> {
  const { data, error } = await supabase
    .from('categories')
    .insert({ nome: input.nome, tipo: input.tipo, colore: input.colore, archiviata: false })
    .select('id, nome, tipo, colore, archiviata')
    .single();

  if (error) throw error;
  return mapRow(data as CategoryRow);
}

export async function archiveCategory(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from('categories').update({ archiviata: true }).eq('id', id);
  if (error) throw error;
}
