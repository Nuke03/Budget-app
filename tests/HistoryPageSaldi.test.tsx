import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

const dati = vi.hoisted(() => ({ casaFalla: false }));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) } }),
}));
vi.mock('@/lib/useThrowToBoundary', () => ({
  useThrowToBoundary: () => (e: unknown) => {
    throw e;
  },
}));
vi.mock('@/lib/calculations/filterTransactionsByPeriodo', async (orig) => {
  const m = await orig<typeof import('@/lib/calculations/filterTransactionsByPeriodo')>();
  return { ...m, filterTransactionsByPeriodo: (t: unknown[]) => t };
});
vi.mock('@/app/history/HistoryChartCard', () => ({ HistoryChartCard: () => null }));
vi.mock('@/app/add/AddTransactionForm', () => ({
  AddTransactionForm: ({
    onSubmit,
  }: {
    onSubmit: (p: Record<string, unknown>) => Promise<void>;
  }) => (
    <>
      <button
        type="button"
        onClick={() =>
          onSubmit({ tipo: 'expense', importo: 15, categoriaId: null, accountId: 'b', goalId: null, descrizione: 'Pane' })
        }
      >
        Salva simulato
      </button>
    </>
  ),
}));
vi.mock('@/lib/data/categories', () => ({ getCategories: async () => [] }));
vi.mock('@/lib/data/accounts', () => ({
  getAccounts: async () => [
    { id: 'a', nome: 'A', saldoAttuale: 100, contaInDisponibile: true, targetSaldo: null },
    { id: 'b', nome: 'B', saldoAttuale: 50, contaInDisponibile: true, targetSaldo: null },
  ],
  adjustAccountBalance: vi.fn().mockResolvedValue(undefined),
  updateAccountBalance: vi.fn(),
}));
vi.mock('@/lib/data/goals', () => ({ getOpenGoals: async () => [], createGoal: vi.fn() }));
vi.mock('@/lib/data/transactions', () => ({
  updateTransaction: vi.fn().mockResolvedValue(undefined),
  deleteTransaction: vi.fn().mockResolvedValue(undefined),
  getTransactions: async () => [
    {
      id: 't1', tipo: 'expense', importo: 10, data: '2026-11-04', categoriaId: null, accountId: 'a',
      goalId: null, descrizione: 'Pane', nota: null, createdAt: '',
    },
  ],
}));
vi.mock('@/lib/data/households', () => ({
  getMyHousehold: async () => {
    if (dati.casaFalla) throw new Error('rete');
    return null;
  },
}));
vi.mock('@/lib/data/transfers', () => ({ getTransfers: async () => [] }));

import HistoryPage from '@/app/history/page';
import { adjustAccountBalance, updateAccountBalance } from '@/lib/data/accounts';

beforeEach(() => {
  vi.clearAllMocks();
  dati.casaFalla = false;
});

describe('Storico: saldi personali per differenza', () => {
  it('eliminare una spesa restituisce l importo con un delta, mai un saldo assoluto', async () => {
    render(<HistoryPage />);
    await waitFor(() => expect(screen.getByText('Pane')).toBeInTheDocument());
    fireEvent.click(screen.getByLabelText('Elimina transazione'));
    await waitFor(() => expect(adjustAccountBalance).toHaveBeenCalledWith(expect.anything(), 'a', 10));
    expect(adjustAccountBalance).toHaveBeenCalledTimes(1);
    expect(updateAccountBalance).not.toHaveBeenCalled();
  });

  it('modificare con cambio di conto sposta +10 sul vecchio e -15 sul nuovo', async () => {
    render(<HistoryPage />);
    await waitFor(() => expect(screen.getByText('Pane')).toBeInTheDocument());
    fireEvent.click(screen.getByLabelText('Modifica transazione'));
    fireEvent.click(await screen.findByText('Salva simulato'));
    await waitFor(() => expect(adjustAccountBalance).toHaveBeenCalledTimes(2));
    expect(adjustAccountBalance).toHaveBeenCalledWith(expect.anything(), 'a', 10);
    expect(adjustAccountBalance).toHaveBeenCalledWith(expect.anything(), 'b', -15);
    expect(updateAccountBalance).not.toHaveBeenCalled();
  });
});

describe('Storico: la casa non rompe quello personale', () => {
  it('se la lettura della casa fallisce lo storico personale si vede lo stesso', async () => {
    dati.casaFalla = true;
    render(<HistoryPage />);
    await waitFor(() => expect(screen.getByText('Pane')).toBeInTheDocument());
    expect(screen.queryByText('Movimenti con la casa')).not.toBeInTheDocument();
  });
});
