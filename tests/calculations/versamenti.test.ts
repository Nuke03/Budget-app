import { describe, it, expect } from 'vitest';
import {
  accantonatoObiettivo,
  computeAccantonatoConVersamenti,
  computeAccantonatoFinora,
  computeQuotaMensile,
} from '@/lib/calculations/accantonato';
import { computeDisponibileLibero, riservatoObiettivi } from '@/lib/calculations/disponibile';
import { obiettiviCorti } from '@/lib/calculations/supporto/consiglio';
import { prossimaCosa, promemoriaVersamento } from '@/lib/calculations/supporto/home';
import { numeriLezione } from '@/lib/calculations/percorso/numeri';
import { rifondaImprevisti } from '@/lib/calculations/percorso/rifondaImprevisti';
import type { GoalForCalc } from '@/lib/calculations/types';
import type { DatiRegole } from '@/lib/calculations/percorso/regole';
import type { BudgetGoal } from '@/lib/types';
import { PAROLE_VIETATE } from '../helpers/paroleVietate';

// 1200 € in 6 mesi (giugno -> dicembre): 200 al mese. A metà settembre sono passati 3 mesi: 600 a tempo.
const oggi = new Date(2026, 8, 15);
const base: GoalForCalc = {
  importoTarget: 1200,
  modalita: 'dilazionato',
  stato: 'aperto',
  scadenza: '2026-12-01',
  createdAt: '2026-06-01T00:00:00Z',
  ricorrente: false,
  frequenzaMesi: null,
};
const conti = [{ saldoAttuale: 2000, contaInDisponibile: true }];

describe('computeAccantonatoConVersamenti', () => {
  it('senza conferme (null) è identico a computeAccantonatoFinora, con e senza speso', () => {
    for (const speso of [0, 50, 700]) {
      expect(computeAccantonatoConVersamenti(base, oggi, speso, null)).toBe(computeAccantonatoFinora(base, oggi, speso));
    }
    expect(computeAccantonatoFinora(base, oggi, 0)).toBe(600);
  });

  it('una conferma sotto la quota a tempo: riserva quanto confermato', () => {
    expect(computeAccantonatoConVersamenti(base, oggi, 0, 400)).toBe(400);
  });

  it('una conferma sopra la quota a tempo: riserva al massimo la quota a tempo', () => {
    expect(computeAccantonatoConVersamenti(base, oggi, 0, 900)).toBe(600);
  });

  it('con lo speso collegato: il minore fra i due, meno lo speso, mai sotto zero', () => {
    expect(computeAccantonatoConVersamenti(base, oggi, 100, 400)).toBe(300);
    expect(computeAccantonatoConVersamenti(base, oggi, 100, 900)).toBe(500);
    expect(computeAccantonatoConVersamenti(base, oggi, 450, 400)).toBe(0);
  });

  it('un obiettivo bloccato ignora le conferme', () => {
    const bloccato: GoalForCalc = { ...base, modalita: 'bloccato', scadenza: null };
    expect(computeAccantonatoConVersamenti(bloccato, oggi, 0, 10)).toBe(1200);
  });
});

describe('senza conferme i numeri non cambiano', () => {
  const g = { ...base, specoCollegato: 30 };
  const gNull = { ...base, specoCollegato: 30, versatoNellaFinestra: null };
  const gAssente = { ...base, specoCollegato: 30 };

  it('accantonatoObiettivo e riservatoObiettivi', () => {
    expect(accantonatoObiettivo(gNull, oggi)).toBe(computeAccantonatoFinora(g, oggi, 30));
    expect(accantonatoObiettivo(gAssente, oggi)).toBe(570);
    expect(riservatoObiettivi([gNull], oggi)).toBe(riservatoObiettivi([g], oggi));
    expect(riservatoObiettivi([gNull], oggi)).toBe(570);
  });

  it('il disponibile della Home', () => {
    expect(computeDisponibileLibero(conti, [gNull], oggi)).toBe(1430);
    expect(computeDisponibileLibero(conti, [gNull], oggi)).toBe(computeDisponibileLibero(conti, [g], oggi));
  });

  it('la card dell\'obiettivo (riservato e quota mensile)', () => {
    expect(accantonatoObiettivo(gNull, oggi)).toBe(accantonatoObiettivo(g, oggi));
    expect(computeQuotaMensile(gNull, oggi)).toBe(200);
  });

  it('obiettiviCorti', () => {
    const goal = (over: Partial<BudgetGoal & { specoCollegato: number; versatoNellaFinestra: number | null }>) => ({
      id: 'g1', nome: 'Assicurazione', importoTarget: 1200, modalita: 'dilazionato' as const, scadenza: '2026-12-01',
      categoriaId: null, ricorrente: false, frequenzaMesi: null, stato: 'aperto' as const,
      createdAt: '2026-06-01T00:00:00Z', specoCollegato: 0, ...over,
    });
    expect(obiettiviCorti([goal({ versatoNellaFinestra: null })], 0, oggi)).toEqual(obiettiviCorti([goal({})], 0, oggi));
    expect(obiettiviCorti([goal({})], 0, oggi)).toEqual([]);
  });
});

describe('con conferme il disponibile libero sale (i soldi non sono ancora messi da parte davvero)', () => {
  it('conferma sotto la quota: il riservato scende al confermato', () => {
    const g = { ...base, versatoNellaFinestra: 400 };
    expect(riservatoObiettivi([g], oggi)).toBe(400);
    expect(computeDisponibileLibero(conti, [g], oggi)).toBe(1600);
  });

  it('conferma sopra la quota: resta la quota a tempo', () => {
    const g = { ...base, versatoNellaFinestra: 900 };
    expect(computeDisponibileLibero(conti, [g], oggi)).toBe(1400);
  });

  it('obiettiviCorti: chi ha confermato meno della quota ha più da recuperare', () => {
    const goal = {
      id: 'g1', nome: 'Assicurazione', importoTarget: 1200, modalita: 'dilazionato' as const, scadenza: '2026-12-01',
      categoriaId: null, ricorrente: false, frequenzaMesi: null, stato: 'aperto' as const,
      createdAt: '2026-06-01T00:00:00Z', specoCollegato: 0,
    };
    // 3 mesi rimasti x 200 = 600 = quanto manca a tempo: non è corto. Con 400 confermati mancano 800: è corto.
    expect(obiettiviCorti([goal], 0, oggi)).toEqual([]);
    expect(obiettiviCorti([{ ...goal, versatoNellaFinestra: 400 }], 0, oggi)).toEqual([
      { goalId: 'g1', nome: 'Assicurazione', mancano: 800 },
    ]);
  });
});

describe('rifondaImprevisti con un fondo che ha conferme', () => {
  it('prende l\'accantonato già calcolato (con le conferme) e non cambia da solo', () => {
    const fondo: BudgetGoal = {
      id: 'f', nome: 'Cuscinetto', importoTarget: 1200, modalita: 'dilazionato', scadenza: '2026-12-01',
      categoriaId: null, ricorrente: false, frequenzaMesi: null, stato: 'aperto',
      createdAt: '2026-06-01T00:00:00Z', ruolo: 'imprevisti',
    };
    const accantonato = accantonatoObiettivo({ ...fondo, versatoNellaFinestra: 400 }, oggi);
    expect(accantonato).toBe(400);
    // spesa sotto l'accantonato: il fondo si allunga; sopra: ricomincia
    expect(rifondaImprevisti({ goal: fondo, accantonato, spesa: 100, oggi: '2026-09-15' }).azione).toBe('estendi');
    expect(rifondaImprevisti({ goal: fondo, accantonato, spesa: 500, oggi: '2026-09-15' }).azione).toBe('ricomincia');
  });
});

describe('promemoriaVersamento (Da fare)', () => {
  const goal = (over: Partial<BudgetGoal & { versatoNellaFinestra: number | null; confermatoMese: number }> = {}) => ({
    id: 'g1', nome: 'Assicurazione', importoTarget: 1200, modalita: 'dilazionato' as const, scadenza: '2026-12-01',
    categoriaId: null, ricorrente: false, frequenzaMesi: null, stato: 'aperto' as const,
    createdAt: '2026-06-01T00:00:00Z', versatoNellaFinestra: null, confermatoMese: 0, ...over,
  });

  it('solo per chi ha già almeno una conferma, quando il mese non è confermato', () => {
    expect(promemoriaVersamento([goal()], oggi)).toBeNull();
    const p = promemoriaVersamento([goal({ versatoNellaFinestra: 200, confermatoMese: 0 })], oggi);
    expect(p).toEqual({ testo: 'Hai messo da parte i 200 € per Assicurazione questo mese?', href: '/goals#goal-g1' });
  });

  it('tace se la quota del mese è già confermata', () => {
    expect(promemoriaVersamento([goal({ versatoNellaFinestra: 200, confermatoMese: 200 })], oggi)).toBeNull();
    expect(promemoriaVersamento([goal({ versatoNellaFinestra: 300, confermatoMese: 250 })], oggi)).toBeNull();
  });

  it('tace appena c è una conferma nel mese, anche piccola: la domanda non si ripete', () => {
    expect(promemoriaVersamento([goal({ versatoNellaFinestra: 300, confermatoMese: 100 })], oggi)).toBeNull();
    expect(promemoriaVersamento([goal({ versatoNellaFinestra: 300, confermatoMese: 0.01 })], oggi)).toBeNull();
  });

  it('ignora i bloccati e i non aperti', () => {
    expect(promemoriaVersamento([goal({ modalita: 'bloccato', scadenza: null, versatoNellaFinestra: 5 })], oggi)).toBeNull();
    expect(promemoriaVersamento([goal({ stato: 'chiuso', versatoNellaFinestra: 5 })], oggi)).toBeNull();
  });

  it('un obiettivo con dati incompleti non rompe gli altri', () => {
    const rotto = goal({ id: 'x', scadenza: null, versatoNellaFinestra: 5 });
    const buono = goal({ versatoNellaFinestra: 200 });
    expect(promemoriaVersamento([rotto, buono], oggi)?.href).toBe('/goals#goal-g1');
  });

  it('nessuna parola vietata, nessuna colpa', () => {
    const t = promemoriaVersamento([goal({ versatoNellaFinestra: 200 })], oggi)!.testo.toLowerCase();
    for (const p of PAROLE_VIETATE) expect(t).not.toContain(p);
  });

  it('nel Da fare viene dopo ogni altra voce', () => {
    const versamento = { testo: 'Hai messo da parte i 200 € per X questo mese?', href: '/goals#goal-g1' };
    const attesa = { testo: 'Ci ripensi?', href: '/impara/attesa' };
    const casa = [{ testo: 'Versa la quota', href: '/casa/versa' }];
    const piva = [{ testo: 'Da spostare', href: '/piva', urgente: false }];
    const inPari = { dal: '2026-11-08', al: '2026-11-10' };

    expect(prossimaCosa({ inPari: null, promemoriaCasa: [], versamento })).toEqual({ ...versamento, tipo: 'obiettivo' });
    expect(prossimaCosa({ inPari: null, promemoriaCasa: [], attesa, versamento })?.tipo).toBe('attesa');
    expect(prossimaCosa({ inPari: null, promemoriaCasa: casa, versamento })?.tipo).toBe('casa');
    expect(prossimaCosa({ inPari: null, promemoriaCasa: [], promemoriaPiva: piva, versamento })?.tipo).toBe('piva');
    expect(prossimaCosa({ inPari, promemoriaCasa: [], versamento })?.tipo).toBe('in_pari');
  });
});

describe('numeriLezione: prima-da-parte', () => {
  const dati = (goals: DatiRegole['goals']): DatiRegole => ({
    oggi: '2026-09-15', transazioni: [], categorie: [], goals, lezioni: {}, percorso: null,
    disponibileReale: 0, disponibileLibero: 0, ultimaEntrataIl: null, primiPassiVisibili: false,
  });
  const goal = (over: Partial<DatiRegole['goals'][number]>) => ({
    id: 'g1', nome: 'Assicurazione', importoTarget: 1200, modalita: 'dilazionato' as const, scadenza: '2026-12-01',
    categoriaId: null, ricorrente: false, frequenzaMesi: null, stato: 'aperto' as const,
    createdAt: '2026-06-01T00:00:00Z', accantonato: 0, ...over,
  });

  it('dice quanto hai confermato questo mese', () => {
    const f = numeriLezione('prima-da-parte', dati([goal({ confermatoMese: 150 })]));
    expect(f).toContain('150 €');
    expect(f).toContain('Assicurazione');
    for (const p of PAROLE_VIETATE) expect(f!.toLowerCase()).not.toContain(p);
  });

  it('niente conferme questo mese, niente frase', () => {
    expect(numeriLezione('prima-da-parte', dati([goal({ confermatoMese: 0 })]))).toBeNull();
    expect(numeriLezione('prima-da-parte', dati([goal({})]))).toBeNull();
  });
});
