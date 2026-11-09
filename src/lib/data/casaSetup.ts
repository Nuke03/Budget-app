import type { SupabaseClient } from '@supabase/supabase-js';
import { VOCI_CASA_TIPICHE } from '../calculations/casa/vociTipiche';
import type { Account, CategoriaTipo } from '../types';
import { createAccount } from './accounts';
import { createCategory, getCategories } from './categories';
import { casa } from './scope';

export function categorieCasaBase(): { nome: string; tipo: CategoriaTipo }[] {
  return [
    ...VOCI_CASA_TIPICHE.map((v) => ({ nome: v.nome, tipo: 'expense' as CategoriaTipo })),
    { nome: 'Altro', tipo: 'expense' },
    { nome: 'Altre entrate', tipo: 'income' },
  ];
}

// Crea solo le categorie di casa che mancano (confronto per nome, senza
// distinguere le maiuscole), anche rispetto a quelle già create dal wizard.
export async function seedCategorieCasa(supabase: SupabaseClient, householdId: string): Promise<void> {
  const esistenti = await getCategories(supabase, casa(householdId));
  const nomi = new Set(esistenti.map((c) => c.nome.trim().toLowerCase()));
  for (const cat of categorieCasaBase()) {
    const chiave = cat.nome.toLowerCase();
    if (nomi.has(chiave)) continue;
    await createCategory(supabase, { nome: cat.nome, tipo: cat.tipo, colore: null }, casa(householdId));
    nomi.add(chiave);
  }
}

export async function creaContoComune(
  supabase: SupabaseClient,
  householdId: string,
  input: { nome: string; saldoAttuale: number }
): Promise<Account> {
  const conto = await createAccount(
    supabase,
    { nome: input.nome, saldoAttuale: input.saldoAttuale, contaInDisponibile: true, targetSaldo: null },
    casa(householdId)
  );
  await seedCategorieCasa(supabase, householdId);
  return conto;
}
