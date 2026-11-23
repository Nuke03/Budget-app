import { describe, it, expect, vi, afterEach } from 'vitest';
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }), usePathname: () => '/x' }));
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
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

import { getCategories, createCategory, updateCategory, archiveCategory } from '@/lib/data/categories';

const categories = [
  { id: '1', nome: 'Spesa alimentare', tipo: 'expense' as const, colore: null, archiviata: false, ruolo: null },
  { id: '2', nome: 'Stipendio', tipo: 'income' as const, colore: null, archiviata: false, ruolo: null },
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
      ruolo: null,
    });
    render(<Pagina />);

    await waitFor(() => {
      expect(screen.getByText('Spesa alimentare')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText('Modifica Spesa alimentare'));

    const nomeInput = screen.getByDisplayValue('Spesa alimentare');
    fireEvent.change(nomeInput, { target: { value: 'Spesa alimentare modificata' } });
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Modifica categoria' })).getByLabelText('Cielo'));
    fireEvent.click(screen.getByRole('button', { name: 'Salva' }));

    await waitFor(() => {
      expect(updateCategory).toHaveBeenCalledWith(expect.anything(), '1', {
        nome: 'Spesa alimentare modificata',
        colore: '#3B9AE1',
        ruolo: null,
      });
    });
  });

  it('la matita apre "Modifica categoria" in un foglio; chiuderlo lascia il modulo "Nuova categoria"', async () => {
    vi.mocked(getCategories).mockResolvedValue(categories);
    render(<Pagina />);
    await waitFor(() => expect(screen.getByText('Spesa alimentare')).toBeInTheDocument());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Modifica Spesa alimentare'));
    const foglio = screen.getByRole('dialog', { name: 'Modifica categoria' });
    expect(within(foglio).getByDisplayValue('Spesa alimentare')).toBeInTheDocument();
    expect(screen.getByText('Nuova categoria')).toBeInTheDocument();

    fireEvent.click(within(foglio).getByRole('button', { name: 'Chiudi' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText('Nuova categoria')).toBeInTheDocument();
  });

  it('il foglio ha 16 colori, 24 icone e "Nessuna icona"', async () => {
    vi.mocked(getCategories).mockResolvedValue(categories);
    render(<Pagina />);
    await waitFor(() => expect(screen.getByText('Spesa alimentare')).toBeInTheDocument());
    fireEvent.click(screen.getByLabelText('Modifica Spesa alimentare'));
    const foglio = within(screen.getByRole('dialog', { name: 'Modifica categoria' }));
    expect(within(foglio.getByRole('group', { name: 'Colore' })).getAllByRole('button')).toHaveLength(16);
    expect(within(foglio.getByRole('group', { name: 'Icona' })).getAllByRole('button')).toHaveLength(25);
    expect(foglio.getByRole('button', { name: 'Nessuna icona' })).toHaveAttribute('aria-pressed', 'true');
  });

  it("sceglie l'icona e la salva; toglierla scrive null", async () => {
    vi.mocked(getCategories).mockResolvedValue([{ ...categories[0], icona: 'casa' }, categories[1]]);
    vi.mocked(updateCategory).mockClear();
    vi.mocked(updateCategory).mockResolvedValue(categories[0]);
    render(<Pagina />);
    await waitFor(() => expect(screen.getByText('Spesa alimentare')).toBeInTheDocument());
    fireEvent.click(screen.getByLabelText('Modifica Spesa alimentare'));
    const foglio = within(screen.getByRole('dialog', { name: 'Modifica categoria' }));
    expect(foglio.getByRole('button', { name: 'Casa' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(foglio.getByRole('button', { name: 'Carrello' }));
    fireEvent.click(foglio.getByRole('button', { name: 'Salva' }));
    await waitFor(() => expect(updateCategory).toHaveBeenCalled());
    expect(vi.mocked(updateCategory).mock.calls[0][2]).toMatchObject({ icona: 'carrello' });

    vi.mocked(updateCategory).mockClear();
    fireEvent.click(await screen.findByLabelText('Modifica Spesa alimentare'));
    const foglio2 = within(screen.getByRole('dialog', { name: 'Modifica categoria' }));
    fireEvent.click(foglio2.getByRole('button', { name: 'Nessuna icona' }));
    fireEvent.click(foglio2.getByRole('button', { name: 'Salva' }));
    await waitFor(() => expect(updateCategory).toHaveBeenCalled());
    expect(vi.mocked(updateCategory).mock.calls[0][2]).toMatchObject({ icona: null });
  });

  it("Archivia dal foglio chiude il foglio e passa dall'Annulla", async () => {
    vi.mocked(getCategories).mockResolvedValue(categories);
    render(<Pagina />);
    await waitFor(() => expect(screen.getByText('Spesa alimentare')).toBeInTheDocument());
    fireEvent.click(screen.getByLabelText('Modifica Spesa alimentare'));
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Modifica categoria' })).getByRole('button', { name: 'Archivia' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Categoria archiviata.');
  });

  it("Nuova categoria ha colori e icone e crea con l'icona scelta", async () => {
    vi.mocked(getCategories).mockResolvedValue(categories);
    vi.mocked(createCategory).mockClear();
    vi.mocked(createCategory).mockResolvedValue(categories[0]);
    render(<Pagina />);
    await waitFor(() => expect(screen.getByText('Spesa alimentare')).toBeInTheDocument());
    expect(screen.getAllByRole('group', { name: 'Colore' })).toHaveLength(1);
    fireEvent.change(screen.getByLabelText('Nome categoria'), { target: { value: 'Bar' } });
    fireEvent.click(screen.getByRole('button', { name: 'Caffè' }));
    fireEvent.click(screen.getByRole('button', { name: 'Aggiungi categoria' }));
    await waitFor(() => expect(createCategory).toHaveBeenCalled());
    expect(vi.mocked(createCategory).mock.calls[0][1]).toMatchObject({ nome: 'Bar', tipo: 'expense', icona: 'caffe' });
  });

  it('una categoria di spesa ha la scelta Tipo e salva ruolo', async () => {
    vi.mocked(getCategories).mockResolvedValue(categories);
    vi.mocked(updateCategory).mockClear();
    vi.mocked(updateCategory).mockResolvedValue({ ...categories[0], ruolo: 'svago' });
    render(<Pagina />);
    await waitFor(() => expect(screen.getByText('Spesa alimentare')).toBeInTheDocument());
    fireEvent.click(screen.getByLabelText('Modifica Spesa alimentare'));
    expect(screen.getByText('Normale')).toBeInTheDocument();
    expect(screen.getByText('Spesa certa')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Svago e acquisti'));
    fireEvent.click(screen.getByRole('button', { name: 'Salva' }));
    await waitFor(() => {
      expect(updateCategory).toHaveBeenCalledWith(expect.anything(), '1', expect.objectContaining({ ruolo: 'svago' }));
    });
  });

  it('una categoria di entrata non ha la scelta Tipo', async () => {
    vi.mocked(getCategories).mockResolvedValue(categories);
    vi.mocked(updateCategory).mockClear();
    vi.mocked(updateCategory).mockResolvedValue(categories[1]);
    render(<Pagina />);
    await waitFor(() => expect(screen.getByText('Spesa alimentare')).toBeInTheDocument());
    fireEvent.click(screen.getAllByText('Entrata')[0]);
    fireEvent.click(screen.getByLabelText('Modifica Stipendio'));
    expect(screen.queryByText('Spesa certa')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Salva' }));
    await waitFor(() => expect(updateCategory).toHaveBeenCalled());
    expect(vi.mocked(updateCategory).mock.calls[0][2]).not.toHaveProperty('ruolo');
  });
});
