import { describe, it, expect, vi } from 'vitest';
import { getSpecoCollegato } from '@/lib/data/goalSpending';
import type { BudgetGoal } from '@/lib/types';

vi.mock('@/lib/data/transactions', () => ({
  getTransactionAmountsForGoal: vi.fn(),
}));

import { getTransactionAmountsForGoal } from '@/lib/data/transactions';

const goalBloccato: BudgetGoal = {
  id: 'goal-1',
  nome: 'Gita',
  importoTarget: 400,
  modalita: 'bloccato',
  scadenza: null,
  categoriaId: null,
  ricorrente: false,
  frequenzaMesi: null,
  stato: 'aperto',
  createdAt: '2026-01-15T00:00:00Z',
};

describe('getSpecoCollegato', () => {
  it('somma gli importi collegati all\'obiettivo nella finestra corretta', async () => {
    vi.mocked(getTransactionAmountsForGoal).mockResolvedValue([50, 30]);

    const result = await getSpecoCollegato({} as never, goalBloccato, new Date(2026, 5, 1));

    expect(result).toBe(80);
    expect(getTransactionAmountsForGoal).toHaveBeenCalledWith(
      expect.anything(),
      'goal-1',
      '2026-01-15',
      null
    );
  });

  it('ritorna 0 se non ci sono spese collegate', async () => {
    vi.mocked(getTransactionAmountsForGoal).mockResolvedValue([]);
    const result = await getSpecoCollegato({} as never, goalBloccato, new Date(2026, 5, 1));
    expect(result).toBe(0);
  });

  it('passa la finestra del ciclo corrente per un obiettivo ricorrente', async () => {
    vi.mocked(getTransactionAmountsForGoal).mockResolvedValue([]);
    const goalRicorrente: BudgetGoal = {
      ...goalBloccato,
      scadenza: '2026-01-01',
      ricorrente: true,
      frequenzaMesi: 1,
    };

    await getSpecoCollegato({} as never, goalRicorrente, new Date(2026, 5, 10));

    expect(getTransactionAmountsForGoal).toHaveBeenCalledWith(
      expect.anything(),
      'goal-1',
      '2026-06-01',
      '2026-07-01'
    );
  });
});
