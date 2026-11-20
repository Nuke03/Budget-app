import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }), usePathname: () => '/x' }));
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

  it('con ?nuovo=1&nome=&importo= il modulo si apre già compilato', async () => {
    window.history.pushState({}, '', '/goals?nuovo=1&nome=Cuffie&importo=89.9');
    try {
      render(<Pagina />);
      const foglio = await screen.findByRole('dialog', { name: 'Nuovo obiettivo' });
      expect(foglio).toContainElement(screen.getByLabelText('Nome'));
      expect(screen.getByLabelText('Nome')).toHaveValue('Cuffie');
      expect(screen.getByLabelText(/Importo/)).toHaveValue(89.9);
    } finally {
      window.history.pushState({}, '', '/');
    }
  });

  it('con valori non validi il modulo si apre vuoto', async () => {
    window.history.pushState({}, '', '/goals?nuovo=1&nome=&importo=-5');
    try {
      render(<Pagina />);
      await screen.findByRole('dialog', { name: 'Nuovo obiettivo' });
      expect(screen.getByLabelText('Nome')).toHaveValue('');
      expect(screen.getByLabelText(/Importo/)).toHaveValue(null);
    } finally {
      window.history.pushState({}, '', '/');
    }
  });
});

describe('Obiettivi: arrivo da un link con #goal-<id>', () => {
  afterEach(() => {
    window.history.pushState({}, '', '/');
    delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
  });

  it('a lista caricata porta la vista sulla riga indicata', async () => {
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    window.history.pushState({}, '', '/goals#goal-g1');
    render(<Pagina />);
    await waitFor(() => expect(screen.getByText('Telepass')).toBeInTheDocument());
    await waitFor(() => expect(scroll).toHaveBeenCalledTimes(1));
    expect(scroll.mock.contexts[0]).toBe(document.getElementById('goal-g1'));
  });

  it('senza hash, o con un hash che non è di un obiettivo, non scorre', async () => {
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    window.history.pushState({}, '', '/goals#goal-inesistente');
    render(<Pagina />);
    await waitFor(() => expect(screen.getByText('Telepass')).toBeInTheDocument());
    expect(scroll).not.toHaveBeenCalled();
  });
});
