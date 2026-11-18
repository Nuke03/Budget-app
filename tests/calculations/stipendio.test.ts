import { describe, it, expect } from 'vitest';
import {
  incassiPerMese,
  speseDelMese,
  propostaStipendio,
  homeConStipendio,
  revisioneStipendio,
  fineMese,
} from '@/lib/calculations/stipendio';
import type { Transaction } from '@/lib/types';

function tx(o: Partial<Transaction>): Transaction {
  return {
    id: 'x', tipo: 'expense', importo: 0, data: '2026-11-05', categoriaId: null,
    accountId: 'c1', goalId: null, descrizione: '', nota: null,
    createdAt: '2026-01-01T00:00:00Z', stima: false, ...o,
  };
}

describe('incassiPerMese', () => {
  it('ultimi mesi interi, escluso quello in corso, dal più vecchio', () => {
    const t = [
      tx({ tipo: 'income', categoriaId: 'f', data: '2026-09-10', importo: 100 }),
      tx({ tipo: 'income', categoriaId: 'f', data: '2026-10-10', importo: 200 }),
      tx({ tipo: 'income', categoriaId: 'f', data: '2026-10-20', importo: 50 }),
      tx({ tipo: 'income', categoriaId: 'f', data: '2026-11-02', importo: 999 }),
      tx({ tipo: 'income', categoriaId: 'altro', data: '2026-10-02', importo: 999 }),
    ];
    expect(incassiPerMese(t, 'f', '2026-11-18', 3)).toEqual([0, 100, 250]);
  });
  it('attraversa il cambio anno', () => {
    const t = [tx({ tipo: 'income', categoriaId: 'f', data: '2025-12-31', importo: 70 })];
    expect(incassiPerMese(t, 'f', '2026-01-15', 2)).toEqual([0, 70]);
  });
});

describe('speseDelMese', () => {
  it('esclude obiettivi, conti fuori dal disponibile, altri mesi ed entrate', () => {
    const t = [
      tx({ importo: 100 }),
      tx({ importo: 50, goalId: 'g' }),
      tx({ importo: 40, accountId: 'altro' }),
      tx({ importo: 30, data: '2026-10-30' }),
      tx({ importo: 20, tipo: 'income' }),
    ];
    expect(speseDelMese(t, new Set(['c1']), '2026-11')).toBe(100);
  });
});

describe('propostaStipendio', () => {
  it('incassi netti 1650, servono 1300 → 1300', () => {
    const r = propostaStipendio({
      incassiMensili: [1912, 1912, 1912], mesiConIncassi: 3, percentuale: 13.7,
      speseMensili: [600, 700], quotaCasaMensile: 650, incassoMeseMagro: null,
    });
    expect(r.a).toBe(1650);
    expect(r.b).toBe(1300);
    expect(r.proposta).toBe(1300);
    expect(r.serveMeseMagro).toBe(false);
  });
  it('meno di 3 mesi e mese magro 1000 al 13.7% → a 860', () => {
    const r = propostaStipendio({
      incassiMensili: [], mesiConIncassi: 1, percentuale: 13.7,
      speseMensili: [], quotaCasaMensile: 1500, incassoMeseMagro: 1000,
    });
    expect(r.a).toBe(860);
    expect(r.b).toBe(1500);
    expect(r.proposta).toBe(860);
  });
  it('meno di 3 mesi senza mese magro → serveMeseMagro, proposta null, mai NaN', () => {
    const r = propostaStipendio({
      incassiMensili: [], mesiConIncassi: 0, percentuale: 13.7,
      speseMensili: [], quotaCasaMensile: 0, incassoMeseMagro: null,
    });
    expect(r.a).toBeNull();
    expect(r.proposta).toBeNull();
    expect(r.serveMeseMagro).toBe(true);
    expect(r.b).toBe(0);
  });
});

describe('homeConStipendio', () => {
  it('disponibile 2900, stipendio 1300, spese 660 → mostrato 640, cuscinetto 2260, mesi 1.7', () => {
    const r = homeConStipendio({
      disponibileLibero: 2900, stipendio: 1300, speseMese: 660, versatoCasaMese: 0, riservaVersamento: 0,
    });
    expect(r).toEqual({ mostrato: 640, rimasto: 640, cuscinetto: 2260, mesiCoperti: 1.7 });
  });
  it('disponibile sotto lo stipendio rimasto → cuscinetto 0', () => {
    const r = homeConStipendio({
      disponibileLibero: 300, stipendio: 1300, speseMese: 660, versatoCasaMese: 0, riservaVersamento: 0,
    });
    expect(r.mostrato).toBe(300);
    expect(r.cuscinetto).toBe(0);
    expect(r.mesiCoperti).toBe(0);
  });
  it('stipendio 0 non produce NaN', () => {
    const r = homeConStipendio({
      disponibileLibero: 100, stipendio: 0, speseMese: 0, versatoCasaMese: 0, riservaVersamento: 0,
    });
    expect(r.mesiCoperti).toBe(0);
  });
});

describe('proposta senza spese', () => {
  it('senza spese né casa B non c è: la proposta è A, mai 0, e la revisione non dice 0 €', () => {
    const r = propostaStipendio({
      incassiMensili: [1000, 1000, 1000], mesiConIncassi: 3, percentuale: 13.7,
      speseMensili: [], quotaCasaMensile: 0, incassoMeseMagro: null,
    });
    expect(r.b).toBe(0);
    expect(r.proposta).toBe(860);
    const nulla = propostaStipendio({
      incassiMensili: [0, 0, 0], mesiConIncassi: 3, percentuale: 13.7,
      speseMensili: [], quotaCasaMensile: 0, incassoMeseMagro: null,
    });
    expect(nulla.proposta).toBeNull();
    expect(revisioneStipendio(500, nulla.proposta, '2026-01-01', '2026-11-30')).toBeNull();
  });
});

describe('revisioneStipendio', () => {
  it('niente prima di 3 mesi', () => {
    expect(revisioneStipendio(1000, 1500, '2026-09-01', '2026-11-30')).toBeNull();
  });
  it('dopo 3 mesi e oltre il 10% sale', () => {
    expect(revisioneStipendio(1000, 1500, '2026-08-18', '2026-11-18')).toBe(
      `Negli ultimi mesi hai incassato di più: puoi alzare lo stipendio a 1.500 €`,
    );
  });
  it('dopo 3 mesi e oltre il 10% scende', () => {
    expect(revisioneStipendio(1000, 800, '2026-01-01', '2026-11-18')).toBe(
      `Negli ultimi mesi sono entrati meno soldi: conviene abbassare lo stipendio a 800 €`,
    );
  });
  it('entro il 10% niente', () => {
    expect(revisioneStipendio(1000, 1100, '2026-01-01', '2026-11-18')).toBeNull();
  });
  it('null se proposta o rivistoIl assenti', () => {
    expect(revisioneStipendio(1000, null, '2026-01-01', '2026-11-18')).toBeNull();
    expect(revisioneStipendio(1000, 1500, null, '2026-11-18')).toBeNull();
  });
});

describe('fineMese', () => {
  it('ultimo giorno del mese, anche bisestile', () => {
    const d = fineMese('2028-02-10');
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2028, 1, 29]);
    const e = fineMese('2026-11-18');
    expect([e.getMonth(), e.getDate()]).toEqual([10, 30]);
  });
});
