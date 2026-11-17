import { describe, it, expect, vi, afterEach } from 'vitest';
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }), usePathname: () => '/x' }));
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CategoriesPage from '@/app/categories/page';
import { AnnullaProvider } from '@/app/AnnullaProvider';

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({}),
}));

vi.mock('@/lib/data/categories', () => ({
  getCategories: vi.fn(),
  createCategory: vi.fn(),
  updateCategory: vi.fn(),
  archiveCategory: vi.fn(),
}));

import { getCategories, updateCategory, archiveCategory } from '@/lib/data/categories';

const categories = [
  { id: '1', nome: 'Spesa alimentare', tipo: 'expense' as const, colore: null, archiviata: false },
  { id: '2', nome: 'Stipendio', tipo: 'income' as const, colore: null, archiviata: false },
];

function Pagina() {
  return (
    <AnnullaProvider>
      <CategoriesPage />
    </AnnullaProvider>
  );
}

// act di React e timer finti non vanno d'accordo: si fa passare il tempo e si lasciano finire le promesse.
async function passa(ms: number) {
  await vi.advanceTimersByTimeAsync(ms);
  for (let i = 0; i < 20; i++) await Promise.resolve();
}

describe('CategoriesPage: archiviare con Annulla', () => {
  async function apri() {
    vi.clearAllMocks();
    vi.mocked(getCategories).mockResolvedValue(categories);
    vi.mocked(archiveCategory).mockResolvedValue(undefined);
    render(<Pagina />);
    await waitFor(() => expect(screen.getByText('Spesa alimentare')).toBeInTheDocument());
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  }
  afterEach(() => vi.useRealTimers());

  it('il clic nasconde la categoria e non scrive ancora', async () => {
    await apri();
    fireEvent.click(screen.getByLabelText('Archivia Spesa alimentare'));
    expect(screen.queryByText('Spesa alimentare')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Categoria archiviata.');
    expect(archiveCategory).not.toHaveBeenCalled();
  });

  it('dopo 5 secondi archivia una volta', async () => {
    await apri();
    fireEvent.click(screen.getByLabelText('Archivia Spesa alimentare'));
    await passa(5000);
    expect(archiveCategory).toHaveBeenCalledTimes(1);
    expect(archiveCategory).toHaveBeenCalledWith(expect.anything(), '1');
  });

  it('Annulla non scrive mai e la categoria torna', async () => {
    await apri();
    fireEvent.click(screen.getByLabelText('Archivia Spesa alimentare'));
    fireEvent.click(screen.getByRole('button', { name: 'Annulla' }));
    expect(screen.getByText('Spesa alimentare')).toBeInTheDocument();
    await passa(10000);
    expect(archiveCategory).not.toHaveBeenCalled();
  });
});

describe('CategoriesPage', () => {
  it('mostra di default solo le categorie di spesa, e passa a quelle di entrata col toggle', async () => {
    vi.mocked(getCategories).mockResolvedValue(categories);
    render(<Pagina />);

    await waitFor(() => {
      expect(screen.getByText('Spesa alimentare')).toBeInTheDocument();
    });
    expect(screen.queryByText('Stipendio')).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByText('Entrata')[0]);

    expect(screen.getByText('Stipendio')).toBeInTheDocument();
    expect(screen.queryByText('Spesa alimentare')).not.toBeInTheDocument();
  });

  it('precompila nome e colore e salva le modifiche cliccando la matita di una categoria', async () => {
    vi.mocked(getCategories).mockResolvedValue(categories);
    vi.mocked(updateCategory).mockResolvedValue({
      id: '1',
      nome: 'Spesa alimentare modificata',
      tipo: 'expense',
      colore: '#3B9AE1',
      archiviata: false,
    });
    render(<Pagina />);

    await waitFor(() => {
      expect(screen.getByText('Spesa alimentare')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText('Modifica Spesa alimentare'));

    const nomeInput = screen.getByDisplayValue('Spesa alimentare');
    fireEvent.change(nomeInput, { target: { value: 'Spesa alimentare modificata' } });
    fireEvent.click(screen.getByLabelText('Cielo'));
    fireEvent.click(screen.getByText('Salva modifiche'));

    await waitFor(() => {
      expect(updateCategory).toHaveBeenCalledWith(expect.anything(), '1', {
        nome: 'Spesa alimentare modificata',
        colore: '#3B9AE1',
      });
    });
  });

  it('annulla la modifica e torna al form di creazione', async () => {
    vi.mocked(getCategories).mockResolvedValue(categories);
    render(<Pagina />);

    await waitFor(() => {
      expect(screen.getByText('Spesa alimentare')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText('Modifica Spesa alimentare'));
    expect(screen.getByText('Modifica categoria')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Annulla'));
    expect(screen.getByText('Nuova categoria')).toBeInTheDocument();
  });
});
