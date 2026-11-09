import type { SupabaseClient } from '@supabase/supabase-js';
import { getAccounts } from '@/lib/data/accounts';
import { getCategories } from '@/lib/data/categories';
import { getOpenGoals } from '@/lib/data/goals';
import { getSpecoCollegatoPerObiettivi } from '@/lib/data/goalSpending';
import type { CasaCorrente } from '@/lib/data/households';
import { casa as scopeCasa } from '@/lib/data/scope';
import { getTransactions } from '@/lib/data/transactions';
import { getPlanVersions, type PlanBundle } from '@/lib/data/householdPlans';
import { getTransfers } from '@/lib/data/transfers';
import { computeAccantonatoFinora } from '@/lib/calculations/accantonato';
import { computeDaPagareMese, computeDisponibileCasa, type DisponibileCasa } from '@/lib/calculations/casa/disponibileCasa';
import { calcolaRegistriCasa } from '@/lib/calculations/casa/registri';
import { meseRomaISO, oggiRomaData, oggiRomaISO } from '@/lib/calculations/casa/oggi';
import type { DebitoMembro } from '@/lib/calculations/casa/debitiMembri';
import { pianoInVigore, type RigaMese } from '@/lib/calculations/casa/versamenti';
import type { Account, BudgetGoal, Category, Transaction, Transfer } from '@/lib/types';

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
  // Il cuscinetto di oggi; null se nessun piano è ancora in vigore.
  cuscinetto: { attuale: number; obiettivo: number; quotaMensile: number } | null;
  trasferimenti: Transfer[];
  crediti: Record<string, number>;
  piani: PlanBundle[];
  righe: Record<string, RigaMese[]>;
  debiti: DebitoMembro[];
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
  adesso: Date = new Date()
): Promise<CasaData> {
  const today = oggiRomaData(adesso);
  const [aggiunta, transazioni, trasferimenti, piani] = await Promise.all([
    loadCasaAggiunta(supabase, casa),
    getTransactions(supabase, scopeCasa(casa.household.id)),
    getTransfers(supabase, scopeCasa(casa.household.id)),
    getPlanVersions(supabase, casa.household.id),
  ]);
  const { righe, crediti, debiti } = calcolaRegistriCasa({
    piani,
    trasferimenti,
    spese: transazioni,
    membri: casa.members,
    oggi: oggiRomaISO(adesso),
  });
  const totaleCrediti = Object.values(crediti).reduce((s, v) => s + v, 0);

  const speso = await getSpecoCollegatoPerObiettivi(
    supabase,
    aggiunta.obiettivi,
    today,
    scopeCasa(casa.household.id)
  );
  const obiettiviConSpeso = aggiunta.obiettivi.map((g) => ({ ...g, specoCollegato: speso[g.id] ?? 0 }));

  const obiettiviConAccantonato = obiettiviConSpeso.map(({ specoCollegato, ...g }) => ({
    ...g,
    accantonato: computeAccantonatoFinora(g, today, specoCollegato),
  }));

  const mese = meseRomaISO(adesso);
  const pianoOra = pianoInVigore(piani, mese);
  const daPagareMese = pianoOra
    ? computeDaPagareMese({ voci: pianoOra.items, spese: transazioni, mese })
    : 0;

  const disponibile = computeDisponibileCasa({
    conti: aggiunta.conti,
    obiettivi: obiettiviConSpeso,
    today,
    crediti: totaleCrediti,
    daPagareMese,
    cuscinettoObiettivo: pianoOra?.plan.cuscinettoObiettivo ?? 0,
  });
  const cuscinetto = pianoOra
    ? {
        attuale: disponibile.cuscinetto,
        obiettivo: pianoOra.plan.cuscinettoObiettivo,
        quotaMensile: pianoOra.plan.cuscinettoQuotaMensile,
      }
    : null;

  return {
    casa,
    aggiunta,
    transazioni,
    obiettiviConAccantonato,
    disponibile,
    cuscinetto,
    trasferimenti,
    crediti,
    piani,
    righe,
    debiti,
  };
}
