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
  updateAccountBalance: vi.fn(),
}));
vi.mock('@/lib/data/goals', () => ({ getOpenGoals: async () => [], createGoal: vi.fn() }));
vi.mock('@/lib/data/transactions', () => ({
  modificaMovimento: vi.fn().mockResolvedValue(undefined),
  eliminaMovimento: vi.fn().mockResolvedValue(undefined),
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
import { eliminaMovimento, modificaMovimento, getTransactions } from '@/lib/data/transactions';
import { updateAccountBalance } from '@/lib/data/accounts';

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
      expect(eliminaMovimento).not.toHaveBeenCalled();
    });

    it('dopo 5 secondi chiama una sola rpc elimina_movimento (riga e saldo insieme, mai un delta dal client)', async () => {
      await apri();
      fireEvent.click(screen.getByLabelText('Elimina transazione'));
      await passa(5000);
      expect(eliminaMovimento).toHaveBeenCalledTimes(1);
      expect(eliminaMovimento).toHaveBeenCalledWith(expect.anything(), 't1');
      expect(updateAccountBalance).not.toHaveBeenCalled();
    });

    it('errore della rpc: la riga torna e compare il messaggio', async () => {
      vi.mocked(eliminaMovimento).mockRejectedValueOnce(new Error('rete'));
      await apri();
      fireEvent.click(screen.getByLabelText('Elimina transazione'));
      await passa(5000);
      expect(screen.getByText('Pane')).toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveTextContent('Non è andata: riprova.');
      expect(eliminaMovimento).toHaveBeenCalledTimes(1);
    });

    it('ricarica fallita dopo la scrittura: nessun errore, nessun secondo tentativo', async () => {
      await apri();
      fireEvent.click(screen.getByLabelText('Elimina transazione'));
      vi.mocked(getTransactions).mockRejectedValueOnce(new Error('rete'));
      await passa(5000);
      await passa(10000);
      expect(eliminaMovimento).toHaveBeenCalledTimes(1);
      expect(screen.queryByText(/riprova/)).not.toBeInTheDocument();
      expect(screen.queryByText('Pane')).not.toBeInTheDocument();
    });

    it('Annulla non scrive mai e la riga torna', async () => {
      await apri();
      fireEvent.click(screen.getByLabelText('Elimina transazione'));
      fireEvent.click(screen.getByRole('button', { name: 'Annulla' }));
      expect(screen.getByText('Pane')).toBeInTheDocument();
      await passa(10000);
      expect(eliminaMovimento).not.toHaveBeenCalled();
    });
  });

  it('modificare chiama una sola rpc modifica_movimento con tutti i campi', async () => {
    render(<Pagina />);
    await waitFor(() => expect(screen.getByText('Pane')).toBeInTheDocument());
    fireEvent.click(screen.getByLabelText('Modifica transazione'));
    fireEvent.click(await screen.findByText('Salva simulato'));
    await waitFor(() => expect(modificaMovimento).toHaveBeenCalledTimes(1));
    expect(modificaMovimento).toHaveBeenCalledWith(expect.anything(), 't1', {
      tipo: 'expense',
      importo: 15,
      categoriaId: null,
      accountId: 'b',
      goalId: null,
      descrizione: 'Pane',
      data: '2026-11-04',
      nota: null,
    });
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
