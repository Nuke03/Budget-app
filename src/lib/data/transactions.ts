import type { SupabaseClient } from '@supabase/supabase-js';
import { parseISO } from 'date-fns';
import type { Transaction, TransactionTipo } from '../types';
import { applyScope, PERSONALE, scopeHouseholdId, type Scope } from './scope';
import { leggiTutte } from './leggiTutte';

const TRANSACTION_COLUMNS =
  'id, tipo, importo, data, categoria_id, account_id, goal_id, descrizione, nota, created_at, pagata_da_user_id, origine, user_id';

// Tetto di sicurezza alla lettura: bastano le spese recenti per una stima.
const LIMITE_SPESE_STIME = 1000;

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
  pagata_da_user_id: string | null;
  origine: 'riconciliazione' | null;
  user_id: string;
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
    pagataDaUserId: row.pagata_da_user_id,
    origine: row.origine,
    userId: row.user_id,
  };
}

// Filtri opzionali sulla lettura: un intervallo di date (estremi inclusi) e il tipo.
export interface FiltroTransazioni {
  da?: string;
  a?: string;
  tipo?: TransactionTipo;
}

// Tutte le transazioni dello scope che passano il filtro, a pagine (mai troncate a 1000 righe).
export async function getTransactions(
  supabase: SupabaseClient,
  scope: Scope = PERSONALE,
  filtro: FiltroTransazioni = {}
): Promise<Transaction[]> {
  const righe = await leggiTutte<TransactionRow>((da, a) => {
    let q = applyScope(supabase.from('transactions').select(TRANSACTION_COLUMNS), scope);
    if (filtro.da) q = q.gte('data', filtro.da);
    if (filtro.a) q = q.lte('data', filtro.a);
    if (filtro.tipo) q = q.eq('tipo', filtro.tipo);
    return q
      .order('data', { ascending: false })
      .order('created_at', { ascending: false })
      .order('id', { ascending: true })
      .range(da, a);
  });
  return righe.map(mapRow);
}

// Le spese della casa pagate di tasca propria da un membro: le sole che servono al credito
// verso la casa (creditoMembro), senza leggere tutto lo storico della casa.
export async function getSpeseAnticipateCasa(
  supabase: SupabaseClient,
  householdId: string
): Promise<Pick<Transaction, 'tipo' | 'importo' | 'pagataDaUserId'>[]> {
  const righe = await leggiTutte<{ id: string; importo: number; pagata_da_user_id: string }>((da, a) =>
    applyScope(supabase.from('transactions').select('id, importo, pagata_da_user_id'), {
      kind: 'casa',
      householdId,
    })
      .eq('tipo', 'expense')
      .not('pagata_da_user_id', 'is', null)
      .order('id', { ascending: true })
      .range(da, a)
  );
  return righe.map((r) => ({ tipo: 'expense' as const, importo: r.importo, pagataDaUserId: r.pagata_da_user_id }));
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
    // Solo con scope casa: chi ha pagato di tasca sua (il vincolo SQL vuole l'autore e il suo conto personale).
    pagataDaUserId?: string | null;
  },
  scope: Scope = PERSONALE
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
      household_id: scopeHouseholdId(scope),
      ...(scopeHouseholdId(scope) && input.pagataDaUserId ? { pagata_da_user_id: input.pagataDaUserId } : {}),
    })
    .select(TRANSACTION_COLUMNS)
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
  // household: per id
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
    .select(TRANSACTION_COLUMNS)
    .single();

  if (error) throw error;
  return mapRow(data as TransactionRow);
}

export async function deleteTransaction(supabase: SupabaseClient, id: string): Promise<void> {
  // household: per id
  const { error } = await supabase.from('transactions').delete().eq('id', id);
  if (error) throw error;
}

export async function getLastIncomeDate(
  supabase: SupabaseClient,
  scope: Scope = PERSONALE
): Promise<Date | null> {
  const { data, error } = await applyScope(supabase.from('transactions').select('data'), scope)
    .eq('tipo', 'income')
    .order('data', { ascending: false })
    .limit(1);

  if (error) throw error;
  const rows = data as { data: string }[];
  if (rows.length === 0) return null;
  return parseISO(rows[0].data);
}

export async function getRecentTransactionAmounts(
  supabase: SupabaseClient,
  categoriaId: string,
  limite: number,
  parolaChiave?: string | null,
  scope: Scope = PERSONALE
): Promise<number[]> {
  let query = applyScope(supabase.from('transactions').select('importo'), scope)
    .eq('categoria_id', categoriaId)
    .eq('tipo', 'expense');

  if (parolaChiave) {
    query = query.ilike('descrizione', `%${parolaChiave}%`);
  }

  const { data, error } = await query.limit(limite).order('data', { ascending: false });

  if (error) throw error;
  return (data as { importo: number }[]).map((row) => row.importo);
}

export async function getTransactionAmountsForGoal(
  supabase: SupabaseClient,
  goalId: string,
  da: string,
  a: string | null
): Promise<number[]> {
  // household: per id
  let query = supabase
    .from('transactions')
    .select('importo')
    .eq('goal_id', goalId)
    .eq('tipo', 'expense')
    .gte('data', da);

  if (a) {
    query = query.lte('data', a);
  }

  const { data, error } = await query;

  if (error) throw error;
  return (data as { importo: number }[]).map((row) => row.importo);
}

// Le spese della casa nelle categorie date dal giorno `da`: solo quelle che servono, mai l'intero storico.
export async function getSpeseCasaPerCategorie(
  supabase: SupabaseClient,
  householdId: string,
  categoriaIds: string[],
  da: string
): Promise<Transaction[]> {
  if (categoriaIds.length === 0) return [];
  const { data, error } = await applyScope(
    supabase.from('transactions').select(TRANSACTION_COLUMNS),
    { kind: 'casa', householdId }
  )
    .in('categoria_id', categoriaIds)
    .eq('tipo', 'expense')
    .gte('data', da)
    .order('data', { ascending: false })
    .limit(LIMITE_SPESE_STIME);

  if (error) throw error;
  return (data as TransactionRow[]).map(mapRow);
}
