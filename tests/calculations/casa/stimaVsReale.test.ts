import { describe, it, expect } from 'vitest';
import {
  proponiStime,
  pianoConStimaAggiornata,
  quoteDelConfronto,
  puoAggiornarePiano,
  inizioProveStime,
} from '@/lib/calculations/casa/stimaVsReale';
import type { PlanItem } from '@/lib/types';
import type { PlanBundle } from '@/lib/data/householdPlans';
import { ESEMPIO_VOCI } from '../../helpers/esempioCasa';

const OGGI = '2026-11-09';
const INIZIO = '2026-01-01';

function voce(p: Partial<PlanItem> & { id: string; nome: string }): PlanItem {
  return {
    planId: 'P1',
    categoriaId: `cat-${p.id}`,
    frequenzaMesi: 1,
    importoRicorrenza: 100,
    importoMensile: 100,
    origineStima: 'suggerita',
    goalId: null,
    stimaIgnorataConN: null,
    ordine: 0,
    ...p,
  };
}

const luce = voce({ id: 'luce', nome: 'Luce', frequenzaMesi: 2, importoRicorrenza: 110, importoMensile: 55 });
const spesa = (data: string, importo: number, categoriaId = 'cat-luce') => ({
  tipo: 'expense' as const,
  importo,
  data,
  categoriaId,
  origine: null,
});

describe('proponiStime, voci a più mesi', () => {
  it('luce: la prima bolletta già propone di sostituire la stima', () => {
    const r = proponiStime({ voci: [luce], spese: [spesa('2026-10-05', 142)], inizioPiano: INIZIO, oggi: OGGI });
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ mediaReale: 142, nuovoMensile: 71, nuovoImportoRicorrenza: 142, n: 1, unita: 'bollette' });
  });

  it('luce: le ultime tre bollette fanno 71 al mese', () => {
    const spese = [spesa('2026-04-05', 300), spesa('2026-06-05', 142), spesa('2026-08-05', 142), spesa('2026-10-05', 142)];
    const r = proponiStime({ voci: [luce], spese, inizioPiano: INIZIO, oggi: OGGI });
    expect(r).toEqual([
      {
        itemId: 'luce',
        nome: 'Luce',
        categoriaId: 'cat-luce',
        frequenzaMesi: 2,
        importoMensileAttuale: 55,
        mediaReale: 142,
        nuovoMensile: 71,
        nuovoImportoRicorrenza: 142,
        n: 4,
        unita: 'bollette',
      },
    ]);
  });

  it('la media arrotonda ai centesimi', () => {
    const spese = [spesa('2026-06-05', 100), spesa('2026-08-05', 100), spesa('2026-10-05', 101)];
    const r = proponiStime({ voci: [luce], spese, inizioPiano: INIZIO, oggi: OGGI });
    expect(r[0].mediaReale).toBe(100.33);
    expect(r[0].nuovoMensile).toBe(50.17);
  });

  it('sotto soglia: nessuna proposta', () => {
    const r = proponiStime({ voci: [luce], spese: [spesa('2026-10-05', 112)], inizioPiano: INIZIO, oggi: OGGI });
    expect(r).toEqual([]);
  });

  it('senza bollette: nessuna proposta', () => {
    expect(proponiStime({ voci: [luce], spese: [], inizioPiano: INIZIO, oggi: OGGI })).toEqual([]);
  });

  it('una voce già reale non si propone', () => {
    const reale = { ...luce, origineStima: 'reale' as const };
    const r = proponiStime({ voci: [reale], spese: [spesa('2026-10-05', 142)], inizioPiano: INIZIO, oggi: OGGI });
    expect(r).toEqual([]);
  });

  it('una voce scelta dall utente è ancora una stima', () => {
    const utente = { ...luce, origineStima: 'utente' as const };
    const r = proponiStime({ voci: [utente], spese: [spesa('2026-10-05', 142)], inizioPiano: INIZIO, oggi: OGGI });
    expect(r).toHaveLength(1);
  });

  it('le spese prima dell inizio del piano non contano', () => {
    const r = proponiStime({ voci: [luce], spese: [spesa('2025-12-20', 400)], inizioPiano: INIZIO, oggi: OGGI });
    expect(r).toEqual([]);
  });
});

describe('proponiStime, voci mensili', () => {
  const alimentare = voce({ id: 'ali', nome: 'Spesa alimentare', importoRicorrenza: 300, importoMensile: 300 });
  const s = (data: string, importo: number) => spesa(data, importo, 'cat-ali');

  it('soglia del 5 per cento: media degli ultimi tre mesi chiusi', () => {
    const spese = [
      s('2026-07-10', 100),
      s('2026-08-03', 200),
      s('2026-08-20', 130),
      s('2026-09-15', 330),
      s('2026-10-31', 330),
      s('2026-11-02', 900),
    ];
    const r = proponiStime({ voci: [alimentare], spese, inizioPiano: INIZIO, oggi: OGGI });
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ mediaReale: 330, nuovoMensile: 330, nuovoImportoRicorrenza: 330, unita: 'mesi', n: 4 });
  });

  it('un solo mese chiuso basta', () => {
    const r = proponiStime({ voci: [alimentare], spese: [s('2026-10-10', 400)], inizioPiano: INIZIO, oggi: OGGI });
    expect(r[0]).toMatchObject({ mediaReale: 400, n: 1, unita: 'mesi' });
  });

  it('il mese in corso non conta', () => {
    const r = proponiStime({ voci: [alimentare], spese: [s('2026-11-02', 900)], inizioPiano: INIZIO, oggi: OGGI });
    expect(r).toEqual([]);
  });

  it('entro la soglia: nessuna proposta', () => {
    const r = proponiStime({ voci: [alimentare], spese: [s('2026-10-10', 310)], inizioPiano: INIZIO, oggi: OGGI });
    expect(r).toEqual([]);
  });
});

describe('proponiStime, ignora e casi esclusi', () => {
  const con = (n: number | null) => ({ ...luce, stimaIgnorataConN: n });
  const tre = [spesa('2026-06-05', 142), spesa('2026-08-05', 142), spesa('2026-10-05', 142)];

  it('riproposta solo dopo una nuova bolletta', () => {
    const quattro = [...tre, spesa('2026-03-05', 142)];
    expect(proponiStime({ voci: [con(3)], spese: tre, inizioPiano: INIZIO, oggi: OGGI })).toEqual([]);
    expect(proponiStime({ voci: [con(3)], spese: quattro, inizioPiano: INIZIO, oggi: OGGI })).toHaveLength(1);
  });

  it('ignorata con 1 bolletta: ritorna alla seconda', () => {
    expect(proponiStime({ voci: [con(1)], spese: [tre[2]], inizioPiano: INIZIO, oggi: OGGI })).toEqual([]);
    expect(proponiStime({ voci: [con(1)], spese: tre.slice(1), inizioPiano: INIZIO, oggi: OGGI })).toHaveLength(1);
  });

  it('ignora voci senza categoria e spese di riconciliazione', () => {
    const senza = { ...luce, categoriaId: null };
    expect(proponiStime({ voci: [senza], spese: tre, inizioPiano: INIZIO, oggi: OGGI })).toEqual([]);
    const ric = tre.map((x) => ({ ...x, origine: 'riconciliazione' as const }));
    expect(proponiStime({ voci: [luce], spese: ric, inizioPiano: INIZIO, oggi: OGGI })).toEqual([]);
  });

  it('ignora le entrate e le spese di altre categorie', () => {
    const altre = [{ ...tre[0], tipo: 'income' as const }, spesa('2026-10-05', 500, 'cat-altra')];
    expect(proponiStime({ voci: [luce], spese: altre, inizioPiano: INIZIO, oggi: OGGI })).toEqual([]);
  });
});

function bundleEsempio(extra?: { esceDal?: string }): PlanBundle {
  const items: PlanItem[] = ESEMPIO_VOCI.map((v, i) => ({
    id: `i${i}`,
    planId: 'P1',
    nome: v.nome,
    categoriaId: `cat-${v.chiave}`,
    frequenzaMesi: v.frequenzaMesi,
    importoRicorrenza: v.importoRicorrenza,
    importoMensile: v.importoRicorrenza / v.frequenzaMesi,
    origineStima: 'suggerita',
    goalId: v.chiave === 'assicurazione' ? 'G1' : null,
    stimaIgnorataConN: v.chiave === 'assicurazione' ? 4 : null,
    ordine: i,
  }));
  return {
    plan: {
      id: 'P1',
      householdId: 'H1',
      validoDal: '2026-10-01',
      giornoVersamento: 5,
      regola: 'proporzionale',
      cuscinettoObiettivo: 700,
      cuscinettoQuotaMensile: 59,
      arrotondamento: 10,
      totaleMensile: 1380,
      createdAt: '2026-09-20T10:00:00Z',
    },
    items,
    shares: [
      { planId: 'P1', slot: 1, userId: 'u1', displayName: 'Fabio', redditoNettoMensile: 1800, redditoIrregolare: false, percentuale: null, inCasaDal: null, esceDal: null, quotaMensile: 776 },
      { planId: 'P1', slot: 2, userId: 'u2', displayName: 'Anna', redditoNettoMensile: 1400, redditoIrregolare: false, percentuale: null, inCasaDal: null, esceDal: extra?.esceDal ?? null, quotaMensile: 604 },
    ],
  };
}

function propostaLuce(bundle: PlanBundle) {
  const item = bundle.items.find((i) => i.nome === 'Luce')!;
  return proponiStime({
    voci: [item],
    spese: [spesa('2026-10-05', 142, item.categoriaId!)],
    inizioPiano: INIZIO,
    oggi: OGGI,
  })[0];
}

describe('pianoConStimaAggiornata', () => {
  it('ricalcola totale e quote dal mese indicato', () => {
    const bundle = bundleEsempio();
    const v = pianoConStimaAggiornata(bundle, propostaLuce(bundle), '2026-12-01')!;
    expect(v.validoDal).toBe('2026-12-01');
    expect(v.totaleMensile).toBe(1400);
    expect(v.quote.map((q) => [q.displayName, q.quotaMensile])).toEqual([['Fabio', 788], ['Anna', 612]]);
    expect(v.regola).toBe('proporzionale');
    expect(v.cuscinettoQuotaMensile).toBe(59);
    expect(v.arrotondamento).toBe(10);
    expect(v.giornoVersamento).toBe(5);
    const l = v.voci.find((x) => x.nome === 'Luce')!;
    expect(l).toMatchObject({ importoRicorrenza: 142, origineStima: 'reale', stimaIgnorataConN: null });
  });

  it('le altre voci restano com erano, con obiettivo e ignora', () => {
    const bundle = bundleEsempio();
    const v = pianoConStimaAggiornata(bundle, propostaLuce(bundle), '2026-12-01')!;
    const conGoal = bundle.items.find((i) => i.goalId)!;
    const ass = v.voci.find((x) => x.nome === conGoal.nome)!;
    expect(ass.goalId).toBe('G1');
    expect(ass.stimaIgnorataConN).toBe(4);
    expect(ass.origineStima).toBe('suggerita');
    expect(v.voci).toHaveLength(bundle.items.length);
    expect(v.voci.map((x) => x.ordine)).toEqual(bundle.items.map((i) => i.ordine));
  });

  it('le voci con categoria non rinominano la categoria; la voce senza categoria tiene il nome', () => {
    const bundle = bundleEsempio();
    const senza = bundle.items.find((i) => i.nome === 'Luce')!;
    const bundleSenza: PlanBundle = {
      ...bundle,
      items: bundle.items.map((i) => (i.id === senza.id ? { ...i, categoriaId: null } : i)),
    };
    const proposta = propostaLuce(bundle);
    const v = pianoConStimaAggiornata(bundleSenza, proposta, '2026-12-01')!;
    for (const voce of v.voci) {
      if (voce.categoriaId !== null) expect(voce.categoriaNome).toBe('');
    }
    const nullVoce = v.voci.find((x) => x.categoriaId === null)!;
    expect(nullVoce.categoriaNome).toBe(nullVoce.nome);
    expect(v.voci.filter((x) => x.categoriaId !== null).length).toBeGreaterThan(0);
  });

  it('con una quota che esce dal piano non propone nulla', () => {
    const bundle = bundleEsempio({ esceDal: '2027-01-01' });
    expect(pianoConStimaAggiornata(bundle, propostaLuce(bundleEsempio()), '2026-12-01')).toBeNull();
  });

  it('chi è già uscito prima del mese nuovo non blocca la stima: resta a 0 e non entra nella divisione', () => {
    const bundle = bundleEsempio({ esceDal: '2026-11-01' });
    const v = pianoConStimaAggiornata(bundle, propostaLuce(bundleEsempio()), '2026-12-01')!;
    expect(v).not.toBeNull();
    const uscito = v.quote.find((q) => q.esceDal === '2026-11-01')!;
    expect(uscito.quotaMensile).toBe(0);
    const altri = v.quote.filter((q) => q !== uscito);
    expect(altri.reduce((s, q) => s + q.quotaMensile, 0)).toBe(v.totaleMensile);
  });

  it('con una voce che non c è più non propone nulla', () => {
    const bundle = bundleEsempio();
    expect(pianoConStimaAggiornata(bundle, { ...propostaLuce(bundle), itemId: 'xx' }, '2026-12-01')).toBeNull();
  });
});

describe('inizioProveStime', () => {
  it('è la data più vecchia fra le versioni, non quella in vigore', () => {
    const b = (d: string) => ({ plan: { validoDal: d } }) as unknown as PlanBundle;
    expect(inizioProveStime([b('2026-11-01'), b('2026-01-01'), b('2026-12-01')], 'x')).toBe('2026-01-01');
    expect(inizioProveStime([], '2026-05-01')).toBe('2026-05-01');
  });
});

describe('quoteDelConfronto', () => {
  it('mostra prima e dopo per ogni persona', () => {
    const bundle = bundleEsempio();
    const v = pianoConStimaAggiornata(bundle, propostaLuce(bundle), '2026-12-01')!;
    expect(quoteDelConfronto(bundle, v)).toEqual([
      { nome: 'Fabio', prima: 776, dopo: 788 },
      { nome: 'Anna', prima: 604, dopo: 612 },
    ]);
  });
});

describe('puoAggiornarePiano', () => {
  const piano = (validoDal: string): PlanBundle => {
    const b = bundleEsempio();
    return { ...b, plan: { ...b.plan, validoDal } };
  };
  it('vero se nessuna versione parte dopo il mese corrente', () => {
    expect(puoAggiornarePiano([piano('2026-10-01')], '2026-11-01')).toBe(true);
  });
  it('falso se esiste una versione futura', () => {
    expect(puoAggiornarePiano([piano('2026-10-01'), piano('2026-12-01')], '2026-11-01')).toBe(false);
  });
});
