import type { SupabaseClient } from '@supabase/supabase-js';
import { parseISO } from 'date-fns';
import type { Transaction, TransactionTipo } from '../types';
import { applyScope, PERSONALE, scopeHouseholdId, type Scope } from './scope';
import { leggiTutte } from './leggiTutte';

const TRANSACTION_COLUMNS =
  'id, tipo, importo, data, categoria_id, account_id, goal_id, descrizione, nota, created_at, pagata_da_user_id, origine, user_id, stima';

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
  stima: boolean;
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
    stima: row.stima,
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
    // Importo stimato: la categoria arriva dopo, a spesa reale nota.
    stima?: boolean;
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
      stima: input.stima ?? false,
      ...(scopeHouseholdId(scope) && input.pagataDaUserId ? { pagata_da_user_id: input.pagataDaUserId } : {}),
    })
    .select(TRANSACTION_COLUMNS)
    .single();

  if (error) throw error;
  return mapRow(data as TransactionRow);
}

// Modifica atomica: la riga e i saldi dei conti cambiano insieme, in una sola transazione SQL
// (modifica_movimento, 0012). Vanno mandati TUTTI i campi: categoria, obiettivo, nota e descrizione si
// sovrascrivono. Chi ha pagato, la casa e l'origine non cambiano mai. Una spesa con categoria non è più una
// stima; senza categoria la colonna resta com'è (null).
export async function modificaMovimento(
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
): Promise<void> {
  const { error } = await supabase.rpc('modifica_movimento', {
    p_id: id,
    p_tipo: input.tipo,
    p_importo: input.importo,
    p_data: input.data,
    p_categoria: input.categoriaId,
    p_account: input.accountId,
    p_goal: input.goalId,
    p_descrizione: input.descrizione,
    p_nota: input.nota,
    p_stima: input.categoriaId !== null ? false : null,
  });
  if (error) throw error;
}

// Eliminazione atomica: riga e saldo insieme (elimina_movimento, 0012). Idempotente: una riga già
// sparita non fa niente, quindi si può ripetere senza muovere il saldo due volte.
export async function eliminaMovimento(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.rpc('elimina_movimento', { p_id: id });
  if (error) throw error;
}

// Una riga sola: c'è almeno un movimento personale (di qualunque data)?
export async function haMovimentiPersonali(supabase: SupabaseClient): Promise<boolean> {
  const { data, error } = await applyScope(supabase.from('transactions').select('id'), PERSONALE).limit(1);
  if (error) throw error;
  return (data as unknown[]).length > 0;
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
  a: string | null,
  // Obiettivi ricorrenti: il giorno di inizio appartiene al ciclo precedente.
  daEscluso = false
): Promise<number[]> {
  // household: per id
  const base = supabase
    .from('transactions')
    .select('importo')
    .eq('goal_id', goalId)
    .eq('tipo', 'expense');
  let query = daEscluso ? base.gt('data', da) : base.gte('data', da);

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
