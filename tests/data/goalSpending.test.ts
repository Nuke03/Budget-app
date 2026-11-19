import { describe, it, expect, vi } from 'vitest';
import { getSpecoCollegato, getSpecoCollegatoPerObiettivi } from '@/lib/data/goalSpending';
import { casa } from '@/lib/data/scope';
import type { BudgetGoal } from '@/lib/types';
import { createFakeDb } from '../helpers/fakeDb';
import { createRecordingClient, callsOf } from '../helpers/recordingSupabase';

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
      null,
      false
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
      '2026-07-01',
      true
    );
  });
});

describe('getSpecoCollegatoPerObiettivi', () => {
  const G1: BudgetGoal = { ...goalBloccato, id: 'G1', createdAt: '2026-11-01T00:00:00Z' };
  const G2: BudgetGoal = {
    ...goalBloccato,
    id: 'G2',
    nome: 'TARI',
    importoTarget: 300,
    modalita: 'dilazionato',
    ricorrente: true,
    frequenzaMesi: 12,
    scadenza: '2027-03-31',
    createdAt: '2026-01-01T00:00:00Z',
  };
  const TODAY = new Date(2026, 10, 9);

  const tx = (id: string, household: string, tipo: string, importo: number, data: string, goal: string) => ({
    id, user_id: 'A', household_id: household, tipo, importo, data, goal_id: goal,
    categoria_id: null, account_id: 'ac', descrizione: null, nota: null, created_at: '2026-11-01T00:00:00Z',
  });

  it('somma per obiettivo nella sua finestra', async () => {
    const db = createFakeDb(
      {
        transactions: [
          tx('t1', 'H1', 'expense', 40, '2026-11-05', 'G1'),
          tx('t2', 'H1', 'expense', 30, '2026-02-10', 'G2'),
          tx('t3', 'H1', 'expense', 20, '2026-11-02', 'G2'),
          tx('t4', 'H1', 'income', 15, '2026-11-06', 'G1'),
          tx('t5', 'H2', 'expense', 99, '2026-11-05', 'G1'),
        ],
      },
      { userId: 'A', membri: { H1: ['A'], H2: ['B'] } }
    );
    const r = await getSpecoCollegatoPerObiettivi(db.client, [G1, G2], TODAY, casa('H1'));
    expect(r).toEqual({ G1: 40, G2: 20 });
  });

  it('sul giorno di confine di un ricorrente la spesa conta in un solo ciclo', async () => {
    // TARI: a novembre 2026 il ciclo è (31 mar 2026, 31 mar 2027]; ad aprile 2027 è (31 mar 2027, 31 mar 2028]
    const db = createFakeDb(
      {
        transactions: [
          tx('t1', 'H1', 'expense', 25, '2026-03-31', 'G2'),
          tx('t2', 'H1', 'expense', 10, '2026-04-01', 'G2'),
          tx('t3', 'H1', 'expense', 5, '2027-03-31', 'G2'),
          tx('t4', 'H1', 'expense', 7, '2027-04-01', 'G2'),
        ],
      },
      { userId: 'A', membri: { H1: ['A'] } }
    );
    const adesso = await getSpecoCollegatoPerObiettivi(db.client, [G2], TODAY, casa('H1'));
    const dopo = await getSpecoCollegatoPerObiettivi(db.client, [G2], new Date(2027, 3, 5), casa('H1'));
    expect(adesso.G2).toBe(15); // il 31 mar 2026 (25) è del ciclo prima; il 31 mar 2027 (5) chiude questo
    expect(dopo.G2).toBe(7); // il 31 mar 2027 non conta due volte
  });

  it('un non ricorrente conta anche la spesa del giorno di creazione', async () => {
    const db = createFakeDb(
      { transactions: [tx('t1', 'H1', 'expense', 12, '2026-11-01', 'G1')] },
      { userId: 'A', membri: { H1: ['A'] } }
    );
    const r = await getSpecoCollegatoPerObiettivi(db.client, [G1], TODAY, casa('H1'));
    expect(r.G1).toBe(12);
  });

  it('una sola query con scope e in(goal_id)', async () => {
    const { client, calls } = createRecordingClient([]);
    await getSpecoCollegatoPerObiettivi(client, [G1, G2], TODAY, casa('H1'));
    expect(calls).toHaveLength(1);
    expect(calls[0].table).toBe('transactions');
    expect(callsOf(calls[0], 'eq')).toContainEqual(['household_id', 'H1']);
    expect(callsOf(calls[0], 'in')).toContainEqual(['goal_id', ['G1', 'G2']]);
  });

  it('nessun obiettivo, nessuna query', async () => {
    const { client, calls } = createRecordingClient([]);
    expect(await getSpecoCollegatoPerObiettivi(client, [], TODAY, casa('H1'))).toEqual({});
    expect(calls).toHaveLength(0);
  });
});
