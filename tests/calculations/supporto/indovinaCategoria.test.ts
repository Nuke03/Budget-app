import { describe, it, expect } from 'vitest';
import { indovinaCategoria } from '@/lib/calculations/supporto/indovinaCategoria';
import type { Transaction } from '@/lib/types';

type Riga = Pick<Transaction, 'descrizione' | 'categoriaId' | 'data' | 'tipo'>;

const OGGI = '2026-11-11';
const spesa = (descrizione: string, categoriaId: string | null, data: string): Riga => ({
  descrizione,
  categoriaId,
  data,
  tipo: 'expense',
});

describe('indovinaCategoria', () => {
  it('stessa descrizione → categoria della più recente', () => {
    const storico = [
      spesa('Esselunga', 'cat-vecchia', '2026-10-01'),
      spesa('Esselunga', 'cat-nuova', '2026-11-05'),
      spesa('Esselunga', 'cat-media', '2026-10-20'),
    ];
    expect(indovinaCategoria('Esselunga', storico, OGGI)).toBe('cat-nuova');
  });

  it('descrizione nuova → la più usata negli ultimi 30 giorni', () => {
    const storico = [
      spesa('Bar', 'svago', '2026-11-01'),
      spesa('Pizza', 'svago', '2026-11-02'),
      spesa('Enel', 'casa', '2026-11-03'),
    ];
    expect(indovinaCategoria('Cinema', storico, OGGI)).toBe('svago');
  });

  it('spese più vecchie di 30 giorni non contano', () => {
    // 2026-10-12 è a 30 giorni da oggi: fuori. 2026-10-13 è a 29 giorni: dentro.
    const storico = [
      spesa('Bar', 'vecchia', '2026-10-01'),
      spesa('Bar', 'vecchia', '2026-10-02'),
      spesa('Bar', 'vecchia', '2026-10-12'),
      spesa('Bar', 'recente', '2026-10-13'),
    ];
    expect(indovinaCategoria('Cinema', storico, OGGI)).toBe('recente');
  });

  it('descrizione vuota → la più usata negli ultimi 30 giorni, non la più recente senza descrizione', () => {
    const storico = [
      spesa('', 'rara', '2026-11-10'),
      spesa('Bar', 'svago', '2026-11-01'),
      spesa('Pizza', 'svago', '2026-11-02'),
    ];
    expect(indovinaCategoria('  ', storico, OGGI)).toBe('svago');
  });

  it('nessuna spesa → null', () => {
    expect(indovinaCategoria('Cinema', [], OGGI)).toBeNull();
  });

  it('le entrate non contano', () => {
    const storico: Riga[] = [
      { descrizione: 'Stipendio', categoriaId: 'lavoro', data: '2026-11-05', tipo: 'income' },
      { descrizione: 'Stipendio', categoriaId: 'lavoro', data: '2026-11-06', tipo: 'income' },
    ];
    expect(indovinaCategoria('Stipendio', storico, OGGI)).toBeNull();
  });

  it('"  Esselunga " e "esselunga" sono uguali', () => {
    const storico = [spesa('esselunga', 'spesa', '2026-11-03')];
    expect(indovinaCategoria('  Esselunga ', storico, OGGI)).toBe('spesa');
  });
});
