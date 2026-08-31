import { describe, it, expect } from 'vitest';
import { filterTransactionsByPeriodo } from '@/lib/calculations/filterTransactionsByPeriodo';
import type { Transaction } from '@/lib/types';

function tx(data: string): Transaction {
  return {
    id: data,
    tipo: 'expense',
    importo: 10,
    data,
    categoriaId: null,
    accountId: null,
    goalId: null,
    descrizione: '',
    nota: null,
    createdAt: `${data}T00:00:00Z`,
  };
}

describe('filterTransactionsByPeriodo', () => {
  const oggi = new Date(2026, 5, 15); // 15 giugno 2026

  it('"mese" mantiene solo le transazioni del mese corrente', () => {
    const transactions = [tx('2026-06-01'), tx('2026-06-30'), tx('2026-05-31'), tx('2026-07-01')];
    const result = filterTransactionsByPeriodo(transactions, 'mese', oggi);
    expect(result.map((t) => t.data)).toEqual(['2026-06-01', '2026-06-30']);
  });

  it('"3mesi" mantiene le transazioni negli ultimi 3 mesi fino ad oggi', () => {
    const transactions = [tx('2026-03-15'), tx('2026-03-14'), tx('2026-06-15')];
    const result = filterTransactionsByPeriodo(transactions, '3mesi', oggi);
    expect(result.map((t) => t.data)).toEqual(['2026-03-15', '2026-06-15']);
  });

  it('"personalizzato" mantiene solo le transazioni nell\'intervallo indicato', () => {
    const transactions = [tx('2026-01-01'), tx('2026-02-15'), tx('2026-03-01')];
    const result = filterTransactionsByPeriodo(transactions, 'personalizzato', oggi, {
      da: '2026-01-15',
      a: '2026-02-28',
    });
    expect(result.map((t) => t.data)).toEqual(['2026-02-15']);
  });

  it('"personalizzato" senza un intervallo completo non filtra nulla', () => {
    const transactions = [tx('2026-01-01'), tx('2026-02-15')];
    expect(filterTransactionsByPeriodo(transactions, 'personalizzato', oggi, { da: '', a: '' })).toEqual(
      transactions
    );
    expect(filterTransactionsByPeriodo(transactions, 'personalizzato', oggi, null)).toEqual(transactions);
  });
});
