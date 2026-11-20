import type { SupabaseClient } from '@supabase/supabase-js';
import type { Account } from '../types';
import { applyScope, PERSONALE, scopeHouseholdId, type Scope } from './scope';

interface AccountRow {
  id: string;
  nome: string;
  saldo_attuale: number;
  conta_in_disponibile: boolean;
  target_saldo: number | null;
  created_at?: string;
  archiviato?: boolean;
}

function mapRow(row: AccountRow): Account {
  return {
    id: row.id,
    nome: row.nome,
    saldoAttuale: row.saldo_attuale,
    contaInDisponibile: row.conta_in_disponibile,
    targetSaldo: row.target_saldo,
    archiviato: row.archiviato ?? false,
    ...(row.created_at ? { createdAt: row.created_at } : {}),
  };
}

export async function getAccounts(supabase: SupabaseClient, scope: Scope = PERSONALE): Promise<Account[]> {
  const query = applyScope(
    supabase
      .from('accounts')
      .select('id, nome, saldo_attuale, conta_in_disponibile, target_saldo, created_at, archiviato'),
    scope
  );
  // i conti archiviati ("Ricomincia da zero") restano visibili solo alla Casa che li usa
  const { data, error } = await (scope.kind === 'personale' ? query.eq('archiviato', false) : query).order('nome');

  if (error) throw error;
  return (data as AccountRow[]).map(mapRow);
}

// I conti archiviati personali, solo per leggerne il nome (lo storico di uno spostamento da o verso di loro).
export async function getContiArchiviati(supabase: SupabaseClient): Promise<{ id: string; nome: string }[]> {
  const { data, error } = await applyScope(supabase.from('accounts').select('id, nome'), PERSONALE).eq(
    'archiviato',
    true
  );
  if (error) throw error;
  return (data ?? []) as { id: string; nome: string }[];
}

export async function createAccount(
  supabase: SupabaseClient,
  input: { nome: string; saldoAttuale: number; contaInDisponibile: boolean; targetSaldo: number | null },
  scope: Scope = PERSONALE
): Promise<Account> {
  const { data, error } = await supabase
    .from('accounts')
    .insert({
      nome: input.nome,
      saldo_attuale: input.saldoAttuale,
      conta_in_disponibile: input.contaInDisponibile,
      target_saldo: input.targetSaldo,
      household_id: scopeHouseholdId(scope),
    })
    .select('id, nome, saldo_attuale, conta_in_disponibile, target_saldo')
    .single();

  if (error) throw error;
  return mapRow(data as AccountRow);
}

export async function updateAccountBalance(
  supabase: SupabaseClient,
  id: string,
  saldoAttuale: number
): Promise<void> {
  // household: per id
  const { error } = await supabase.from('accounts').update({ saldo_attuale: saldoAttuale }).eq('id', id);
  if (error) throw error;
}

export async function updateAccountDetails(
  supabase: SupabaseClient,
  id: string,
  input: { nome: string; contaInDisponibile: boolean; targetSaldo: number | null }
): Promise<Account> {
  // household: per id
  const { data, error } = await supabase
    .from('accounts')
    .update({
      nome: input.nome,
      conta_in_disponibile: input.contaInDisponibile,
      target_saldo: input.targetSaldo,
    })
    .eq('id', id)
    .select('id, nome, saldo_attuale, conta_in_disponibile, target_saldo')
    .single();

  if (error) throw error;
  return mapRow(data as AccountRow);
}
