import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }));
vi.mock('@/lib/useThrowToBoundary', () => ({
  useThrowToBoundary: () => (e: unknown) => {
    throw e;
  },
}));
vi.mock('@/lib/data/categories', () => ({ getCategories: async () => [] }));
vi.mock('@/lib/data/goalSpending', () => ({ getSpecoCollegato: async () => 0 }));
vi.mock('@/lib/data/goals', () => ({
  getOpenGoals: async () => [
    {
      id: 'g1', nome: 'Telepass', importoTarget: 130, modalita: 'bloccato', scadenza: null,
      categoriaId: null, ricorrente: false, frequenzaMesi: null, stato: 'aperto', createdAt: '2026-01-01T00:00:00Z',
    },
  ],
  createGoal: vi.fn(),
  updateGoal: vi.fn(),
  closeGoal: vi.fn().mockResolvedValue(undefined),
}));

import GoalsPage from '@/app/goals/page';
import { AnnullaProvider } from '@/app/AnnullaProvider';
import { closeGoal } from '@/lib/data/goals';

function Pagina() {
  return (
    <AnnullaProvider>
      <GoalsPage />
    </AnnullaProvider>
  );
}

// act di React e timer finti non vanno d'accordo: si fa passare il tempo e si lasciano finire le promesse.
async function passa(ms: number) {
  await vi.advanceTimersByTimeAsync(ms);
  for (let i = 0; i < 20; i++) await Promise.resolve();
}

async function apri() {
  render(<Pagina />);
  await waitFor(() => expect(screen.getByText('Telepass')).toBeInTheDocument());
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.useRealTimers());

describe('Obiettivi: chiudere con Annulla', () => {
  it('il clic nasconde l obiettivo e non scrive ancora', async () => {
    await apri();
    fireEvent.click(screen.getByLabelText('Chiudi obiettivo'));
    expect(screen.queryByText('Telepass')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Obiettivo chiuso.');
    expect(closeGoal).not.toHaveBeenCalled();
  });

  it('dopo 5 secondi chiude una volta', async () => {
    await apri();
    fireEvent.click(screen.getByLabelText('Chiudi obiettivo'));
    await passa(5000);
    expect(closeGoal).toHaveBeenCalledTimes(1);
    expect(closeGoal).toHaveBeenCalledWith(expect.anything(), 'g1');
  });

  it('Annulla non scrive mai e l obiettivo torna', async () => {
    await apri();
    fireEvent.click(screen.getByLabelText('Chiudi obiettivo'));
    fireEvent.click(screen.getByRole('button', { name: 'Annulla' }));
    expect(screen.getByText('Telepass')).toBeInTheDocument();
    await passa(10000);
    expect(closeGoal).not.toHaveBeenCalled();
  });
});

describe('Obiettivi: nuovo obiettivo', () => {
  it('il modulo sta in un foglio che si apre con Nuovo obiettivo', async () => {
    render(<Pagina />);
    await waitFor(() => expect(screen.getByText('Telepass')).toBeInTheDocument());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText('tutto messo da parte')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Nuovo obiettivo' }));
    const foglio = screen.getByRole('dialog', { name: 'Nuovo obiettivo' });
    expect(foglio).toContainElement(screen.getByLabelText('Nome'));
  });
});
