import type { SupabaseClient } from '@supabase/supabase-js';
import { getOpenGoals } from '@/lib/data/goals';
import { casa as scopeCasa } from '@/lib/data/scope';
import { getSpeseCasaPerCategorie } from '@/lib/data/transactions';
import type { PlanBundle } from '@/lib/data/householdPlans';
import { meseRomaISO, oggiRomaISO } from '@/lib/calculations/casa/oggi';
import { pianoInVigore } from '@/lib/calculations/casa/versamenti';
import { inizioProveStime, proponiStime, puoAggiornarePiano, type PropostaStima } from '@/lib/calculations/casa/stimaVsReale';
import type { BudgetGoal } from '@/lib/types';

export interface ProposteStime {
  proposte: PropostaStima[];
  // L'obiettivo aperto collegato a ogni voce che ne ha uno, per itemId.
  fondiPerVoce: Record<string, BudgetGoal>;
  // La versione del piano in vigore: quella a cui si applica una stima.
  pianoAttuale: PlanBundle | null;
  // Il primo del mese dopo: da lì parte la quota nuova.
  validoDal: string;
  // C'è già una versione che parte dopo il mese corrente.
  programmata: boolean;
}

// Il primo del mese dopo quello di Roma di `now`, come YYYY-MM-01.
export function primoDelMeseDopo(now: Date = new Date()): string {
  const m = meseRomaISO(now);
  const anno = Number(m.slice(0, 4));
  const mese = Number(m.slice(5, 7));
  return mese === 12 ? `${anno + 1}-01-01` : `${anno}-${String(mese + 1).padStart(2, '0')}-01`;
}

export function fondiDelleProposte(
  proposte: PropostaStima[],
  piano: PlanBundle,
  obiettivi: BudgetGoal[],
): Record<string, BudgetGoal> {
  const fondi: Record<string, BudgetGoal> = {};
  for (const p of proposte) {
    const goalId = piano.items.find((i) => i.id === p.itemId)?.goalId ?? null;
    const goal = goalId === null ? undefined : obiettivi.find((g) => g.id === goalId);
    if (goal) fondi[p.itemId] = goal;
  }
  return fondi;
}

// Per la pagina quota: legge solo le spese delle categorie delle voci ancora stimate, dalla prima versione del piano.
export async function loadProposteStime(
  supabase: SupabaseClient,
  householdId: string,
  piani: PlanBundle[],
  now: Date = new Date(),
): Promise<ProposteStime> {
  const meseCorrente = meseRomaISO(now);
  const pianoAttuale = pianoInVigore(piani, meseCorrente);
  const base = {
    pianoAttuale,
    validoDal: primoDelMeseDopo(now),
    programmata: !puoAggiornarePiano(piani, meseCorrente),
  };
  if (!pianoAttuale) return { ...base, proposte: [], fondiPerVoce: {} };

  const categorie = [
    ...new Set(
      pianoAttuale.items
        .filter((i) => i.origineStima !== 'reale' && i.categoriaId !== null)
        .map((i) => i.categoriaId as string),
    ),
  ];
  if (categorie.length === 0) return { ...base, proposte: [], fondiPerVoce: {} };

  const inizioPiano = inizioProveStime(piani, pianoAttuale.plan.validoDal);
  const spese = await getSpeseCasaPerCategorie(supabase, householdId, categorie, inizioPiano);
  const proposte = proponiStime({
    voci: pianoAttuale.items,
    spese,
    inizioPiano,
    oggi: oggiRomaISO(now),
  });
  if (proposte.length === 0) return { ...base, proposte, fondiPerVoce: {} };

  const haFondi = proposte.some((p) => pianoAttuale.items.find((i) => i.id === p.itemId)?.goalId);
  const obiettivi = haFondi ? await getOpenGoals(supabase, scopeCasa(householdId)) : [];
  return { ...base, proposte, fondiPerVoce: fondiDelleProposte(proposte, pianoAttuale, obiettivi) };
}
