import { describe, it, expect } from 'vitest';
import { calcolaTotale, calcolaQuota, quoteReali, type PersonaQuotaInput } from '@/lib/calculations/casa/quota';
import type { RegolaQuota } from '@/lib/types';

const due: PersonaQuotaInput[] = [
  { slot: 1, nome: 'Fabio', redditoNetto: 1800 },
  { slot: 2, nome: 'Giulia', redditoNetto: 1400 },
];
const tre: PersonaQuotaInput[] = [...due, { slot: 3, nome: 'Marco', redditoNetto: 600 }];
const quote = (r: ReturnType<typeof calcolaQuota>) => r.persone.map((p) => p.quota);
const resta = (r: ReturnType<typeof calcolaQuota>) => r.persone.map((p) => p.resta);

describe('calcolaTotale', () => {
  it('1321 + 59 con arrotondamento 10 fa 1380', () => {
    expect(calcolaTotale(1321, 59, 10)).toBe(1380);
  });
  it('con 1321,33 + 59 fa 1390', () => {
    expect(calcolaTotale(1321.33, 59, 10)).toBe(1390);
  });
  it('con arrotondamento 1 fa 1381 su 1380,33', () => {
    expect(calcolaTotale(1321.33, 59, 1)).toBe(1381);
  });
});

describe('calcolaQuota a due', () => {
  it('parti uguali: 690 e 690, resta 1110 e 710, peso 0,383 e 0,493', () => {
    const r = calcolaQuota({ persone: due, totale: 1380, regola: 'parti_uguali' });
    expect(quote(r)).toEqual([690, 690]);
    expect(resta(r)).toEqual([1110, 710]);
    expect(r.persone[0].peso).toBeCloseTo(0.383, 3);
    expect(r.persone[1].peso).toBeCloseTo(0.493, 3);
  });
  it('proporzionale: 777 e 603, resta 1023 e 797, somma 1380', () => {
    const r = calcolaQuota({ persone: due, totale: 1380, regola: 'proporzionale' });
    expect(quote(r)).toEqual([777, 603]);
    expect(resta(r)).toEqual([1023, 797]);
  });
  it('pari residuo: 890 e 490, resta 910 e 910', () => {
    const r = calcolaQuota({ persone: due, totale: 1380, regola: 'pari_residuo' });
    expect(quote(r)).toEqual([890, 490]);
    expect(resta(r)).toEqual([910, 910]);
  });
});

describe('calcolaQuota a tre', () => {
  it('parti uguali: 460 a testa', () => {
    expect(quote(calcolaQuota({ persone: tre, totale: 1380, regola: 'parti_uguali' }))).toEqual([460, 460, 460]);
  });
  it('proporzionale: 655, 508 e 217 (il resto di 2 euro va al reddito maggiore)', () => {
    expect(quote(calcolaQuota({ persone: tre, totale: 1380, regola: 'proporzionale' }))).toEqual([655, 508, 217]);
  });
  it('pari residuo azzera il terzo e ricalcola sui restanti: 890, 490 e 0, resta 600 al terzo', () => {
    const r = calcolaQuota({ persone: tre, totale: 1380, regola: 'pari_residuo' });
    expect(quote(r)).toEqual([890, 490, 0]);
    expect(r.persone[2].resta).toBe(600);
  });
});

describe('calcolaQuota personalizzata', () => {
  const pers = (p1: number, p2: number, redditi = true): PersonaQuotaInput[] => [
    { slot: 1, nome: 'Fabio', redditoNetto: redditi ? 1800 : null, percentuale: p1 },
    { slot: 2, nome: 'Giulia', redditoNetto: redditi ? 1400 : null, percentuale: p2 },
  ];
  it('100 e 0 dà 1380 e 0', () => {
    expect(quote(calcolaQuota({ persone: pers(100, 0), totale: 1380, regola: 'personalizzata' }))).toEqual([1380, 0]);
  });
  it('70 e 30 dà 966 e 414', () => {
    expect(quote(calcolaQuota({ persone: pers(70, 30), totale: 1380, regola: 'personalizzata' }))).toEqual([966, 414]);
  });
  it('totale 1001 con 70 e 30 dà 701 e 300 (il resto va alla percentuale maggiore)', () => {
    expect(quote(calcolaQuota({ persone: pers(70, 30), totale: 1001, regola: 'personalizzata' }))).toEqual([701, 300]);
  });
  it('percentuali che non sommano a 100 (60 e 30) bloccano la regola', () => {
    const r = calcolaQuota({ persone: pers(60, 30), totale: 1380, regola: 'personalizzata' });
    expect(r.regolaDisponibile).toBe(false);
    expect(quote(r)).toEqual([0, 0]);
    expect(r.avvisi).toEqual([{ tipo: 'percentuali_non_100' }]);
    expect(JSON.stringify(r)).not.toContain('NaN');
  });
  it('percentuali 0 e 0 bloccano la regola', () => {
    const r = calcolaQuota({ persone: pers(0, 0), totale: 1380, regola: 'personalizzata' });
    expect(r.regolaDisponibile).toBe(false);
    expect(quote(r)).toEqual([0, 0]);
    expect(r.avvisi).toEqual([{ tipo: 'percentuali_non_100' }]);
    expect(JSON.stringify(r)).not.toContain('NaN');
  });
  it('percentuali null bloccano la regola', () => {
    const r = calcolaQuota({
      persone: [
        { slot: 1, nome: 'Fabio', redditoNetto: 1800, percentuale: null },
        { slot: 2, nome: 'Giulia', redditoNetto: 1400 },
      ],
      totale: 1380,
      regola: 'personalizzata',
    });
    expect(r.regolaDisponibile).toBe(false);
    expect(quote(r)).toEqual([0, 0]);
    expect(r.avvisi).toEqual([{ tipo: 'percentuali_non_100' }]);
    expect(JSON.stringify(r)).not.toContain('NaN');
  });
  it('una percentuale negativa (120 e -20) blocca la regola', () => {
    const r = calcolaQuota({ persone: pers(120, -20), totale: 1380, regola: 'personalizzata' });
    expect(r.regolaDisponibile).toBe(false);
    expect(quote(r)).toEqual([0, 0]);
    expect(r.avvisi).toEqual([{ tipo: 'percentuali_non_100' }]);
  });
  it('quoteReali con percentuali non valide dà zeri', () => {
    expect(quoteReali(pers(60, 30), 1380, 'personalizzata')).toEqual([0, 0]);
  });
  it('non richiede i redditi', () => {
    const r = calcolaQuota({ persone: pers(70, 30, false), totale: 1380, regola: 'personalizzata' });
    expect(r.regolaDisponibile).toBe(true);
    expect(quote(r)).toEqual([966, 414]);
    expect(r.persone[0].resta).toBeNull();
  });
});

describe('calcolaQuota casi limite', () => {
  it('N = 1: tutte le regole danno 1380', () => {
    const uno: PersonaQuotaInput[] = [{ slot: 1, nome: 'Fabio', redditoNetto: 1800, percentuale: 100 }];
    const regole: RegolaQuota[] = ['parti_uguali', 'proporzionale', 'pari_residuo', 'personalizzata'];
    for (const regola of regole) {
      expect(quote(calcolaQuota({ persone: uno, totale: 1380, regola }))).toEqual([1380]);
    }
  });
  it('proporzionale con redditi 1800 e 0 dà 1380 e 0, peso null per il secondo', () => {
    const r = calcolaQuota({
      persone: [
        { slot: 1, nome: 'Fabio', redditoNetto: 1800 },
        { slot: 2, nome: 'Giulia', redditoNetto: 0 },
      ],
      totale: 1380,
      regola: 'proporzionale',
    });
    expect(quote(r)).toEqual([1380, 0]);
    expect(r.persone[1].peso).toBeNull();
    expect(JSON.stringify(r)).not.toContain('NaN');
  });
  it('pari residuo con redditi 1800 e 0 dà 1380 e 0', () => {
    const r = calcolaQuota({
      persone: [
        { slot: 1, nome: 'Fabio', redditoNetto: 1800 },
        { slot: 2, nome: 'Giulia', redditoNetto: 0 },
      ],
      totale: 1380,
      regola: 'pari_residuo',
    });
    expect(quote(r)).toEqual([1380, 0]);
    expect(JSON.stringify(r)).not.toContain('NaN');
  });
  it('proporzionale con redditi tutti a zero non dà NaN: regola non disponibile con avvisi', () => {
    const r = calcolaQuota({
      persone: [
        { slot: 1, nome: 'Fabio', redditoNetto: 0 },
        { slot: 2, nome: 'Giulia', redditoNetto: 0 },
      ],
      totale: 1380,
      regola: 'proporzionale',
    });
    expect(r.regolaDisponibile).toBe(false);
    expect(quote(r)).toEqual([0, 0]);
    expect(r.avvisi.filter((a) => a.tipo === 'redditi_mancanti')).toHaveLength(2);
    expect(JSON.stringify(r)).not.toContain('NaN');
  });
  it('un reddito negativo vale come mancante e non dà quote negative', () => {
    for (const regola of ['proporzionale', 'pari_residuo'] as RegolaQuota[]) {
      const r = calcolaQuota({
        persone: [
          { slot: 1, nome: 'Fabio', redditoNetto: 1800 },
          { slot: 2, nome: 'Giulia', redditoNetto: -200 },
        ],
        totale: 1380,
        regola,
      });
      expect(r.regolaDisponibile).toBe(false);
      expect(quote(r)).toEqual([0, 0]);
      expect(r.avvisi).toEqual([{ tipo: 'redditi_mancanti', slot: 2, nome: 'Giulia' }]);
    }
  });
  it('a parità di reddito il resto va allo slot minore', () => {
    const r = calcolaQuota({
      persone: [
        { slot: 2, nome: 'Giulia', redditoNetto: 1000 },
        { slot: 1, nome: 'Fabio', redditoNetto: 1000 },
      ],
      totale: 1001,
      regola: 'parti_uguali',
    });
    const per = Object.fromEntries(r.persone.map((p) => [p.slot, p.quota]));
    expect(per[1]).toBe(501);
    expect(per[2]).toBe(500);
  });
  it('lancia se totale non è intero', () => {
    expect(() => calcolaQuota({ persone: due, totale: 1380.5, regola: 'parti_uguali' })).toThrow();
  });
});

describe('calcolaQuota avvisi', () => {
  it('quota_supera_reddito quando la quota supera il reddito', () => {
    const r = calcolaQuota({
      persone: [
        { slot: 1, nome: 'Fabio', redditoNetto: 1000 },
        { slot: 2, nome: 'Giulia', redditoNetto: 300 },
      ],
      totale: 800,
      regola: 'parti_uguali',
    });
    expect(r.avvisi).toContainEqual({ tipo: 'quota_supera_reddito', slot: 2, nome: 'Giulia' });
    expect(r.avvisi).not.toContainEqual({ tipo: 'quota_supera_reddito', slot: 1, nome: 'Fabio' });
  });
  it('spese_oltre_redditi quando il totale supera la somma dei redditi', () => {
    const r = calcolaQuota({ persone: due, totale: 3300, regola: 'parti_uguali' });
    expect(r.avvisi).toContainEqual({ tipo: 'spese_oltre_redditi' });
    expect(calcolaQuota({ persone: due, totale: 1380, regola: 'parti_uguali' }).avvisi).toEqual([]);
  });
  it('redditi_mancanti disabilita proporzionale e pari residuo', () => {
    const senza: PersonaQuotaInput[] = [
      { slot: 1, nome: 'Fabio', redditoNetto: 1800 },
      { slot: 2, nome: 'Giulia', redditoNetto: null },
    ];
    for (const regola of ['proporzionale', 'pari_residuo'] as RegolaQuota[]) {
      const r = calcolaQuota({ persone: senza, totale: 1380, regola });
      expect(r.regolaDisponibile).toBe(false);
      expect(quote(r)).toEqual([0, 0]);
      expect(r.avvisi).toEqual([{ tipo: 'redditi_mancanti', slot: 2, nome: 'Giulia' }]);
    }
  });
  it('parti uguali resta disponibile senza redditi', () => {
    const r = calcolaQuota({
      persone: [
        { slot: 1, nome: 'Fabio', redditoNetto: null },
        { slot: 2, nome: 'Giulia', redditoNetto: null },
      ],
      totale: 1380,
      regola: 'parti_uguali',
    });
    expect(r.regolaDisponibile).toBe(true);
    expect(quote(r)).toEqual([690, 690]);
  });
});

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

describe('calcolaQuota proprietà', () => {
  const regole: RegolaQuota[] = ['parti_uguali', 'proporzionale', 'pari_residuo', 'personalizzata'];
  for (const regola of regole) {
    it(`su 300 casi pseudo casuali (${regola}) la somma delle quote è uguale al totale e nessuna è negativa`, () => {
      const next = rng(12345);
      for (let i = 0; i < 300; i++) {
        const n = 1 + Math.floor(next() * 5);
        const pesi = Array.from({ length: n }, () => 1 + Math.floor(next() * 100));
        const sommaPesi = pesi.reduce((a, b) => a + b, 0);
        const persone: PersonaQuotaInput[] = pesi.map((p, k) => ({
          slot: k + 1,
          nome: `P${k + 1}`,
          redditoNetto: Math.floor(next() * 3000) + 100,
          percentuale: (p / sommaPesi) * 100,
        }));
        const totale = 100 + Math.floor(next() * 3000);
        const r = calcolaQuota({ persone, totale, regola });
        const somma = r.persone.reduce((a, p) => a + p.quota, 0);
        expect(somma).toBe(totale);
        for (const p of r.persone) {
          expect(p.quota).toBeGreaterThanOrEqual(0);
          expect(Number.isInteger(p.quota)).toBe(true);
        }
      }
    });
  }
});
