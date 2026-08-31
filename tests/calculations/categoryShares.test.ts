import { describe, it, expect } from 'vitest';
import { computeCategoryShares } from '@/lib/calculations/categoryShares';

describe('computeCategoryShares', () => {
  it('calcola la percentuale di ogni categoria sul totale complessivo', () => {
    const result = computeCategoryShares([
      { nome: 'Spesa', totale: 60 },
      { nome: 'Bollette', totale: 40 },
    ]);

    expect(result).toEqual([
      { nome: 'Spesa', totale: 60, percentuale: 60 },
      { nome: 'Bollette', totale: 40, percentuale: 40 },
    ]);
  });

  it('ritorna un array vuoto se non ci sono categorie', () => {
    expect(computeCategoryShares([])).toEqual([]);
  });

  it('ritorna percentuale 0 invece di NaN quando il totale complessivo è 0', () => {
    const result = computeCategoryShares([{ nome: 'Spesa', totale: 0 }]);
    expect(result).toEqual([{ nome: 'Spesa', totale: 0, percentuale: 0 }]);
  });
});
