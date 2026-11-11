import { leggiTutte } from './leggiTutte';
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
  categoriaId?: string | null;
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

const COLONNE_VOCE =
  'id, plan_id, nome, categoria_id, frequenza_mesi, importo_ricorrenza, importo_mensile, origine_stima, goal_id, stima_ignorata_con_n, ordine';
const COLONNE_QUOTA =
  'plan_id, slot, user_id, display_name, reddito_netto_mensile, reddito_irregolare, percentuale, in_casa_dal, esce_dal, quota_mensile';

// Tutte le versioni del piano della casa, in ordine di valido_dal, con voci e quote. Due andate e
// ritorno in tutto, qualunque sia il numero di versioni: prima i piani, poi voci e quote insieme.
export async function getPlanVersions(supabase: SupabaseClient, householdId: string): Promise<PlanBundle[]> {
  const { data, error } = await supabase
    .from('household_plans')
    .select(COLONNE_PIANO)
    .eq('household_id', householdId)
    .order('valido_dal', { ascending: true });
  if (error) throw error;
  const piani = (data ?? []) as PlanRow[];
  if (piani.length === 0) return [];

  const ids = piani.map((p) => p.id);
  // A pagine: voci e quote di tutte le versioni insieme potrebbero superare le 1000 righe.
  const [voci, quote] = await Promise.all([
    leggiTutte<ItemRow>((da, a) =>
      supabase
        .from('household_plan_items')
        .select(COLONNE_VOCE)
        .in('plan_id', ids)
        .order('plan_id', { ascending: true })
        .order('ordine', { ascending: true })
        .order('id', { ascending: true })
        .range(da, a)
    ),
    leggiTutte<ShareRow>((da, a) =>
      supabase
        .from('household_plan_shares')
        .select(COLONNE_QUOTA)
        .in('plan_id', ids)
        .order('plan_id', { ascending: true })
        .order('slot', { ascending: true })
        .range(da, a)
    ),
  ]);

  return piani.map((riga) => ({
    plan: mapPlan(riga),
    items: voci.filter((v) => v.plan_id === riga.id).map(mapItem),
    shares: quote.filter((q) => q.plan_id === riga.id).map(mapShare),
  }));
}

// La versione del mese: valido_dal massimo non oltre il mese; se non ce n'è, la prima futura;
// null senza piani. Stessa regola di pianoDelMese.
export async function getPlanForMonth(
  supabase: SupabaseClient,
  householdId: string,
  meseISO: string,
): Promise<PlanBundle | null> {
  return dalMese(await getPlanVersions(supabase, householdId), meseISO)[0] ?? null;
}

// Da versioni in ordine di data: quella del mese (come getPlanForMonth) e tutte le successive.
export function dalMese(versioni: PlanBundle[], meseISO: string): PlanBundle[] {
  let inizio = 0;
  versioni.forEach((p, i) => {
    if (p.plan.validoDal <= meseISO) inizio = i;
  });
  return versioni.slice(inizio);
}

// Il piano del mese (come getPlanForMonth) e tutte le versioni successive, in ordine di data.
export async function getPlansFromMonth(
  supabase: SupabaseClient,
  householdId: string,
  meseISO: string,
): Promise<PlanBundle[]> {
  return dalMese(await getPlanVersions(supabase, householdId), meseISO);
}

// La posizione più alta mai usata in una quota di qualunque versione (0 se nessuna).
export function maxSlotDeiPiani(versioni: PlanBundle[]): number {
  return versioni.reduce((m, p) => p.shares.reduce((mm, s) => Math.max(mm, s.slot), m), 0);
}

// La posizione piu alta mai usata in una quota di qualunque versione della casa (0 se nessuna).
export async function getMaxSlotUsato(supabase: SupabaseClient, householdId: string): Promise<number> {
  return maxSlotDeiPiani(await getPlanVersions(supabase, householdId));
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
        categoria_id: x.categoriaId ?? null,
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
