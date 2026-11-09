import { describe, it, expect } from 'vitest';
import { computeAccantonatoFinora } from '@/lib/calculations/accantonato';
import { spiegaTotaleMensile, spiegaQuotaPersona, spiegaRiserva, spiegaCuscinetto, spiegaDaParte } from '@/lib/calculations/casa/spiegazioni';
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
  it('pari residuo con chi non versa niente: lo dice senza dire che a tutti resta lo stesso', () => {
    const d = {
      ...base,
      regola: 'pari_residuo' as RegolaQuota,
      slot: 1,
      persone: [
        { slot: 1, nome: 'Fabio', redditoNetto: 2000, percentuale: null },
        { slot: 2, nome: 'Giulia', redditoNetto: 100, percentuale: null },
      ],
    };
    const giulia = spiegaQuotaPersona({ ...d, slot: 2 });
    expect(giulia.valore).toBe(0);
    expect(giulia.formula).toContain('Giulia non versa niente perché il reddito non basta; gli altri restano con la stessa cifra.');
    const fabio = spiegaQuotaPersona(d);
    expect(fabio.formula.split('\n')[0]).not.toContain('a tutti restino gli stessi soldi');
    expect(fabio.formula).toContain('Giulia non versa niente perché il reddito non basta.');
    const tutto = (giulia.formula + fabio.formula).toLowerCase();
    for (const parola of PAROLE_VIETATE) expect(tutto).not.toContain(parola);
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

describe('spiegaRiserva', () => {
  const righe = [
    { mese: '2026-10-01', atteso: 777, versato: 0, mancano: 777 },
    { mese: '2026-11-01', atteso: 777, versato: 777, mancano: 0 },
    { mese: '2026-12-01', atteso: 777, versato: 100, mancano: 677 },
  ];
  it('valore uguale alla riserva e ingredienti che sommano', () => {
    const s = spiegaRiserva({ righe, debitoDaRestituire: 603 });
    expect(s.valore).toBe(777 + 677 + 603);
    expect(s.ingredienti.map((i) => i.etichetta)).toEqual([
      'Versamento alla casa, ottobre',
      'Versamento alla casa, dicembre',
      'Da restituire',
    ]);
    expect(somma(s.ingredienti)).toBeCloseTo(s.valore, 8);
    expect(s.formula).toBe("Il versamento di ogni mese è riservato dall'inizio del mese, finché non lo registri.");
  });
  it('senza debiti non c è l ingrediente Da restituire', () => {
    const s = spiegaRiserva({ righe, debitoDaRestituire: 0 });
    expect(s.ingredienti.map((i) => i.etichetta)).not.toContain('Da restituire');
    expect(s.valore).toBe(777 + 677);
  });
  it('senza nulla da riservare vale 0', () => {
    expect(spiegaRiserva({ righe: [], debitoDaRestituire: 0 }).valore).toBe(0);
  });
  it('nessuna parola vietata', () => {
    const s = spiegaRiserva({ righe, debitoDaRestituire: 603 });
    const testo = [s.formula, ...s.ingredienti.map((i) => i.etichetta)].join(' ').toLowerCase();
    for (const p of PAROLE_VIETATE) expect(testo).not.toContain(p);
  });
});

describe('spiegaCuscinetto', () => {
  it('59 su 1321 con 59 al mese: pieno tra circa 22 mesi, ingredienti chiari', () => {
    const s = spiegaCuscinetto({ attuale: 59, obiettivo: 1321, quotaMensile: 59 });
    expect(s.valore).toBe(59);
    expect(s.formula).toContain('Soldi della casa per gli imprevisti');
    expect(s.formula).toContain('circa 22 mesi');
    expect(s.ingredienti).toEqual([
      { etichetta: 'Messo da parte finora', valore: 59 },
      { etichetta: 'Obiettivo', valore: 1321 },
      { etichetta: 'Versato ogni mese per il cuscinetto', valore: 59 },
    ]);
  });
  it('senza parole vietate', () => {
    const s = spiegaCuscinetto({ attuale: 59, obiettivo: 1321, quotaMensile: 59 });
    const testo = [s.formula, ...s.ingredienti.map((i) => i.etichetta)].join(' ').toLowerCase();
    for (const parola of PAROLE_VIETATE) expect(testo).not.toContain(parola);
  });
});

describe('spiegaDaParte', () => {
  const tari = {
    importoTarget: 300, modalita: 'dilazionato' as const, stato: 'aperto' as const, scadenza: '2027-11-09',
    createdAt: '2026-11-09T10:00:00Z', ricorrente: true, frequenzaMesi: 12, accantonaDa: '2026-11-09',
  };
  const today = new Date(2027, 0, 15);
  it('50 = 25 al mese per 2 mesi, ingredienti sommano al valore', () => {
    const s = spiegaDaParte({ goal: tari, today, spesoCollegato: 0 });
    expect(s.valore).toBe(50);
    expect(s.valore).toBe(computeAccantonatoFinora(tari, today, 0));
    expect(s.formula).toContain('300');
    expect(s.formula).toContain('12 mesi');
    expect(s.formula).toContain('25');
    expect(s.formula).toContain('2 mesi');
    expect(s.ingredienti).toEqual([{ etichetta: 'Messo da parte finora', valore: 50 }]);
  });
  it('con speso collegato 20 compare la riga in negativo e il valore è 30', () => {
    const s = spiegaDaParte({ goal: tari, today, spesoCollegato: 20 });
    expect(s.valore).toBe(30);
    expect(s.ingredienti).toEqual([
      { etichetta: 'Messo da parte finora', valore: 50 },
      { etichetta: 'Già speso su questa bolletta', valore: -20 },
    ]);
    expect(somma(s.ingredienti)).toBeCloseTo(s.valore, 8);
  });
  it('speso oltre il messo da parte: valore 0 e gli ingredienti sommano a 0', () => {
    const s = spiegaDaParte({ goal: tari, today, spesoCollegato: 80 });
    expect(s.valore).toBe(0);
    expect(somma(s.ingredienti)).toBeCloseTo(0, 8);
  });
  it('senza parole vietate', () => {
    const s = spiegaDaParte({ goal: tari, today, spesoCollegato: 20 });
    const testo = [s.formula, ...s.ingredienti.map((i) => i.etichetta)].join(' ').toLowerCase();
    for (const parola of PAROLE_VIETATE) expect(testo).not.toContain(parola);
  });
});
