import { describe, it, expect } from 'vitest';
import { computeAccantonatoFinora } from '@/lib/calculations/accantonato';
import { rifondaImprevisti } from '@/lib/calculations/percorso/rifondaImprevisti';
import type { BudgetGoal } from '@/lib/types';

const giorno = (s: string) => new Date(`${s}T12:00:00`);

const fondo = (over: Partial<BudgetGoal> = {}): BudgetGoal => ({
  id: 'g1', nome: 'Imprevisti', importoTarget: 200, modalita: 'dilazionato', scadenza: '2027-04-19',
  categoriaId: null, ricorrente: false, frequenzaMesi: null, stato: 'aperto',
  createdAt: '2026-06-19T10:00:00.000Z', accantonaDa: '2026-06-19', ruolo: 'imprevisti', ...over,
});

// Quanto risulta accantonato in un giorno, con la spesa collegata.
const acc = (g: BudgetGoal, oggi: string, speso: number) => computeAccantonatoFinora(g, giorno(oggi), speso);

describe('rifondaImprevisti: la spesa è più piccola di quanto accantonato', () => {
  // T=200 in 10 mesi (q=20); il 19/11/2026 sono passati 5 mesi: accantonati 100.
  it('S=40 (multiplo della quota): subito 60, +20 al mese, alla nuova scadenza 200', () => {
    const g = fondo();
    expect(acc(g, '2026-11-19', 0)).toBeCloseTo(100, 2);
    const r = rifondaImprevisti({ goal: g, accantonato: 100, spesa: 40, oggi: '2026-11-19' });
    expect(r.azione).toBe('estendi');
    if (r.azione !== 'estendi') return;
    const nuovo = fondo({ importoTarget: r.importoTarget, scadenza: r.scadenza });
    expect(r.importoTarget).toBeCloseTo(240, 2);
    expect(r.scadenza).toBe('2027-06-19');
    expect(acc(nuovo, '2026-11-19', 40)).toBeCloseTo(60, 1);
    expect(acc(nuovo, '2026-12-19', 40)).toBeCloseTo(80, 1);
    expect(acc(nuovo, '2027-01-19', 40)).toBeCloseTo(100, 1);
    expect(acc(nuovo, '2027-06-19', 40)).toBeCloseTo(200, 1);
  });

  it('S=50: subito 50, +20 al mese, alla nuova scadenza almeno 200 e meno di una quota in più', () => {
    const g = fondo();
    const r = rifondaImprevisti({ goal: g, accantonato: 100, spesa: 50, oggi: '2026-11-19' });
    if (r.azione !== 'estendi') throw new Error('atteso estendi');
    const nuovo = fondo({ importoTarget: r.importoTarget, scadenza: r.scadenza });
    expect(r.importoTarget).toBeCloseTo(260, 2);
    expect(r.scadenza).toBe('2027-07-19');
    expect(acc(nuovo, '2026-11-19', 50)).toBeCloseTo(50, 1);
    expect(acc(nuovo, '2026-12-19', 50)).toBeCloseTo(70, 1);
    const fine = acc(nuovo, '2027-07-19', 50);
    expect(fine).toBeGreaterThanOrEqual(200);
    expect(fine).toBeLessThan(220);
  });

  it('con una spesa già collegata prima: la nuova spesa toglie solo la sua parte', () => {
    // 30 già usati: accantonato 70. Poi altri 20.
    const g = fondo({ importoTarget: 240, scadenza: '2027-06-19' });
    expect(acc(g, '2026-11-19', 30)).toBeCloseTo(70, 1);
    const r = rifondaImprevisti({ goal: g, accantonato: 70, spesa: 20, oggi: '2026-11-19' });
    if (r.azione !== 'estendi') throw new Error('atteso estendi');
    const nuovo = fondo({ importoTarget: r.importoTarget, scadenza: r.scadenza });
    expect(acc(nuovo, '2026-11-19', 50)).toBeCloseTo(50, 1);
    expect(acc(nuovo, '2026-12-19', 50)).toBeCloseTo(70, 1);
  });

  it('fondo già al traguardo e scadenza passata: subito A-S, poi risale fino al traguardo', () => {
    const g = fondo({ createdAt: '2026-01-19T10:00:00.000Z', accantonaDa: '2026-01-19', scadenza: '2026-11-19' });
    expect(acc(g, '2027-01-19', 0)).toBeCloseTo(200, 2);
    const r = rifondaImprevisti({ goal: g, accantonato: 200, spesa: 50, oggi: '2027-01-19' });
    if (r.azione !== 'estendi') throw new Error('atteso estendi');
    const nuovo = fondo({ createdAt: g.createdAt, accantonaDa: g.accantonaDa, importoTarget: r.importoTarget, scadenza: r.scadenza });
    expect(acc(nuovo, '2027-01-19', 50)).toBeCloseTo(150, 1);
    expect(acc(nuovo, '2027-02-19', 50)).toBeGreaterThan(150);
    expect(acc(nuovo, r.scadenza, 50)).toBeGreaterThanOrEqual(199.99);
  });
});

describe('rifondaImprevisti: la spesa copre tutto quanto accantonato', () => {
  it('A=40, S=300, T=200, q=20: nuovo fondo a 0, dopo un mese 20, alla scadenza 200', () => {
    const g = fondo({ createdAt: '2026-09-19T10:00:00.000Z', accantonaDa: '2026-09-19', scadenza: '2027-07-19' });
    expect(acc(g, '2026-11-19', 0)).toBeCloseTo(40, 2);
    const r = rifondaImprevisti({ goal: g, accantonato: 40, spesa: 300, oggi: '2026-11-19' });
    expect(r.azione).toBe('ricomincia');
    if (r.azione !== 'ricomincia') return;
    expect(r.nuovo).toEqual({ importoTarget: 200, scadenza: '2027-09-19', accantonaDa: '2026-11-19' });
    const nuovo = fondo({ createdAt: '2026-11-19T10:00:00.000Z', accantonaDa: r.nuovo.accantonaDa, scadenza: r.nuovo.scadenza, importoTarget: r.nuovo.importoTarget });
    expect(acc(nuovo, '2026-11-19', 0)).toBe(0);
    expect(acc(nuovo, '2026-12-19', 0)).toBeCloseTo(20, 2);
    expect(acc(nuovo, '2027-09-19', 0)).toBeCloseTo(200, 2);
  });

  it('S uguale ad A: si ricomincia', () => {
    const r = rifondaImprevisti({ goal: fondo(), accantonato: 100, spesa: 100, oggi: '2026-11-19' });
    expect(r.azione).toBe('ricomincia');
  });

  it('S >= T: il fondo ricomincia lo stesso, con lo stesso traguardo e la stessa quota', () => {
    const g = fondo({ createdAt: '2026-01-19T10:00:00.000Z', accantonaDa: '2026-01-19', scadenza: '2026-11-19' });
    const r = rifondaImprevisti({ goal: g, accantonato: 200, spesa: 250, oggi: '2027-01-19' });
    if (r.azione !== 'ricomincia') throw new Error('atteso ricomincia');
    expect(r.nuovo.importoTarget).toBe(200);
    expect(r.nuovo.scadenza).toBe('2027-11-19');
    const nuovo = fondo({ createdAt: '2027-01-19T10:00:00.000Z', accantonaDa: r.nuovo.accantonaDa, scadenza: r.nuovo.scadenza });
    expect(acc(nuovo, '2027-01-19', 0)).toBe(0);
    expect(acc(nuovo, '2027-02-19', 0)).toBeCloseTo(20, 2);
    expect(acc(nuovo, '2027-11-19', 0)).toBeCloseTo(200, 2);
  });

  it('un fondo senza scadenza o ricorrente non si può estendere: si ricomincia', () => {
    const r = rifondaImprevisti({ goal: fondo({ scadenza: null }), accantonato: 100, spesa: 10, oggi: '2026-11-19' });
    expect(r.azione).toBe('ricomincia');
  });
});
