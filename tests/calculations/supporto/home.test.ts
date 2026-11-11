import { describe, it, expect } from 'vitest';
import { righeLibretto, prossimaCosa } from '@/lib/calculations/supporto/home';
import type { Transaction } from '@/lib/types';

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

describe('prossimaCosa', () => {
  const casa = [{ testo: 'Versa la quota', href: '/casa/versa' }, { testo: 'Altro' }];
  it('"in pari" vince', () => {
    const p = prossimaCosa({ inPari: { dal: '2026-11-08', al: '2026-11-10' }, promemoriaCasa: casa });
    expect(p?.tipo).toBe('in_pari');
    expect(p?.href).toBe('/in-pari');
    expect(p?.testo).toMatch(/^Rimettiti in pari: dal .+ non hai segnato spese$/);
  });
  it('ripiega sul primo promemoria di casa, con /casa di ripiego', () => {
    expect(prossimaCosa({ inPari: null, promemoriaCasa: casa })).toEqual({ testo: 'Versa la quota', href: '/casa/versa', tipo: 'casa' });
    expect(prossimaCosa({ inPari: null, promemoriaCasa: [{ testo: 'X' }] })?.href).toBe('/casa');
  });
  it('null se non c\'è niente', () => {
    expect(prossimaCosa({ inPari: null, promemoriaCasa: [] })).toBeNull();
  });
});
