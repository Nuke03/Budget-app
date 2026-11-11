import type { PlanItem, Transaction } from '@/lib/types';
import type { PlanBundle, PlanQuotaInput, PlanVersionInput, PlanVoceInput } from '@/lib/data/householdPlans';
import { calcolaQuota, calcolaTotale } from './quota';
import { mensilizza, totaleVociMensili } from './mensilizza';

export type PropostaStima = {
  itemId: string;
  nome: string;
  categoriaId: string;
  frequenzaMesi: number;
  importoMensileAttuale: number;
  mediaReale: number;
  nuovoMensile: number;
  nuovoImportoRicorrenza: number;
  n: number;
  unita: 'bollette' | 'mesi';
};

type SpesaStima = Pick<Transaction, 'tipo' | 'importo' | 'data' | 'categoriaId' | 'origine'>;

const arrotonda2 = (x: number): number => Math.round((x + Number.EPSILON) * 100) / 100;

// Mese 'yyyy-MM' di una data 'yyyy-MM-dd'.
const mese = (iso: string): string => iso.slice(0, 7);

// Una proposta c'è se il mensile reale si scosta dalla stima di almeno 2 euro e del 5 per cento.
function oltreSoglia(attuale: number, nuovo: number): boolean {
  return Math.abs(nuovo - attuale) >= Math.max(2, attuale * 0.05) - 1e-9;
}

// Per le voci a frequenza 1: i totali dei mesi chiusi (prima di quello di oggi) con almeno una spesa.
function totaliMesiChiusi(spese: SpesaStima[], oggi: string): { mese: string; totale: number }[] {
  const perMese = new Map<string, number>();
  for (const s of spese) {
    if (mese(s.data) >= mese(oggi)) continue;
    perMese.set(mese(s.data), (perMese.get(mese(s.data)) ?? 0) + s.importo);
  }
  return [...perMese.entries()]
    .map(([m, totale]) => ({ mese: m, totale }))
    .sort((a, b) => (a.mese < b.mese ? 1 : -1));
}

const media = (xs: number[]): number => xs.reduce((s, x) => s + x, 0) / xs.length;

// Le voci che sono ancora una stima (suggerita o scritta dall'utente) e che le spese reali smentiscono:
// già dalla prima bolletta si propone il mensile reale, poi lo si affina con le ultime tre.
export function proponiStime(input: {
  voci: PlanItem[];
  spese: SpesaStima[];
  inizioPiano: string;
  oggi: string;
}): PropostaStima[] {
  const { voci, spese, inizioPiano, oggi } = input;
  const proposte: PropostaStima[] = [];

  for (const v of voci) {
    if (v.origineStima === 'reale' || v.categoriaId === null) continue;
    const proprie = spese.filter(
      (s) =>
        s.tipo === 'expense' &&
        s.categoriaId === v.categoriaId &&
        s.origine !== 'riconciliazione' &&
        s.data >= inizioPiano,
    );

    let n: number;
    let mediaReale: number;
    let unita: PropostaStima['unita'];
    if (v.frequenzaMesi === 1) {
      const mesi = totaliMesiChiusi(proprie, oggi);
      if (mesi.length === 0) continue;
      n = mesi.length;
      unita = 'mesi';
      mediaReale = media(mesi.slice(0, 3).map((m) => m.totale));
    } else {
      if (proprie.length === 0) continue;
      const ultime = [...proprie].sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0)).slice(0, 3);
      n = proprie.length;
      unita = 'bollette';
      mediaReale = media(ultime.map((s) => s.importo));
    }

    // Già ignorata: si riparte solo con una bolletta (o un mese) in più.
    if (v.stimaIgnorataConN !== null && n <= v.stimaIgnorataConN) continue;

    const importoMensileAttuale = arrotonda2(mensilizza(v.importoRicorrenza, v.frequenzaMesi));
    const nuovoImportoRicorrenza = arrotonda2(mediaReale);
    const nuovoMensile = arrotonda2(nuovoImportoRicorrenza / v.frequenzaMesi);
    if (!oltreSoglia(importoMensileAttuale, nuovoMensile)) continue;

    proposte.push({
      itemId: v.id,
      nome: v.nome,
      categoriaId: v.categoriaId,
      frequenzaMesi: v.frequenzaMesi,
      importoMensileAttuale,
      mediaReale: nuovoImportoRicorrenza,
      nuovoMensile,
      nuovoImportoRicorrenza,
      n,
      unita,
    });
  }
  return proposte;
}

// La versione del piano con la voce sostituita dal valore reale; stessa regola, redditi e cuscinetto.
// Null se qualcuno sta per uscire (le quote non si ricalcolano a freddo) o se la voce non c'è più.
export function pianoConStimaAggiornata(
  bundle: PlanBundle,
  proposta: PropostaStima,
  validoDal: string,
): PlanVersionInput | null {
  if (bundle.shares.some((s) => s.esceDal !== null)) return null;
  if (!bundle.items.some((i) => i.id === proposta.itemId)) return null;

  const voci: PlanVoceInput[] = bundle.items.map((i) => {
    const base: PlanVoceInput = {
      nome: i.nome,
      categoriaNome: i.categoriaId === null ? i.nome : '',
      categoriaId: i.categoriaId,
      frequenzaMesi: i.frequenzaMesi,
      importoRicorrenza: i.importoRicorrenza,
      origineStima: i.origineStima,
      goalId: i.goalId,
      stimaIgnorataConN: i.stimaIgnorataConN,
      ordine: i.ordine,
    };
    return i.id === proposta.itemId
      ? { ...base, importoRicorrenza: proposta.nuovoImportoRicorrenza, origineStima: 'reale', stimaIgnorataConN: null }
      : base;
  });

  const { plan } = bundle;
  const sottotot = totaleVociMensili(voci);
  const totaleMensile = calcolaTotale(sottotot, plan.cuscinettoQuotaMensile, plan.arrotondamento);
  const risultato = calcolaQuota({
    persone: bundle.shares.map((s) => ({
      slot: s.slot,
      nome: s.displayName,
      redditoNetto: s.redditoNettoMensile,
      percentuale: s.percentuale,
    })),
    totale: totaleMensile,
    regola: plan.regola,
  });
  if (!risultato.regolaDisponibile) return null;
  const perSlot = new Map(risultato.persone.map((p) => [p.slot, p.quota]));

  const quote: PlanQuotaInput[] = bundle.shares.map((s) => ({
    slot: s.slot,
    displayName: s.displayName,
    redditoNettoMensile: s.redditoNettoMensile,
    redditoIrregolare: s.redditoIrregolare,
    percentuale: s.percentuale,
    inCasaDal: s.inCasaDal,
    esceDal: null,
    quotaMensile: perSlot.get(s.slot) ?? 0,
  }));

  return {
    validoDal,
    giornoVersamento: plan.giornoVersamento,
    regola: plan.regola,
    cuscinettoObiettivo: plan.cuscinettoObiettivo,
    cuscinettoQuotaMensile: plan.cuscinettoQuotaMensile,
    arrotondamento: plan.arrotondamento,
    totaleMensile,
    voci,
    quote,
  };
}

export function quoteDelConfronto(
  bundle: PlanBundle,
  nuovo: PlanVersionInput,
): { nome: string; prima: number; dopo: number }[] {
  return bundle.shares.map((s) => ({
    nome: s.displayName,
    prima: s.quotaMensile,
    dopo: nuovo.quote.find((q) => q.slot === s.slot)?.quotaMensile ?? 0,
  }));
}

// Il piano si aggiorna solo se non c'è già una versione che parte dopo il mese corrente.
export function puoAggiornarePiano(piani: PlanBundle[], meseCorrente: string): boolean {
  return !piani.some((p) => p.plan.validoDal > meseCorrente);
}
