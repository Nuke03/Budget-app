import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }), usePathname: () => '/x' }));
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

const dati = vi.hoisted(() => ({
  casaFalla: false,
  // Come l'hook vero, restituisce sempre la stessa funzione: se cambiasse a ogni render, l'effetto di lettura
  // ripartirebbe a ogni render e una lettura fallita finirebbe in un catch che rilancia, senza nessuno che la gestisca.
  fail: (e: unknown) => {
    throw e;
  },
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) } }),
}));
vi.mock('@/lib/useThrowToBoundary', () => ({
  useThrowToBoundary: () => dati.fail,
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
  deleteTransaction: vi.fn().mockResolvedValue(1),
  getTransactions: vi.fn(async () => [
    {
      id: 't1', tipo: 'expense', importo: 10, data: '2026-11-04', categoriaId: null, accountId: 'a',
      goalId: null, descrizione: 'Pane', nota: null, createdAt: '',
    },
  ]),
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
import { deleteTransaction, getTransactions } from '@/lib/data/transactions';
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
      // setImmediate non è finto: React aggiorna lo schermo fuori da act con un suo task.
      await new Promise<void>((r) => setImmediate(r));
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

    it('cancellata ma saldo non aggiornato: la riga non torna, si ricarica e compare l avviso', async () => {
      vi.mocked(adjustAccountBalance).mockRejectedValueOnce(new Error('rete'));
      await apri();
      const prima = vi.mocked(getTransactions).mock.calls.length;
      fireEvent.click(screen.getByLabelText('Elimina transazione'));
      await passa(5000);
      expect(deleteTransaction).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('alert')).toHaveTextContent('Spesa eliminata, ma il saldo del conto non si è aggiornato: controllalo in Conti.');
      expect(vi.mocked(getTransactions).mock.calls.length).toBeGreaterThan(prima);
    });

    it('già cancellata (0 righe): il saldo non si tocca una seconda volta', async () => {
      vi.mocked(deleteTransaction).mockResolvedValueOnce(0);
      await apri();
      fireEvent.click(screen.getByLabelText('Elimina transazione'));
      await passa(5000);
      expect(deleteTransaction).toHaveBeenCalledTimes(1);
      expect(adjustAccountBalance).not.toHaveBeenCalled();
    });

    it('ricarica fallita dopo la scrittura: nessun errore, nessun secondo tentativo, saldo mosso una volta', async () => {
      await apri();
      fireEvent.click(screen.getByLabelText('Elimina transazione'));
      vi.mocked(getTransactions).mockRejectedValueOnce(new Error('rete'));
      await passa(5000);
      await passa(10000);
      expect(deleteTransaction).toHaveBeenCalledTimes(1);
      expect(adjustAccountBalance).toHaveBeenCalledTimes(1);
      expect(screen.queryByText(/riprova/)).not.toBeInTheDocument();
      expect(screen.queryByText('Pane')).not.toBeInTheDocument();
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
