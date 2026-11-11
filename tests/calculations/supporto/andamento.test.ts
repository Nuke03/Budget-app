import { describe, it, expect } from 'vitest';
import { calcolaAndamento } from '@/lib/calculations/supporto/andamento';
import type { Transaction } from '@/lib/types';

type Riga = Pick<Transaction, 'tipo' | 'importo' | 'data' | 'categoriaId'>;

const spesa = (data: string, importo: number, categoriaId: string | null = 'cat'): Riga => ({
  tipo: 'expense',
  importo,
  data,
  categoriaId,
});

describe('calcolaAndamento', () => {
  it('giorno 10 con 3 mesi pieni → solito = media degli speso fino al 10', () => {
    const spese = [
      spesa('2026-08-05', 30),
      spesa('2026-08-20', 500), // dopo il giorno 10: non conta
      spesa('2026-09-10', 60),
      spesa('2026-10-11', 900), // dopo il giorno 10: non conta
      spesa('2026-10-02', 90),
      spesa('2026-11-03', 40),
      spesa('2026-11-10', 20),
    ];
    const a = calcolaAndamento(spese, '2026-11-10');
    expect(a.mesiConfronto).toBe(3);
    expect(a.spesoFinora).toBe(60);
    expect(a.solito).toBe(60);
    expect(a.curva).toHaveLength(10);
    expect(a.curva[2]).toEqual({ giorno: 3, mese: 40, solito: 30 });
    expect(a.curva[9]).toEqual({ giorno: 10, mese: 60, solito: 60 });
  });

  it('31 gennaio confronta con il 31 dicembre, il 30 novembre e il 31 ottobre', () => {
    const spese = [
      spesa('2025-10-31', 10),
      spesa('2025-11-30', 20),
      spesa('2025-12-31', 30),
      spesa('2026-01-31', 5),
    ];
    const a = calcolaAndamento(spese, '2026-01-31');
    expect(a.mesiConfronto).toBe(3);
    expect(a.solito).toBe(20);
    expect(a.curva[29].solito).toBeCloseTo(20 / 3, 2);
  });

  it('utente con spese solo dal mese scorso → mesiConfronto 1', () => {
    const a = calcolaAndamento([spesa('2026-10-04', 80), spesa('2026-11-02', 10)], '2026-11-11');
    expect(a.mesiConfronto).toBe(1);
    expect(a.solito).toBe(80);
  });

  it('nessun mese precedente → solito null, mesiConfronto 0', () => {
    const a = calcolaAndamento([spesa('2026-11-02', 10)], '2026-11-11');
    expect(a.mesiConfronto).toBe(0);
    expect(a.solito).toBeNull();
    expect(a.curva.every((p) => p.solito === null)).toBe(true);
    expect(a.perCategoria).toEqual([{ categoriaId: 'cat', mese: 10, solito: null }]);
  });

  it('giorno 1 senza spese → spesoFinora 0', () => {
    const a = calcolaAndamento([spesa('2026-10-01', 50)], '2026-11-01');
    expect(a.spesoFinora).toBe(0);
    expect(a.curva).toEqual([{ giorno: 1, mese: 0, solito: 50 }]);
  });

  it('le entrate non contano', () => {
    const entrata: Riga = { tipo: 'income', importo: 1000, data: '2026-11-02', categoriaId: null };
    const a = calcolaAndamento([entrata, spesa('2026-11-03', 12.345)], '2026-11-11');
    expect(a.spesoFinora).toBe(12.35);
  });

  it('perCategoria separa le spese senza categoria (categoriaId null)', () => {
    const a = calcolaAndamento(
      [
        spesa('2026-10-03', 30, null),
        spesa('2026-10-03', 20, 'cibo'),
        spesa('2026-11-03', 10, null),
        spesa('2026-11-04', 5, 'svago'),
      ],
      '2026-11-11',
    );
    const per = (id: string | null) => a.perCategoria.find((c) => c.categoriaId === id);
    expect(per(null)).toEqual({ categoriaId: null, mese: 10, solito: 30 });
    expect(per('cibo')).toEqual({ categoriaId: 'cibo', mese: 0, solito: 20 });
    expect(per('svago')).toEqual({ categoriaId: 'svago', mese: 5, solito: 0 });
    expect(a.perCategoria).toHaveLength(3);
  });
});
