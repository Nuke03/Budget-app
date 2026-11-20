import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
const nav = vi.hoisted(() => ({ qs: '', replace: vi.fn(), refresh: vi.fn(), push: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => nav,
  usePathname: () => '/x',
  useSearchParams: () => new URLSearchParams(nav.qs),
}));
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }));
vi.mock('@/lib/useThrowToBoundary', () => ({
  useThrowToBoundary: () => (e: unknown) => {
    throw e;
  },
}));
vi.mock('@/lib/data/categories', () => ({ getCategories: async () => [] }));
vi.mock('@/lib/data/goalSpending', () => ({ getSpecoCollegato: async () => 0 }));
const extra = vi.hoisted(() => ({ obiettivi: [] as unknown[] }));
vi.mock('@/lib/data/goals', () => ({
  getOpenGoals: async () => [
    {
      id: 'g1', nome: 'Telepass', importoTarget: 130, modalita: 'bloccato', scadenza: null,
      categoriaId: null, ricorrente: false, frequenzaMesi: null, stato: 'aperto', createdAt: '2026-01-01T00:00:00Z',
    },
    ...extra.obiettivi,
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

beforeEach(() => {
  vi.clearAllMocks();
  nav.qs = '';
});
afterEach(() => vi.useRealTimers());

describe('Obiettivi: chiudere con Annulla', () => {
  it('il clic nasconde l obiettivo e non scrive ancora', async () => {
    await apri();
    fireEvent.click(screen.getByLabelText('Chiudi cassetto'));
    expect(screen.queryByText('Telepass')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Cassetto chiuso.');
    expect(closeGoal).not.toHaveBeenCalled();
  });

  it('dopo 5 secondi chiude una volta', async () => {
    await apri();
    fireEvent.click(screen.getByLabelText('Chiudi cassetto'));
    await passa(5000);
    expect(closeGoal).toHaveBeenCalledTimes(1);
    expect(closeGoal).toHaveBeenCalledWith(expect.anything(), 'g1');
  });

  it('Annulla non scrive mai e l obiettivo torna', async () => {
    await apri();
    fireEvent.click(screen.getByLabelText('Chiudi cassetto'));
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
    fireEvent.click(screen.getByRole('button', { name: 'Nuovo cassetto' }));
    const foglio = screen.getByRole('dialog', { name: 'Nuovo cassetto' });
    expect(foglio).toContainElement(screen.getByLabelText('Nome'));
  });

  it('con ?nuovo=1&nome=&importo= il modulo si apre già compilato, e l indirizzo si pulisce', async () => {
    nav.qs = 'nuovo=1&nome=Cuffie&importo=89.9';
    render(<Pagina />);
    const foglio = await screen.findByRole('dialog', { name: 'Nuovo cassetto' });
    expect(foglio).toContainElement(screen.getByLabelText('Nome'));
    expect(screen.getByLabelText('Nome')).toHaveValue('Cuffie');
    expect(screen.getByLabelText(/Importo/)).toHaveValue(89.9);
    expect(nav.replace).toHaveBeenCalledWith('/goals');
  });

  it('con valori non validi il modulo si apre vuoto', async () => {
    nav.qs = 'nuovo=1&nome=&importo=-5';
    render(<Pagina />);
    await screen.findByRole('dialog', { name: 'Nuovo cassetto' });
    expect(screen.getByLabelText('Nome')).toHaveValue('');
    expect(screen.getByLabelText(/Importo/)).toHaveValue(null);
  });

  it('a pagina già aperta un nuovo ?nuovo=1 apre il modulo', async () => {
    const { rerender } = render(<Pagina />);
    await waitFor(() => expect(screen.getByText('Telepass')).toBeInTheDocument());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    nav.qs = 'nuovo=1&nome=Cuffie&importo=89.9';
    rerender(<Pagina />);
    const foglio = await screen.findByRole('dialog', { name: 'Nuovo cassetto' });
    expect(screen.getByLabelText('Nome')).toHaveValue('Cuffie');
    expect(foglio).toContainElement(screen.getByLabelText('Nome'));
  });
});

describe('Obiettivi: versare dal menu (?versa=<id>)', () => {
  // Un id nel formato degli id veri (UUID): quello corto non passa il controllo di ?versa=.
  const CASSETTO_ID = 'a1b2c3d4-0000-4000-8000-000000000002';
  const cassetto = {
    id: CASSETTO_ID, nome: 'Vacanza', importoTarget: 600, modalita: 'dilazionato', scadenza: '2099-12-31',
    categoriaId: null, ricorrente: false, frequenzaMesi: null, stato: 'aperto', createdAt: '2026-01-01T00:00:00Z',
  };
  const altro = { ...cassetto, id: 'a1b2c3d4-0000-4000-8000-000000000003', nome: 'Auto' };
  beforeEach(() => {
    extra.obiettivi = [cassetto, altro];
  });
  afterEach(() => {
    extra.obiettivi = [];
    nav.qs = '';
  });

  it('apre la conferma solo sul cassetto indicato, e pulisce l indirizzo', async () => {
    nav.qs = `versa=${CASSETTO_ID}`;
    render(<Pagina />);
    await waitFor(() => expect(screen.getByLabelText('Importo')).toBeInTheDocument());
    expect(screen.getAllByLabelText('Importo')).toHaveLength(1);
    expect(document.getElementById(`goal-${CASSETTO_ID}`)).toContainElement(screen.getByLabelText('Importo'));
    expect(document.getElementById('goal-a1b2c3d4-0000-4000-8000-000000000003')).not.toContainElement(
      screen.getByLabelText('Importo')
    );
    expect(nav.replace).toHaveBeenCalledWith('/goals');
  });

  it('a pagina già aperta un nuovo ?versa= apre la conferma del cassetto', async () => {
    const { rerender } = render(<Pagina />);
    await waitFor(() => expect(screen.getByText('Telepass')).toBeInTheDocument());
    expect(screen.queryByLabelText('Importo')).not.toBeInTheDocument();
    nav.qs = `versa=${CASSETTO_ID}`;
    rerender(<Pagina />);
    await waitFor(() => expect(screen.getByLabelText('Importo')).toBeInTheDocument());
    expect(document.getElementById(`goal-${CASSETTO_ID}`)).toContainElement(screen.getByLabelText('Importo'));
    expect(nav.replace).toHaveBeenCalledWith('/goals');
  });

  it('un id non valido non apre niente', async () => {
    nav.qs = 'versa=non-valido!';
    render(<Pagina />);
    await waitFor(() => expect(screen.getByText('Telepass')).toBeInTheDocument());
    expect(screen.queryByLabelText('Importo')).not.toBeInTheDocument();
  });

  it('un id sconosciuto non apre niente', async () => {
    nav.qs = 'versa=00000000-0000-0000-0000-000000000000';
    render(<Pagina />);
    await waitFor(() => expect(screen.getByText('Telepass')).toBeInTheDocument());
    expect(screen.queryByLabelText('Importo')).not.toBeInTheDocument();
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
