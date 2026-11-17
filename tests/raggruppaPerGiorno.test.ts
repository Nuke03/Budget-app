import { describe, it, expect } from 'vitest';
import { raggruppaPerGiorno } from '@/app/history/raggruppaPerGiorno';
import type { Transaction } from '@/lib/types';

const t = (id: string, data: string, tipo: 'expense' | 'income', importo: number): Transaction => ({
  id, data, tipo, importo, categoriaId: null, accountId: null, goalId: null,
  descrizione: id, nota: null, createdAt: '', stima: false,
});

describe('raggruppaPerGiorno', () => {
  it('raggruppa per giorno nell’ordine di arrivo e somma entrate meno uscite', () => {
    const g = raggruppaPerGiorno([
      t('a', '2026-11-04', 'expense', 10),
      t('b', '2026-11-04', 'expense', 5.5),
      t('c', '2026-11-04', 'income', 100),
      t('d', '2026-11-01', 'expense', 20),
    ]);
    expect(g.map((x) => x.data)).toEqual(['2026-11-04', '2026-11-01']);
    expect(g[0].righe.map((r) => r.id)).toEqual(['a', 'b', 'c']);
    expect(g[0].totale).toBeCloseTo(84.5);
    expect(g[1].totale).toBe(-20);
  });

  it('senza righe non ci sono giorni', () => {
    expect(raggruppaPerGiorno([])).toEqual([]);
  });
});
