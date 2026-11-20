import { describe, it, expect } from 'vitest';
import { righeLibretto, prossimaCosa, promemoriaPiva } from '@/lib/calculations/supporto/home';
import type { PivaScadenza, Transaction } from '@/lib/types';

function tx(id: string, data: string, tipo: 'expense' | 'income', importo: number, ora = '10'): Transaction {
  return {
    id, tipo, importo, data, categoriaId: null, accountId: null, goalId: null,
    descrizione: id, nota: null, createdAt: `${data}T${ora}:00:00Z`, stima: false,
  };
}

describe('righeLibretto', () => {
  it('prende le 4 più recenti con il cumulato del mese (due spese e un\'entrata nello stesso giorno)', () => {
    const t = [
      tx('a', '2026-11-03', 'expense', 10),
      tx('b', '2026-11-05', 'expense', 20, '08'),
      tx('c', '2026-11-05', 'income', 100, '09'),
      tx('d', '2026-11-05', 'expense', 5, '10'),
      tx('e', '2026-11-01', 'expense', 1),
    ];
    const r = righeLibretto(t, '2026-11-10');
    expect(r.map((x) => x.id)).toEqual(['d', 'c', 'b', 'a']);
    expect(r.map((x) => x.nelMese)).toEqual([36, 31, 31, 11]);
  });

  it('una riga del mese scorso vale il cumulato del suo mese', () => {
    const t = [tx('n', '2026-11-02', 'expense', 7), tx('o1', '2026-10-10', 'expense', 40), tx('o2', '2026-10-20', 'expense', 60)];
    const r = righeLibretto(t, '2026-11-10');
    expect(r.map((x) => [x.id, x.nelMese])).toEqual([['n', 7], ['o2', 100], ['o1', 40]]);
  });

  it('una entrata senza spese prima vale 0', () => {
    expect(righeLibretto([tx('i', '2026-11-02', 'income', 50)], '2026-11-10')[0].nelMese).toBe(0);
  });
});

describe('righeLibretto: colore della categoria', () => {
  const cat = [
    { id: 'spesa', colore: '#0F9D6B' },
    { id: 'vuota', colore: null },
  ];
  const conCat = (id: string, categoriaId: string | null): Transaction => ({ ...tx(id, '2026-11-05', 'expense', 5), categoriaId });

  it('mette in colore il colore della categoria della riga, null senza categoria o con categoria senza colore', () => {
    const t = [conCat('a', 'spesa'), conCat('b', null), conCat('c', 'vuota'), conCat('d', 'sparita')];
    const r = righeLibretto(t, '2026-11-10', 4, cat);
    expect(Object.fromEntries(r.map((x) => [x.id, x.colore]))).toEqual({
      a: '#0F9D6B', b: null, c: null, d: null,
    });
  });
});

describe('prossimaCosa', () => {
  const casa = [{ testo: 'Versa la quota', href: '/casa/versa' }, { testo: 'Altro' }];
  it('"in pari" vince', () => {
    const p = prossimaCosa({ inPari: { dal: '2026-11-08', al: '2026-11-10' }, promemoriaCasa: casa });
    expect(p?.tipo).toBe('in_pari');
    expect(p?.href).toBe('/in-pari');
    expect(p?.testo).toBe('Rimettiti in pari: dal 8 novembre non hai segnato spese');
    expect(prossimaCosa({ inPari: { dal: '2025-12-30', al: '2026-01-02' }, promemoriaCasa: [] })?.testo).toBe(
      'Rimettiti in pari: dal 30 dicembre 2025 non hai segnato spese'
    );
  });
  it('ripiega sul primo promemoria di casa, con /casa di ripiego', () => {
    expect(prossimaCosa({ inPari: null, promemoriaCasa: casa })).toEqual({ testo: 'Versa la quota', href: '/casa/versa', tipo: 'casa' });
    expect(prossimaCosa({ inPari: null, promemoriaCasa: [{ testo: 'X' }] })?.href).toBe('/casa');
  });
  it('null se non c\'è niente', () => {
    expect(prossimaCosa({ inPari: null, promemoriaCasa: [] })).toBeNull();
  });
});

describe('promemoriaPiva', () => {
  const OGGI = '2026-11-18';
  const sc = (o: Partial<PivaScadenza>): PivaScadenza => ({
    id: 's1', anno: 2026, chiave: 'f24_novembre', tipo: 'f24', descrizione: 'F24 di novembre',
    data: '2026-11-30', importo: null, pagataIl: null, transactionId: null, nascosta: false, ...o,
  });
  const vuoto = { fatture: [], inSospeso: 0, revisioneStipendio: null };

  it('scadenza fra 10 giorni è urgente e passa davanti alla casa', () => {
    const piva = promemoriaPiva({ ...vuoto, scadenze: [sc({ data: '2026-11-28' })] }, OGGI);
    expect(piva).toEqual([{ testo: 'F24 di novembre entro il 28 novembre', href: '/piva', urgente: true }]);
    const p = prossimaCosa({ inPari: null, promemoriaCasa: [{ testo: 'Versa la quota' }], promemoriaPiva: piva });
    expect(p).toEqual({ testo: 'F24 di novembre entro il 28 novembre', href: '/piva', tipo: 'piva' });
  });
  it('scadenza fra 20 giorni non compare', () => {
    expect(promemoriaPiva({ ...vuoto, scadenze: [sc({ data: '2026-12-08' })] }, OGGI)).toEqual([]);
  });
  it('pagata, nascosta o passata: non compare; oggi e +15 compaiono', () => {
    const scadenze = [
      sc({ id: 'a', pagataIl: '2026-11-10' }),
      sc({ id: 'b', nascosta: true }),
      sc({ id: 'c', data: '2026-11-17' }),
    ];
    expect(promemoriaPiva({ ...vuoto, scadenze }, OGGI)).toEqual([]);
    expect(promemoriaPiva({ ...vuoto, scadenze: [sc({ data: OGGI })] }, OGGI)).toHaveLength(1);
    expect(promemoriaPiva({ ...vuoto, scadenze: [sc({ data: '2026-12-03' })] }, OGGI)).toHaveLength(1);
  });
  it('quota da spostare e fatture ferme: non urgenti, dopo la casa', () => {
    const fattura = (id: string, emessa: string, incasso: string | null = null) => ({
      id, cliente: 'X', importo: 100, dataEmissione: emessa, dataIncasso: incasso, transactionId: null, nota: null,
    });
    const piva = promemoriaPiva(
      {
        scadenze: [],
        fatture: [fattura('a', '2026-09-01'), fattura('b', '2026-09-02'), fattura('c', '2026-11-01'), fattura('d', '2026-08-01', '2026-09-01')],
        inSospeso: 120.5,
        revisioneStipendio: null,
      },
      OGGI,
    );
    expect(piva.map((p) => p.urgente)).toEqual([false, false]);
    expect(piva[0].testo).toMatch(/^Da spostare sul conto tasse: /);
    expect(piva[1].testo).toBe('2 fatture aspettano da più di 60 giorni');
    const p = prossimaCosa({ inPari: null, promemoriaCasa: [{ testo: 'Versa la quota' }], promemoriaPiva: piva });
    expect(p?.tipo).toBe('casa');
    expect(prossimaCosa({ inPari: null, promemoriaCasa: [], promemoriaPiva: piva })?.tipo).toBe('piva');
  });
  it('in pari batte tutto', () => {
    const piva = promemoriaPiva({ ...vuoto, scadenze: [sc({ data: '2026-11-20' })] }, OGGI);
    expect(prossimaCosa({ inPari: { dal: '2026-11-15', al: OGGI }, promemoriaCasa: [], promemoriaPiva: piva })?.tipo).toBe('in_pari');
  });
});

describe('prossimaCosa con la lista d attesa', () => {
  const attesa = { testo: 'Ci ripensi? Cuffie, 89,90 €', href: '/impara/attesa' };
  it('prossimo attesa compare solo senza promemoria più urgenti', () => {
    expect(prossimaCosa({ inPari: null, promemoriaCasa: [], attesa })).toEqual({ ...attesa, tipo: 'attesa' });
    expect(prossimaCosa({ inPari: null, promemoriaCasa: [{ testo: 'Versa la quota' }], attesa })?.tipo).toBe('casa');
    const piva = [{ testo: 'F24', href: '/piva', urgente: false }];
    expect(prossimaCosa({ inPari: null, promemoriaCasa: [], promemoriaPiva: piva, attesa })?.tipo).toBe('piva');
    expect(prossimaCosa({ inPari: { dal: '2026-11-15', al: '2026-11-18' }, promemoriaCasa: [], attesa })?.tipo).toBe('in_pari');
  });
});

describe('prossimaCosa con Sposta', () => {
  const sposta = { testo: 'Sposta 100 € sul Risparmio.', href: '/?sposta=r1' };
  const versamento = { testo: 'Hai messo da parte?', href: '/goals' };
  it('viene subito prima del versamento e dopo la lista d attesa', () => {
    expect(prossimaCosa({ inPari: null, promemoriaCasa: [], sposta })).toEqual({ ...sposta, tipo: 'sposta' });
    expect(prossimaCosa({ inPari: null, promemoriaCasa: [], sposta, versamento })?.tipo).toBe('sposta');
    const attesa = { testo: 'Ci ripensi?', href: '/impara/attesa' };
    expect(prossimaCosa({ inPari: null, promemoriaCasa: [], sposta, attesa, versamento })?.tipo).toBe('attesa');
  });
});
