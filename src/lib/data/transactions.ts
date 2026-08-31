import type { SupabaseClient } from '@supabase/supabase-js';
import { parseISO } from 'date-fns';
import type { Transaction, TransactionTipo } from '../types';

interface TransactionRow {
  id: string;
  tipo: TransactionTipo;
  importo: number;
  data: string;
  categoria_id: string | null;
  account_id: string | null;
  goal_id: string | null;
  descrizione: string;
  nota: string | null;
  created_at: string;
}

function mapRow(row: TransactionRow): Transaction {
  return {
    id: row.id,
    tipo: row.tipo,
    importo: row.importo,
    data: row.data,
    categoriaId: row.categoria_id,
    accountId: row.account_id,
    goalId: row.goal_id,
    descrizione: row.descrizione,
    nota: row.nota,
    createdAt: row.created_at,
  };
}

export async function getTransactions(supabase: SupabaseClient): Promise<Transaction[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('id, tipo, importo, data, categoria_id, account_id, goal_id, descrizione, nota, created_at')
    .order('data', { ascending: false });

  if (error) throw error;
  return (data as TransactionRow[]).map(mapRow);
}

export async function createTransaction(
  supabase: SupabaseClient,
  input: {
    tipo: TransactionTipo;
    importo: number;
    data: string;
    categoriaId: string | null;
    accountId: string | null;
    goalId: string | null;
    descrizione: string;
    nota: string | null;
  }
): Promise<Transaction> {
  const { data, error } = await supabase
    .from('transactions')
    .insert({
      tipo: input.tipo,
      importo: input.importo,
      data: input.data,
      categoria_id: input.categoriaId,
      account_id: input.accountId,
      goal_id: input.goalId,
      descrizione: input.descrizione,
      nota: input.nota,
    })
    .select('id, tipo, importo, data, categoria_id, account_id, goal_id, descrizione, nota, created_at')
    .single();

  if (error) throw error;
  return mapRow(data as TransactionRow);
}

export async function updateTransaction(
  supabase: SupabaseClient,
  id: string,
  input: {
    tipo: TransactionTipo;
    importo: number;
    data: string;
    categoriaId: string | null;
    accountId: string | null;
    goalId: string | null;
    descrizione: string;
    nota: string | null;
  }
): Promise<Transaction> {
  const { data, error } = await supabase
    .from('transactions')
    .update({
      tipo: input.tipo,
      importo: input.importo,
      data: input.data,
      categoria_id: input.categoriaId,
      account_id: input.accountId,
      goal_id: input.goalId,
      descrizione: input.descrizione,
      nota: input.nota,
    })
    .eq('id', id)
    .select('id, tipo, importo, data, categoria_id, account_id, goal_id, descrizione, nota, created_at')
    .single();

  if (error) throw error;
  return mapRow(data as TransactionRow);
}

export async function deleteTransaction(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from('transactions').delete().eq('id', id);
  if (error) throw error;
}

export async function getLastIncomeDate(supabase: SupabaseClient): Promise<Date | null> {
  const { data, error } = await supabase
    .from('transactions')
    .select('data')
    .eq('tipo', 'income')
    .order('data', { ascending: false });

  if (error) throw error;
  const rows = data as { data: string }[];
  if (rows.length === 0) return null;
  return parseISO(rows[0].data);
}

export async function getRecentTransactionAmounts(
  supabase: SupabaseClient,
  categoriaId: string,
  limite: number,
  parolaChiave?: string | null
): Promise<number[]> {
  let query = supabase
    .from('transactions')
    .select('importo')
    .eq('categoria_id', categoriaId)
    .eq('tipo', 'expense');

  if (parolaChiave) {
    query = query.ilike('descrizione', `%${parolaChiave}%`);
  }

  const { data, error } = await query.limit(limite).order('data', { ascending: false });

  if (error) throw error;
  return (data as { importo: number }[]).map((row) => row.importo);
}
