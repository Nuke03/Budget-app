import { describe, it, expect } from 'vitest';
import { aggregateByCategory } from '@/lib/calculations/aggregateByCategory';
import type { Transaction, Category } from '@/lib/types';

const categories: Category[] = [
  { id: 'cat-1', nome: 'Groceries', tipo: 'expense', colore: null, archiviata: false },
  { id: 'cat-2', nome: 'Transport', tipo: 'expense', colore: null, archiviata: false },
];

function tx(overrides: Partial<Transaction>): Transaction {
  return {
    id: '1',
    tipo: 'expense',
    importo: 10,
    data: '2026-02-01',
    categoriaId: 'cat-1',
    accountId: null,
    goalId: null,
    descrizione: '',
    nota: null,
    createdAt: '2026-02-01T00:00:00Z',
    ...overrides,
  };
}

describe('aggregateByCategory', () => {
  it('somma gli importi per categoria', () => {
    const transactions = [
      tx({ categoriaId: 'cat-1', importo: 26 }),
      tx({ categoriaId: 'cat-1', importo: 24 }),
      tx({ categoriaId: 'cat-2', importo: 275 }),
    ];

    const result = aggregateByCategory(transactions, categories);

    expect(result).toEqual(
      expect.arrayContaining([
        { nome: 'Groceries', totale: 50 },
        { nome: 'Transport', totale: 275 },
      ])
    );
  });

  it('raggruppa come "Senza categoria" le transazioni senza categoriaId', () => {
    const transactions = [tx({ categoriaId: null, importo: 15 })];
    const result = aggregateByCategory(transactions, categories);
    expect(result).toEqual([{ nome: 'Senza categoria', totale: 15 }]);
  });

  it('ignora le entrate, considera solo le spese', () => {
    const transactions = [
      tx({ tipo: 'income', categoriaId: null, importo: 1000 }),
      tx({ tipo: 'expense', categoriaId: 'cat-1', importo: 20 }),
    ];

    const result = aggregateByCategory(transactions, categories);
    expect(result).toEqual([{ nome: 'Groceries', totale: 20 }]);
  });
});
