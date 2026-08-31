import type { SupabaseClient } from '@supabase/supabase-js';
import type { Account } from '../types';

interface AccountRow {
  id: string;
  nome: string;
  saldo_attuale: number;
  conta_in_disponibile: boolean;
  target_saldo: number | null;
}

function mapRow(row: AccountRow): Account {
  return {
    id: row.id,
    nome: row.nome,
    saldoAttuale: row.saldo_attuale,
    contaInDisponibile: row.conta_in_disponibile,
    targetSaldo: row.target_saldo,
  };
}

export async function getAccounts(supabase: SupabaseClient): Promise<Account[]> {
  const { data, error } = await supabase
    .from('accounts')
    .select('id, nome, saldo_attuale, conta_in_disponibile, target_saldo')
    .order('nome');

  if (error) throw error;
  return (data as AccountRow[]).map(mapRow);
}

export async function createAccount(
  supabase: SupabaseClient,
  input: { nome: string; saldoAttuale: number; contaInDisponibile: boolean; targetSaldo: number | null }
): Promise<Account> {
  const { data, error } = await supabase
    .from('accounts')
    .insert({
      nome: input.nome,
      saldo_attuale: input.saldoAttuale,
      conta_in_disponibile: input.contaInDisponibile,
      target_saldo: input.targetSaldo,
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
  const { error } = await supabase.from('accounts').update({ saldo_attuale: saldoAttuale }).eq('id', id);
  if (error) throw error;
}

export async function updateAccountDetails(
  supabase: SupabaseClient,
  id: string,
  input: { nome: string; contaInDisponibile: boolean; targetSaldo: number | null }
): Promise<Account> {
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
