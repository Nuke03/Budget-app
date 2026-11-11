import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import type { Transaction, Transfer } from '@/lib/types';

const chartProps = vi.hoisted(() => ({ last: null as unknown }));
const dati = vi.hoisted(() => ({ casa: false }));

vi.mock('@/lib/supabase/client', () => ({
  // Token finto con sub u1: lo storico legge l'utente dalla sessione, senza chiamate di rete.
  createClient: () => ({
    auth: { getSession: async () => ({ data: { session: { access_token: `x.${btoa('{"sub":"u1"}')}.y` } } }) },
  }),
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
vi.mock('@/app/history/HistoryChartCard', () => ({
  HistoryChartCard: (props: unknown) => {
    chartProps.last = props;
    return null;
  },
}));
vi.mock('@/app/add/AddTransactionForm', () => ({ AddTransactionForm: () => null }));
vi.mock('@/lib/data/categories', () => ({
  getCategories: async () => [{ id: 'c1', nome: 'Spesa', tipo: 'expense', colore: null, archiviata: false }],
}));
vi.mock('@/lib/data/accounts', () => ({ getAccounts: async () => [], updateAccountBalance: vi.fn(), adjustAccountBalance: vi.fn() }));
vi.mock('@/lib/data/goals', () => ({ getOpenGoals: async () => [], createGoal: vi.fn() }));
vi.mock('@/lib/data/transactions', () => ({
  updateTransaction: vi.fn(),
  deleteTransaction: vi.fn(),
  getTransactions: async (_s: unknown, scope?: { kind: string }) => {
    if (scope?.kind === 'casa') {
      return [
        {
          id: 'h1', tipo: 'expense', importo: 200, data: '2026-11-05', categoriaId: 'c1', accountId: null,
          goalId: null, descrizione: 'Bolletta', nota: null, createdAt: '', pagataDaUserId: 'u1',
        },
      ] satisfies Transaction[];
    }
    return [
      {
        id: 't1', tipo: 'expense', importo: 50, data: '2026-11-04', categoriaId: 'c1', accountId: null,
        goalId: null, descrizione: 'Pane', nota: null, createdAt: '',
      },
      {
        id: 't2', tipo: 'income', importo: 1000, data: '2026-11-01', categoriaId: null, accountId: null,
        goalId: null, descrizione: 'Stipendio', nota: null, createdAt: '',
      },
    ] satisfies Transaction[];
  },
}));
vi.mock('@/lib/data/households', () => ({
  getMyHousehold: async () =>
    dati.casa
      ? {
          household: { id: 'H' },
          members: [
            { userId: 'u1', displayName: 'Fabio' },
            { userId: 'u2', displayName: 'Anna' },
          ],
        }
      : null,
}));
vi.mock('@/lib/data/transfers', () => ({
  getTransfers: async () =>
    [
      {
        id: 'v1', householdId: 'H', userId: 'u1', daAccountId: 'a1', aAccountId: null, importo: 776,
        data: '2026-11-03', causale: 'versamento', beneficiarioUserId: null, perContoDiUserId: null,
        meseCompetenza: '2026-11-01', soloRegistrazione: false, nota: null, createdAt: '',
      },
    ] satisfies Transfer[],
}));

import HistoryPage from '@/app/history/page';

async function renderStorico(conCasa: boolean) {
  dati.casa = conCasa;
  chartProps.last = null;
  const { container } = render(<HistoryPage />);
  await waitFor(() => expect(screen.getByText('Pane')).toBeInTheDocument());
  if (conCasa) {
    await waitFor(() => expect(screen.getByText('Movimenti con la casa')).toBeInTheDocument());
  }
  const righe = Array.from(container.querySelectorAll('main > ul > li')).map((li) => li.textContent);
  const chart = JSON.parse(JSON.stringify(chartProps.last));
  return { chart, righe };
}

describe('Storico con la casa', () => {
  it('trasferimenti e spese di casa presenti non cambiano totali e grafici', async () => {
    const senza = await renderStorico(false);
    expect(screen.queryByText('Movimenti con la casa')).not.toBeInTheDocument();
    cleanup();
    const con = await renderStorico(true);
    expect(screen.getByText('Versamento alla casa, novembre')).toBeInTheDocument();
    expect(screen.getByText('Spesa di casa pagata da te: Bolletta')).toBeInTheDocument();
    expect(con.chart).toEqual(senza.chart);
    expect(con.righe).toEqual(senza.righe);
    expect(con.righe).toHaveLength(2);
  });
});
