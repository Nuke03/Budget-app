import type { SupabaseClient } from '@supabase/supabase-js';
import type { HouseholdPlan, OrigineStima, PlanItem, PlanShare, RegolaQuota } from '../types';

export interface PlanBundle {
  plan: HouseholdPlan;
  items: PlanItem[];
  shares: PlanShare[];
}

export interface PlanVoceInput {
  nome: string;
  categoriaNome: string;
  frequenzaMesi: number;
  importoRicorrenza: number;
  origineStima: OrigineStima;
  goalId?: string | null;
  stimaIgnorataConN?: number | null;
  ordine: number;
}

export interface PlanQuotaInput {
  slot: number;
  displayName: string;
  redditoNettoMensile: number;
  redditoIrregolare: boolean;
  percentuale: number | null;
  inCasaDal: string | null;
  esceDal?: string | null;
  quotaMensile: number;
}

export interface PlanVersionInput {
  validoDal: string;
  giornoVersamento: number;
  regola: RegolaQuota;
  cuscinettoObiettivo: number;
  cuscinettoQuotaMensile: number;
  arrotondamento: number;
  totaleMensile: number;
  voci: PlanVoceInput[];
  quote: PlanQuotaInput[];
}

interface PlanRow {
  id: string;
  household_id: string;
  valido_dal: string;
  giorno_versamento: number;
  regola: RegolaQuota;
  cuscinetto_obiettivo: number | string;
  cuscinetto_quota_mensile: number | string;
  arrotondamento: number | string;
  totale_mensile: number | string;
  created_at: string;
}

interface ItemRow {
  id: string;
  plan_id: string;
  nome: string;
  categoria_id: string | null;
  frequenza_mesi: number;
  importo_ricorrenza: number | string;
  importo_mensile: number | string;
  origine_stima: OrigineStima;
  goal_id: string | null;
  stima_ignorata_con_n: number | null;
  ordine: number;
}

interface ShareRow {
  plan_id: string;
  slot: number;
  user_id: string | null;
  display_name: string;
  reddito_netto_mensile: number | string;
  reddito_irregolare: boolean;
  percentuale: number | string | null;
  in_casa_dal: string | null;
  esce_dal: string | null;
  quota_mensile: number | string;
}

const num = (v: number | string): number => Number(v);
const numOrNull = (v: number | string | null): number | null => (v === null ? null : Number(v));

function mapPlan(r: PlanRow): HouseholdPlan {
  return {
    id: r.id,
    householdId: r.household_id,
    validoDal: r.valido_dal,
    giornoVersamento: r.giorno_versamento,
    regola: r.regola,
    cuscinettoObiettivo: num(r.cuscinetto_obiettivo),
    cuscinettoQuotaMensile: num(r.cuscinetto_quota_mensile),
    arrotondamento: num(r.arrotondamento),
    totaleMensile: num(r.totale_mensile),
    createdAt: r.created_at,
  };
}

function mapItem(r: ItemRow): PlanItem {
  return {
    id: r.id,
    planId: r.plan_id,
    nome: r.nome,
    categoriaId: r.categoria_id,
    frequenzaMesi: r.frequenza_mesi,
    importoRicorrenza: num(r.importo_ricorrenza),
    importoMensile: num(r.importo_mensile),
    origineStima: r.origine_stima,
    goalId: r.goal_id,
    stimaIgnorataConN: r.stima_ignorata_con_n,
    ordine: r.ordine,
  };
}

function mapShare(r: ShareRow): PlanShare {
  return {
    planId: r.plan_id,
    slot: r.slot,
    userId: r.user_id,
    displayName: r.display_name,
    redditoNettoMensile: num(r.reddito_netto_mensile),
    redditoIrregolare: r.reddito_irregolare,
    percentuale: numOrNull(r.percentuale),
    inCasaDal: r.in_casa_dal,
    esceDal: r.esce_dal,
    quotaMensile: num(r.quota_mensile),
  };
}

const COLONNE_PIANO =
  'id, household_id, valido_dal, giorno_versamento, regola, cuscinetto_obiettivo, cuscinetto_quota_mensile, arrotondamento, totale_mensile, created_at';

// Il piano con valido_dal massimo non oltre il mese; se non ce n'è, il primo futuro; null senza piani.
export async function getPlanForMonth(
  supabase: SupabaseClient,
  householdId: string,
  meseISO: string,
): Promise<PlanBundle | null> {
  const { data: passati, error: e1 } = await supabase
    .from('household_plans')
    .select(COLONNE_PIANO)
    .eq('household_id', householdId)
    .lte('valido_dal', meseISO)
    .order('valido_dal', { ascending: false })
    .limit(1);
  if (e1) throw e1;
  let riga = ((passati ?? []) as PlanRow[])[0];

  if (!riga) {
    const { data: futuri, error: e2 } = await supabase
      .from('household_plans')
      .select(COLONNE_PIANO)
      .eq('household_id', householdId)
      .gt('valido_dal', meseISO)
      .order('valido_dal', { ascending: true })
      .limit(1);
    if (e2) throw e2;
    riga = ((futuri ?? []) as PlanRow[])[0];
  }
  if (!riga) return null;
  return leggiBundle(supabase, riga);
}

async function leggiBundle(supabase: SupabaseClient, riga: PlanRow): Promise<PlanBundle> {
  const { data: voci, error: e3 } = await supabase
    .from('household_plan_items')
    .select(
      'id, plan_id, nome, categoria_id, frequenza_mesi, importo_ricorrenza, importo_mensile, origine_stima, goal_id, stima_ignorata_con_n, ordine',
    )
    .eq('plan_id', riga.id)
    .order('ordine', { ascending: true });
  if (e3) throw e3;

  const { data: quote, error: e4 } = await supabase
    .from('household_plan_shares')
    .select(
      'plan_id, slot, user_id, display_name, reddito_netto_mensile, reddito_irregolare, percentuale, in_casa_dal, esce_dal, quota_mensile',
    )
    .eq('plan_id', riga.id)
    .order('slot', { ascending: true });
  if (e4) throw e4;

  return {
    plan: mapPlan(riga),
    items: ((voci ?? []) as ItemRow[]).map(mapItem),
    shares: ((quote ?? []) as ShareRow[]).map(mapShare),
  };
}

// Il piano del mese (come getPlanForMonth) e tutte le versioni successive, in ordine di data.
export async function getPlansFromMonth(
  supabase: SupabaseClient,
  householdId: string,
  meseISO: string,
): Promise<PlanBundle[]> {
  const attuale = await getPlanForMonth(supabase, householdId, meseISO);
  if (!attuale) return [];
  const { data: dopo, error } = await supabase
    .from('household_plans')
    .select(COLONNE_PIANO)
    .eq('household_id', householdId)
    .gt('valido_dal', attuale.plan.validoDal)
    .order('valido_dal', { ascending: true });
  if (error) throw error;
  const successivi = await Promise.all(((dopo ?? []) as PlanRow[]).map((r) => leggiBundle(supabase, r)));
  return [attuale, ...successivi];
}

// La posizione piu alta mai usata in una quota di qualunque versione della casa (0 se nessuna).
export async function getMaxSlotUsato(supabase: SupabaseClient, householdId: string): Promise<number> {
  const { data: piani, error: e1 } = await supabase
    .from('household_plans')
    .select('id')
    .eq('household_id', householdId);
  if (e1) throw e1;
  const ids = ((piani ?? []) as { id: string }[]).map((p) => p.id);
  if (ids.length === 0) return 0;
  const { data: quote, error: e2 } = await supabase
    .from('household_plan_shares')
    .select('slot')
    .in('plan_id', ids)
    .order('slot', { ascending: false })
    .limit(1);
  if (e2) throw e2;
  return ((quote ?? []) as { slot: number }[])[0]?.slot ?? 0;
}

// Salva una o più versioni del piano con l'unica scrittura consentita: l'RPC.
export async function savePlan(
  supabase: SupabaseClient,
  householdId: string,
  versioni: PlanVersionInput[],
): Promise<string[]> {
  const payload = {
    versioni: versioni.map((v) => ({
      valido_dal: v.validoDal,
      giorno_versamento: v.giornoVersamento,
      regola: v.regola,
      cuscinetto_obiettivo: v.cuscinettoObiettivo,
      cuscinetto_quota_mensile: v.cuscinettoQuotaMensile,
      arrotondamento: v.arrotondamento,
      totale_mensile: v.totaleMensile,
      voci: v.voci.map((x) => ({
        nome: x.nome,
        categoria_nome: x.categoriaNome,
        frequenza_mesi: x.frequenzaMesi,
        importo_ricorrenza: x.importoRicorrenza,
        origine_stima: x.origineStima,
        goal_id: x.goalId ?? null,
        stima_ignorata_con_n: x.stimaIgnorataConN ?? null,
        ordine: x.ordine,
      })),
      quote: v.quote.map((q) => ({
        slot: q.slot,
        display_name: q.displayName,
        reddito_netto_mensile: q.redditoNettoMensile,
        reddito_irregolare: q.redditoIrregolare,
        percentuale: q.percentuale,
        in_casa_dal: q.inCasaDal,
        esce_dal: q.esceDal ?? null,
        quota_mensile: q.quotaMensile,
      })),
    })),
  };
  const { data, error } = await supabase.rpc('save_household_plan', {
    p_household: householdId,
    p_payload: payload,
  });
  if (error) throw error;
  return (data ?? []) as string[];
}
