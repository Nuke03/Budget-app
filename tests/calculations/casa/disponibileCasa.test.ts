import { describe, it, expect } from 'vitest';
import { computeDisponibileCasa, computeDaPagareMese } from '@/lib/calculations/casa/disponibileCasa';
import { PAROLE_VIETATE } from '../../helpers/paroleVietate';
import type { GoalForCalc } from '@/lib/calculations/types';

const TODAY = new Date('2026-11-15T12:00:00Z');

function conto(saldo: number, incluso = true) {
  return { saldoAttuale: saldo, contaInDisponibile: incluso };
}

function obiettivo(importo: number): GoalForCalc {
  return {
    importoTarget: importo,
    modalita: 'bloccato',
    stato: 'aperto',
    scadenza: null,
    createdAt: '2026-01-01T00:00:00Z',
    ricorrente: false,
    frequenzaMesi: null,
  };
}

describe('computeDisponibileCasa', () => {
  it('A meno B: 1000 di saldo e 130 messi da parte danno 870', () => {
    const r = computeDisponibileCasa({ conti: [conto(1000)], obiettivi: [obiettivo(130)], today: TODAY });
    expect(r.valore).toBe(870);
    expect(r.a).toBe(1000);
    expect(r.b).toBe(130);
  });

  it('il cuscinetto si riempie: E 1500 con obiettivo 1321 dà valore 179 e cuscinetto 1321', () => {
    const r = computeDisponibileCasa({ conti: [conto(1500)], obiettivi: [], today: TODAY, cuscinettoObiettivo: 1321 });
    expect(r.valore).toBe(179);
    expect(r.cuscinetto).toBe(1321);
  });

  it('E 1000 con obiettivo 1321 dà valore 0 e cuscinetto 1000', () => {
    const r = computeDisponibileCasa({ conti: [conto(1000)], obiettivi: [], today: TODAY, cuscinettoObiettivo: 1321 });
    expect(r.valore).toBe(0);
    expect(r.cuscinetto).toBe(1000);
  });

  it('E negativo resta negativo e il cuscinetto è 0: -50', () => {
    const r = computeDisponibileCasa({ conti: [conto(-50)], obiettivi: [], today: TODAY, cuscinettoObiettivo: 500 });
    expect(r.valore).toBe(-50);
    expect(r.cuscinetto).toBe(0);
  });

  it('crediti e daPagareMese si sottraggono: 1000, 45, 100 danno 855', () => {
    const r = computeDisponibileCasa({
      conti: [conto(1000)],
      obiettivi: [],
      today: TODAY,
      crediti: 45,
      daPagareMese: 100,
    });
    expect(r.valore).toBe(855);
    expect(r.c).toBe(45);
    expect(r.d).toBe(100);
  });

  it('gli ingredienti sommano al valore', () => {
    const r = computeDisponibileCasa({
      conti: [conto(1500)],
      obiettivi: [obiettivo(130)],
      today: TODAY,
      crediti: 45,
      daPagareMese: 100,
      cuscinettoObiettivo: 300,
    });
    const somma = r.spiegazione.ingredienti.reduce((s, i) => s + i.valore, 0);
    expect(somma).toBeCloseTo(r.valore, 2);
    expect(r.spiegazione.valore).toBe(r.valore);
    expect(r.spiegazione.ingredienti.some((i) => i.etichetta === 'Cuscinetto')).toBe(true);
  });

  it('nessuna parola vietata nella formula e nelle etichette', () => {
    const r = computeDisponibileCasa({
      conti: [conto(1500)],
      obiettivi: [obiettivo(130)],
      today: TODAY,
      cuscinettoObiettivo: 300,
    });
    const testo = [r.spiegazione.formula, ...r.spiegazione.ingredienti.map((i) => i.etichetta)].join(' ').toLowerCase();
    for (const parola of PAROLE_VIETATE) expect(testo).not.toContain(parola);
  });

  it('un conto escluso dal disponibile non conta in A', () => {
    const r = computeDisponibileCasa({ conti: [conto(1000), conto(500, false)], obiettivi: [], today: TODAY });
    expect(r.a).toBe(1000);
  });
});

describe('computeDaPagareMese', () => {
  const voci = [
    { categoriaId: 'aff', importoMensile: 750, frequenzaMesi: 1 },
    { categoriaId: 'spesa', importoMensile: 300, frequenzaMesi: 1 },
    { categoriaId: 'luce', importoMensile: 55, frequenzaMesi: 2 },
  ];
  const spesa = (categoriaId: string, importo: number, data: string, tipo: 'expense' | 'income' = 'expense') => ({
    tipo, importo, data, categoriaId,
  });
  const mese = '2026-11-01';

  it('toglie le spese già fatte nel mese', () => {
    const spese = [spesa('aff', 750, '2026-11-03'), spesa('spesa', 64.2, '2026-11-08'), spesa('spesa', 50, '2026-10-30')];
    expect(computeDaPagareMese({ voci, spese, mese })).toBe(235.8);
  });

  it('non va sotto zero se si è speso oltre il previsto', () => {
    const spese = [spesa('aff', 750, '2026-11-03'), spesa('spesa', 400, '2026-11-08')];
    expect(computeDaPagareMese({ voci, spese, mese })).toBe(0);
  });

  it('le voci con frequenza maggiore di 1 non contano', () => {
    expect(computeDaPagareMese({ voci: [voci[2]], spese: [], mese })).toBe(0);
  });

  it('le voci legate a un obiettivo aperto non contano (sono già in B)', () => {
    const v = [{ categoriaId: 'aff', importoMensile: 750, frequenzaMesi: 1, goalId: 'g1' }, voci[1]];
    expect(computeDaPagareMese({ voci: v, spese: [], mese, obiettiviApertiIds: ['g1'] })).toBe(300);
  });

  it('le voci legate a un obiettivo chiuso o scaduto restano da pagare', () => {
    const v = [{ categoriaId: 'aff', importoMensile: 750, frequenzaMesi: 1, goalId: 'g1' }, voci[1]];
    expect(computeDaPagareMese({ voci: v, spese: [], mese, obiettiviApertiIds: [] })).toBe(1050);
  });

  it('due voci nella stessa categoria dividono la spesa una volta sola', () => {
    const v = [
      { categoriaId: 'spesa', importoMensile: 300, frequenzaMesi: 1 },
      { categoriaId: 'spesa', importoMensile: 100, frequenzaMesi: 1 },
    ];
    expect(computeDaPagareMese({ voci: v, spese: [spesa('spesa', 150, '2026-11-08')], mese })).toBe(250);
  });

  it('le entrate non contano', () => {
    const spese = [spesa('aff', 750, '2026-11-03', 'income')];
    expect(computeDaPagareMese({ voci: [voci[0]], spese, mese })).toBe(750);
  });
});

describe('computeDisponibileCasa con cuscinetto', () => {
  it('la formula dice a che punto è il cuscinetto', () => {
    const r = computeDisponibileCasa({
      conti: [conto(1000)], obiettivi: [], today: TODAY, cuscinettoObiettivo: 1321, cuscinettoQuotaMensile: 59,
    });
    expect(r.spiegazione.formula).toContain('Cuscinetto 1.000 di 1.321 €, pieno tra circa 6 mesi.');
    const testo = [r.spiegazione.formula, ...r.spiegazione.ingredienti.map((i) => i.etichetta)].join(' ').toLowerCase();
    for (const parola of PAROLE_VIETATE) expect(testo).not.toContain(parola);
  });
});
