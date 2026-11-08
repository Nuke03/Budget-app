import type { RegolaQuota } from '@/lib/types';
import type { PlanQuotaInput, PlanVersionInput, PlanVoceInput } from '@/lib/data/householdPlans';
import { calcolaQuota, calcolaTotale, type PersonaQuotaInput } from './quota';
import { totaleVociMensili } from './mensilizza';

export interface PianoDraftPersona {
  slot: number;
  displayName: string;
  userId: string | null;
  redditoNetto: number | null;
  redditoIrregolare: boolean;
  inCasaDal: string | null;
}

export type PeriodoIniziale =
  | { tipo: 'normale' }
  | { tipo: 'tutto_a_chi_abita' }
  | { tipo: 'percentuali'; percentuali: Record<number, number> };

export interface PianoDraft {
  persone: PianoDraftPersona[];
  voci: PlanVoceInput[];
  cuscinettoObiettivo: number;
  cuscinettoQuotaMensile: number;
  arrotondamento: number;
  regola: RegolaQuota;
  periodoIniziale: PeriodoIniziale;
  giornoVersamento: number;
  partenza: string;
}

// Primo giorno del mese successivo a quello della data ('yyyy-MM-dd').
function meseSuccessivo(iso: string): string {
  const [y, m] = iso.split('-').map(Number);
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  return `${ny}-${String(nm).padStart(2, '0')}-01`;
}

function quotaDal(p: PianoDraftPersona, partenza: string): string {
  if (p.inCasaDal === null || p.inCasaDal <= partenza) return partenza;
  return meseSuccessivo(p.inCasaDal);
}

// Le date in cui il piano cambia: il mese di partenza e, per ogni persona che entra dopo, il mese successivo.
export function dateVersioni(persone: PianoDraftPersona[], partenza: string): string[] {
  return Array.from(new Set([partenza, ...persone.map((p) => quotaDal(p, partenza))])).sort();
}

interface Calcolata {
  regola: RegolaQuota;
  quote: PlanQuotaInput[];
}

function calcolaVersione(
  draft: PianoDraft,
  totale: number,
  regola: RegolaQuota,
  // chi partecipa alla divisione di questa versione
  partecipanti: PianoDraftPersona[],
  percentuali: Record<number, number> | null,
): Calcolata {
  const input: PersonaQuotaInput[] = partecipanti.map((p) => ({
    slot: p.slot,
    nome: p.displayName,
    redditoNetto: p.redditoNetto,
    percentuale: percentuali ? (percentuali[p.slot] ?? 0) : null,
  }));
  const risultato = calcolaQuota({ persone: input, totale, regola });
  if (!risultato.regolaDisponibile) {
    throw new Error('quota non calcolabile: controllare redditi e percentuali');
  }
  const quotaPerSlot = new Map(risultato.persone.map((p) => [p.slot, p.quota]));
  const quote: PlanQuotaInput[] = draft.persone.map((p) => {
    const dentro = quotaPerSlot.has(p.slot);
    return {
      slot: p.slot,
      displayName: p.displayName,
      redditoNettoMensile: p.redditoNetto ?? 0,
      redditoIrregolare: p.redditoIrregolare,
      percentuale: regola === 'personalizzata' ? (dentro && percentuali ? (percentuali[p.slot] ?? 0) : 0) : null,
      inCasaDal: p.inCasaDal,
      esceDal: null,
      quotaMensile: quotaPerSlot.get(p.slot) ?? 0,
    };
  });
  return { regola, quote };
}

const stessaDivisione = (a: PlanQuotaInput[], b: PlanQuotaInput[]) =>
  a.length === b.length && a.every((q, i) => q.slot === b[i].slot && q.quotaMensile === b[i].quotaMensile);

export function buildPlanVersions(draft: PianoDraft): PlanVersionInput[] {
  const { partenza } = draft;
  const sottotot = totaleVociMensili(draft.voci);
  const totale = calcolaTotale(sottotot, draft.cuscinettoQuotaMensile, draft.arrotondamento);

  const date = dateVersioni(draft.persone, partenza);
  const versioni: PlanVersionInput[] = [];

  date.forEach((data, indice) => {
    const presenti = draft.persone.filter((p) => quotaDal(p, partenza) <= data);
    let calcolata: Calcolata;

    if (indice === 0 && date.length > 1 && draft.periodoIniziale.tipo !== 'normale') {
      const periodo = draft.periodoIniziale;
      if (periodo.tipo === 'tutto_a_chi_abita' && presenti.length > 0) {
        const parte = 100 / presenti.length;
        const percentuali: Record<number, number> = {};
        presenti.forEach((p) => (percentuali[p.slot] = parte));
        calcolata = calcolaVersione(draft, totale, 'personalizzata', presenti, percentuali);
      } else if (periodo.tipo === 'percentuali') {
        // Le percentuali scelte valgono per chi è nell'elenco, anche se entra poco dopo.
        const coinvolti = draft.persone.filter((p) => periodo.percentuali[p.slot] !== undefined);
        const somma = coinvolti.reduce((s, p) => s + periodo.percentuali[p.slot], 0);
        if (Math.abs(somma - 100) > 0.01) throw new Error('le percentuali devono sommare a 100');
        calcolata = calcolaVersione(draft, totale, 'personalizzata', coinvolti, periodo.percentuali);
      } else {
        calcolata = calcolaVersione(draft, totale, draft.regola, draft.persone, null);
      }
    } else if (indice === 0 && date.length > 1) {
      calcolata = calcolaVersione(draft, totale, draft.regola, draft.persone, null);
    } else {
      calcolata = calcolaVersione(draft, totale, draft.regola, presenti, null);
    }

    const precedente = versioni[versioni.length - 1];
    if (precedente && stessaDivisione(precedente.quote, calcolata.quote)) return;

    versioni.push({
      validoDal: data,
      giornoVersamento: draft.giornoVersamento,
      regola: calcolata.regola,
      cuscinettoObiettivo: draft.cuscinettoObiettivo,
      cuscinettoQuotaMensile: draft.cuscinettoQuotaMensile,
      arrotondamento: draft.arrotondamento,
      totaleMensile: totale,
      voci: draft.voci,
      quote: calcolata.quote,
    });
  });

  return versioni;
}
