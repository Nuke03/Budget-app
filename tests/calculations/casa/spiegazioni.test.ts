import { describe, it, expect } from 'vitest';
import { spiegaTotaleMensile, spiegaQuotaPersona } from '@/lib/calculations/casa/spiegazioni';
import { calcolaQuota } from '@/lib/calculations/casa/quota';
import type { RegolaQuota } from '@/lib/types';
import { PAROLE_VIETATE } from '../../helpers/paroleVietate';
import { ESEMPIO_PERSONE, ESEMPIO_CUSCINETTO_QUOTA } from '../../helpers/esempioCasa';

const base = { sottotot: 1321, cuscinettoQuotaMensile: ESEMPIO_CUSCINETTO_QUOTA, arrotondamento: 10 };
const somma = (xs: { valore: number }[]) => xs.reduce((s, x) => s + x.valore, 0);

describe('spiegaTotaleMensile', () => {
  it('valore 1380 e formula con spese comuni e cuscinetto', () => {
    const s = spiegaTotaleMensile(base);
    expect(s.valore).toBe(1380);
    expect(s.formula).toBe('Spese comuni 1.321 euro + cuscinetto 59 euro = 1.380 euro.');
  });
  it('gli ingredienti sommano al valore, arrotondamento incluso', () => {
    const s = spiegaTotaleMensile({ ...base, sottotot: 1321.33 });
    expect(s.valore).toBe(1390);
    expect(s.ingredienti.map((i) => i.etichetta)).toEqual(['Spese comuni', 'Cuscinetto', 'Arrotondamento']);
    expect(somma(s.ingredienti)).toBeCloseTo(1390, 8);
  });
});

describe('spiegaQuotaPersona', () => {
  const dati = (regola: RegolaQuota, slot = 1) => ({
    ...base,
    regola,
    slot,
    persone: ESEMPIO_PERSONE.map((p, i) => ({ ...p, percentuale: i === 0 ? 70 : 30 })),
  });

  it('proporzionale: valore 777, formula e ingredienti', () => {
    const s = spiegaQuotaPersona(dati('proporzionale'));
    expect(s.valore).toBe(777);
    expect(s.formula).toBe(
      'Spese comuni 1.321 euro + cuscinetto 59 euro = 1.380 euro, divisi secondo il reddito.\nFabio: 1.800 su 3.200 di reddito, cioè 56%.',
    );
    expect(s.ingredienti.slice(0, 3)).toEqual([
      { etichetta: 'Reddito di Fabio', valore: 1800 },
      { etichetta: 'Reddito di tutti', valore: 3200 },
      { etichetta: 'Totale da dividere', valore: 1380 },
    ]);
  });
  it('aggiunge un ingrediente Arrotondamento quando la quota reale differisce', () => {
    const s = spiegaQuotaPersona(dati('proporzionale'));
    expect(s.ingredienti[s.ingredienti.length - 1]).toEqual({ etichetta: 'Arrotondamento', valore: 0.75 });
    const pari = spiegaQuotaPersona(dati('parti_uguali'));
    expect(pari.ingredienti.map((i) => i.etichetta)).not.toContain('Arrotondamento');
  });
  it('parti uguali, pari residuo e personalizzata', () => {
    const attese: [RegolaQuota, string][] = [
      ['parti_uguali', 'divisi in parti uguali.'],
      ['pari_residuo', 'divisi in modo che a tutti restino gli stessi soldi.'],
      ['personalizzata', 'divisi con le percentuali scelte.'],
    ];
    for (const [regola, fine] of attese) {
      for (const slot of [1, 2]) {
        const d = dati(regola, slot);
        const s = spiegaQuotaPersona(d);
        expect(s.formula.split('\n')[0]).toBe(
          `Spese comuni 1.321 euro + cuscinetto 59 euro = 1.380 euro, ${fine}`,
        );
        const atteso = calcolaQuota({ persone: d.persone, totale: 1380, regola }).persone[slot - 1].quota;
        expect(s.valore).toBe(atteso);
      }
    }
  });
  it('con percentuali non valide la spiegazione è neutra e il valore è 0', () => {
    const d = dati('personalizzata');
    d.persone = d.persone.map((p, i) => ({ ...p, percentuale: i === 0 ? 60 : 30 }));
    const s = spiegaQuotaPersona(d);
    expect(s.valore).toBe(0);
    expect(s.formula).toBe('Quota da completare: le percentuali devono fare 100.');
    expect(s.formula).not.toContain('60%');
  });
  it('con reddito mancante la spiegazione dice di chi', () => {
    const d = dati('proporzionale');
    d.persone = d.persone.map((p, i) => ({ ...p, redditoNetto: i === 1 ? null : p.redditoNetto }));
    const s = spiegaQuotaPersona(d);
    expect(s.valore).toBe(0);
    expect(s.formula).toBe('Quota da completare: manca il reddito di Giulia.');
  });
  it('nessuna parola vietata nelle formule', () => {
    const regole: RegolaQuota[] = ['parti_uguali', 'proporzionale', 'pari_residuo', 'personalizzata'];
    const testi = [spiegaTotaleMensile(base).formula];
    for (const regola of regole) {
      for (const slot of [1, 2]) testi.push(spiegaQuotaPersona(dati(regola, slot)).formula);
    }
    const tutto = testi.join(' ').toLowerCase();
    for (const parola of PAROLE_VIETATE) expect(tutto).not.toContain(parola);
  });
});
