import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
import { AnnullaProvider } from '@/app/AnnullaProvider';
import { deleteTransaction } from '@/lib/data/transactions';
import { adjustAccountBalance, updateAccountBalance } from '@/lib/data/accounts';

function Pagina() {
  return (
    <AnnullaProvider>
      <HistoryPage />
    </AnnullaProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  dati.casaFalla = false;
});

describe('Storico: saldi personali per differenza', () => {
  describe('eliminare una spesa (con Annulla)', () => {
    async function apri() {
      render(<Pagina />);
      await waitFor(() => expect(screen.getByText('Pane')).toBeInTheDocument());
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    }
    // act di React e timer finti non vanno d'accordo: si fa passare il tempo e si lasciano finire le promesse.
    async function passa(ms: number) {
      await vi.advanceTimersByTimeAsync(ms);
      for (let i = 0; i < 20; i++) await Promise.resolve();
    }
    afterEach(() => vi.useRealTimers());

    it('il clic nasconde la riga e non scrive ancora', async () => {
      await apri();
      fireEvent.click(screen.getByLabelText('Elimina transazione'));
      expect(screen.queryByText('Pane')).not.toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveTextContent('Spesa eliminata.');
      expect(deleteTransaction).not.toHaveBeenCalled();
      expect(adjustAccountBalance).not.toHaveBeenCalled();
    });

    it('dopo 5 secondi scrive una volta e restituisce l importo con un delta, mai un saldo assoluto', async () => {
      await apri();
      fireEvent.click(screen.getByLabelText('Elimina transazione'));
      await passa(5000);
      expect(deleteTransaction).toHaveBeenCalledTimes(1);
      expect(deleteTransaction).toHaveBeenCalledWith(expect.anything(), 't1');
      expect(adjustAccountBalance).toHaveBeenCalledWith(expect.anything(), 'a', 10);
      expect(adjustAccountBalance).toHaveBeenCalledTimes(1);
      expect(updateAccountBalance).not.toHaveBeenCalled();
    });

    it('Annulla non scrive mai e la riga torna', async () => {
      await apri();
      fireEvent.click(screen.getByLabelText('Elimina transazione'));
      fireEvent.click(screen.getByRole('button', { name: 'Annulla' }));
      expect(screen.getByText('Pane')).toBeInTheDocument();
      await passa(10000);
      expect(deleteTransaction).not.toHaveBeenCalled();
      expect(adjustAccountBalance).not.toHaveBeenCalled();
    });
  });

  it('modificare con cambio di conto sposta +10 sul vecchio e -15 sul nuovo', async () => {
    render(<Pagina />);
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
    render(<Pagina />);
    await waitFor(() => expect(screen.getByText('Pane')).toBeInTheDocument());
    expect(screen.queryByText('Movimenti con la casa')).not.toBeInTheDocument();
  });
});
