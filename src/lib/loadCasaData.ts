import type { SupabaseClient } from '@supabase/supabase-js';
import { getAccounts } from '@/lib/data/accounts';
import { getCategories } from '@/lib/data/categories';
import { getOpenGoals } from '@/lib/data/goals';
import { getSpecoCollegato } from '@/lib/data/goalSpending';
import type { CasaCorrente } from '@/lib/data/households';
import { casa as scopeCasa } from '@/lib/data/scope';
import { getTransactions } from '@/lib/data/transactions';
import { computeAccantonatoFinora } from '@/lib/calculations/accantonato';
import { computeDisponibileCasa, type DisponibileCasa } from '@/lib/calculations/casa/disponibileCasa';
import type { Account, BudgetGoal, Category, Transaction } from '@/lib/types';

export interface CasaAggiunta {
  householdId: string;
  meUserId: string;
  nomi: { userId: string; nome: string }[];
  conti: Account[];
  categorie: Category[];
  obiettivi: BudgetGoal[];
}

export interface CasaData {
  casa: CasaCorrente;
  aggiunta: CasaAggiunta;
  transazioni: Transaction[];
  obiettiviConAccantonato: (BudgetGoal & { accantonato: number })[];
  disponibile: DisponibileCasa;
}

export async function loadCasaAggiunta(
  supabase: SupabaseClient,
  casa: CasaCorrente
): Promise<CasaAggiunta> {
  const scope = scopeCasa(casa.household.id);
  const [conti, categorie, obiettivi] = await Promise.all([
    getAccounts(supabase, scope),
    getCategories(supabase, scope),
    getOpenGoals(supabase, scope),
  ]);
  return {
    householdId: casa.household.id,
    meUserId: casa.me.userId,
    nomi: casa.members.map((m) => ({ userId: m.userId, nome: m.displayName })),
    conti,
    categorie,
    obiettivi,
  };
}

export async function loadCasaData(
  supabase: SupabaseClient,
  casa: CasaCorrente,
  today: Date = new Date()
): Promise<CasaData> {
  const [aggiunta, transazioni] = await Promise.all([
    loadCasaAggiunta(supabase, casa),
    getTransactions(supabase, scopeCasa(casa.household.id)),
  ]);

  const speso = await Promise.all(aggiunta.obiettivi.map((g) => getSpecoCollegato(supabase, g, today)));
  const obiettiviConSpeso = aggiunta.obiettivi.map((g, i) => ({ ...g, specoCollegato: speso[i] }));

  const obiettiviConAccantonato = obiettiviConSpeso.map(({ specoCollegato, ...g }) => ({
    ...g,
    accantonato: computeAccantonatoFinora(g, today, specoCollegato),
  }));

  const disponibile = computeDisponibileCasa({
    conti: aggiunta.conti,
    obiettivi: obiettiviConSpeso,
    today,
  });

  return { casa, aggiunta, transazioni, obiettiviConAccantonato, disponibile };
}
