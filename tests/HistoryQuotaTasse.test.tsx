import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }), usePathname: () => '/x' }));
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) } }),
}));
const fail = vi.hoisted(() => (e: unknown) => {
  throw e;
});
vi.mock('@/lib/useThrowToBoundary', () => ({ useThrowToBoundary: () => fail }));
vi.mock('@/lib/calculations/filterTransactionsByPeriodo', async (orig) => {
  const m = await orig<typeof import('@/lib/calculations/filterTransactionsByPeriodo')>();
  return { ...m, filterTransactionsByPeriodo: (t: unknown[]) => t };
});
vi.mock('@/app/history/HistoryChartCard', () => ({ HistoryChartCard: () => null }));
vi.mock('@/app/add/AddTransactionForm', () => ({ AddTransactionForm: () => null }));
vi.mock('@/lib/data/categories', () => ({ getCategories: async () => [] }));
vi.mock('@/lib/data/accounts', () => ({
  getAccounts: async () => [{ id: 'a', nome: 'A', saldoAttuale: 100, contaInDisponibile: true, targetSaldo: null }],
  getContiArchiviati: async () => [],
  updateAccountBalance: vi.fn(),
}));
vi.mock('@/lib/data/goals', () => ({ getOpenGoals: async () => [], createGoal: vi.fn() }));
vi.mock('@/lib/data/transactions', () => ({
  modificaMovimento: vi.fn().mockResolvedValue(undefined),
  eliminaMovimento: vi.fn().mockResolvedValue(undefined),
  getTransactions: vi.fn(),
}));
vi.mock('@/lib/data/households', () => ({ getMyHousehold: async () => null }));
vi.mock('@/lib/data/transfers', () => ({ getTransfers: async () => [] }));
vi.mock('@/lib/data/pivaSettings', () => ({ getPivaSettings: vi.fn() }));
vi.mock('@/lib/data/piva', () => ({
  getAccantonamenti: vi.fn(),
  annullaAccantonamento: vi.fn(),
}));

import HistoryPage from '@/app/history/page';
import { AnnullaProvider } from '@/app/AnnullaProvider';
import { eliminaMovimento, getTransactions } from '@/lib/data/transactions';
import { getPivaSettings } from '@/lib/data/pivaSettings';
import { annullaAccantonamento, getAccantonamenti } from '@/lib/data/piva';
import { assertNessunaParolaVietata } from './helpers/paroleVietate';

const riga = (tipo: 'income' | 'expense') => ({
  id: 't1', tipo, importo: 600, data: '2026-11-04', categoriaId: null, accountId: 'a',
  goalId: null, descrizione: 'Seduta', nota: null, createdAt: '', stima: false,
});
const accantonamento = (transactionId: string | null) => ({
  id: 'pa1', transactionId, importo: 82, data: '2026-11-05', daAccountId: 'a', aAccountId: 'tasse',
});

function Pagina() {
  return (
    <AnnullaProvider>
      <HistoryPage />
    </AnnullaProvider>
  );
}

async function apriEElimina() {
  const r = render(<Pagina />);
  await waitFor(() => expect(screen.getByText('Seduta')).toBeInTheDocument());
  // le righe degli spostamenti arrivano dopo quelle personali
  await waitFor(() => expect(getPivaSettings).toHaveBeenCalled());
  for (let i = 0; i < 3; i++) await new Promise<void>((r) => setTimeout(r, 0));
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  fireEvent.click(screen.getByLabelText('Elimina transazione'));
  return r;
}

// act di React e timer finti non vanno d'accordo: si fa passare il tempo e si lasciano finire le promesse.
async function passa(ms: number) {
  await vi.advanceTimersByTimeAsync(ms);
  for (let i = 0; i < 20; i++) await Promise.resolve();
  await new Promise<void>((r) => setImmediate(r));
}

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  vi.mocked(getTransactions).mockResolvedValue([riga('income')]);
  vi.mocked(getPivaSettings).mockResolvedValue({ attivo: true } as never);
  vi.mocked(getAccantonamenti).mockResolvedValue([accantonamento('t1')]);
  vi.mocked(annullaAccantonamento).mockResolvedValue(1);
});
afterEach(() => vi.useRealTimers());

describe('P3: incasso eliminato con la quota già nel conto tasse', () => {
  it('dopo l eliminazione chiede con un tocco se riportare indietro la quota', async () => {
    await apriEElimina();
    // durante l attesa dell Annulla non chiede ancora
    expect(screen.queryByText(/La quota di/)).not.toBeInTheDocument();
    await passa(5000);
    expect(eliminaMovimento).toHaveBeenCalledWith(expect.anything(), 't1');
    expect(screen.getByText('La quota di 82 € è nel conto tasse. La riporto indietro?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sì' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'No' })).toBeInTheDocument();
    assertNessunaParolaVietata(document.body);
  });

  it('Sì annulla lo spostamento di quell accantonamento e chiude la domanda', async () => {
    await apriEElimina();
    await passa(5000);
    fireEvent.click(screen.getByRole('button', { name: 'Sì' }));
    await passa(0);
    expect(annullaAccantonamento).toHaveBeenCalledTimes(1);
    expect(annullaAccantonamento).toHaveBeenCalledWith(expect.anything(), 'pa1');
    expect(screen.queryByText(/La quota di/)).not.toBeInTheDocument();
  });

  it('No chiude la domanda e non tocca la quota', async () => {
    await apriEElimina();
    await passa(5000);
    fireEvent.click(screen.getByRole('button', { name: 'No' }));
    await passa(0);
    expect(annullaAccantonamento).not.toHaveBeenCalled();
    expect(screen.queryByText(/La quota di/)).not.toBeInTheDocument();
  });

  it('se Annulla ferma l eliminazione non chiede niente', async () => {
    await apriEElimina();
    fireEvent.click(screen.getByRole('button', { name: 'Annulla' }));
    await passa(6000);
    expect(eliminaMovimento).not.toHaveBeenCalled();
    expect(screen.queryByText(/La quota di/)).not.toBeInTheDocument();
  });

  it('se l eliminazione non riesce non chiede niente', async () => {
    vi.mocked(eliminaMovimento).mockRejectedValueOnce(new Error('rete'));
    await apriEElimina();
    await passa(5000);
    expect(screen.queryByText(/La quota di/)).not.toBeInTheDocument();
  });

  it('un incasso senza quota spostata non chiede niente', async () => {
    vi.mocked(getAccantonamenti).mockResolvedValue([accantonamento('altro')]);
    await apriEElimina();
    await passa(5000);
    expect(screen.queryByText(/La quota di/)).not.toBeInTheDocument();
  });

  it('una spesa non chiede niente, anche se per assurdo ha un accantonamento', async () => {
    vi.mocked(getTransactions).mockResolvedValue([riga('expense')]);
    await apriEElimina();
    await passa(5000);
    expect(screen.queryByText(/La quota di/)).not.toBeInTheDocument();
  });

  it('se annullare lo spostamento non riesce lo dice con calma e la domanda resta', async () => {
    vi.mocked(annullaAccantonamento).mockRejectedValue(new Error('rete'));
    await apriEElimina();
    await passa(5000);
    fireEvent.click(screen.getByRole('button', { name: 'Sì' }));
    await passa(0);
    expect(screen.getByText('Non è riuscito. Riprova.')).toBeInTheDocument();
    expect(screen.getByText('La quota di 82 € è nel conto tasse. La riporto indietro?')).toBeInTheDocument();
  });

  it('chi non ha la P.IVA attiva non vede la domanda', async () => {
    vi.mocked(getPivaSettings).mockResolvedValue({ attivo: false } as never);
    await apriEElimina();
    await passa(5000);
    expect(getAccantonamenti).not.toHaveBeenCalled();
    expect(screen.queryByText(/La quota di/)).not.toBeInTheDocument();
  });

  it('se si lascia lo Storico prima dei 5 secondi la domanda compare alla prossima apertura', async () => {
    const r = render(
      <AnnullaProvider>
        <HistoryPage />
      </AnnullaProvider>
    );
    await waitFor(() => expect(screen.getByText('Seduta')).toBeInTheDocument());
    await waitFor(() => expect(getPivaSettings).toHaveBeenCalled());
    for (let i = 0; i < 3; i++) await new Promise<void>((r) => setTimeout(r, 0));
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    fireEvent.click(screen.getByLabelText('Elimina transazione'));
    // si lascia la pagina: l'avviso globale resta e l'eliminazione parte lo stesso
    r.rerender(<AnnullaProvider>{null}</AnnullaProvider>);
    await passa(5000);
    expect(eliminaMovimento).toHaveBeenCalledWith(expect.anything(), 't1');
    r.rerender(
      <AnnullaProvider>
        <HistoryPage />
      </AnnullaProvider>
    );
    await passa(0);
    expect(screen.getByText('La quota di 82 € è nel conto tasse. La riporto indietro?')).toBeInTheDocument();
  });

  it('due eliminazioni vicine fanno due domande in fila', async () => {
    const due = [
      { ...riga('income'), id: 't1', descrizione: 'Seduta uno' },
      { ...riga('income'), id: 't2', descrizione: 'Seduta due' },
    ];
    vi.mocked(getTransactions).mockResolvedValue(due);
    vi.mocked(getAccantonamenti).mockResolvedValue([
      { ...accantonamento('t1'), id: 'pa1', importo: 82 },
      { ...accantonamento('t2'), id: 'pa2', importo: 41 },
    ]);
    render(<Pagina />);
    await waitFor(() => expect(screen.getByText('Seduta due')).toBeInTheDocument());
    await waitFor(() => expect(getPivaSettings).toHaveBeenCalled());
    for (let i = 0; i < 3; i++) await new Promise<void>((r) => setTimeout(r, 0));
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const elimina = screen.getAllByLabelText('Elimina transazione');
    fireEvent.click(elimina[0]);
    fireEvent.click(screen.getAllByLabelText('Elimina transazione')[0]);
    await passa(6000);
    expect(eliminaMovimento).toHaveBeenCalledTimes(2);
    expect(screen.getByText(/La quota di 82 €/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'No' }));
    await passa(0);
    expect(screen.getByText(/La quota di 41 €/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'No' }));
    await passa(0);
    expect(screen.queryByText(/La quota di/)).not.toBeInTheDocument();
  });

  it('l errore di una domanda non passa alla successiva', async () => {
    const due = [
      { ...riga('income'), id: 't1', descrizione: 'Seduta uno' },
      { ...riga('income'), id: 't2', descrizione: 'Seduta due' },
    ];
    vi.mocked(getTransactions).mockResolvedValue(due);
    vi.mocked(getAccantonamenti).mockResolvedValue([
      { ...accantonamento('t1'), id: 'pa1', importo: 82 },
      { ...accantonamento('t2'), id: 'pa2', importo: 41 },
    ]);
    vi.mocked(annullaAccantonamento).mockRejectedValue(new Error('rete'));
    render(<Pagina />);
    await waitFor(() => expect(screen.getByText('Seduta due')).toBeInTheDocument());
    await waitFor(() => expect(getPivaSettings).toHaveBeenCalled());
    for (let i = 0; i < 3; i++) await new Promise<void>((r) => setTimeout(r, 0));
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    fireEvent.click(screen.getAllByLabelText('Elimina transazione')[0]);
    fireEvent.click(screen.getAllByLabelText('Elimina transazione')[0]);
    await passa(6000);
    fireEvent.click(screen.getByRole('button', { name: 'Sì' }));
    await passa(0);
    expect(screen.getByText('Non è riuscito. Riprova.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'No' }));
    await passa(0);
    expect(screen.getByText(/La quota di 41 €/)).toBeInTheDocument();
    expect(screen.queryByText('Non è riuscito. Riprova.')).not.toBeInTheDocument();
  });
});
