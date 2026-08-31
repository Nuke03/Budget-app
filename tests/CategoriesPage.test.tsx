import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CategoriesPage from '@/app/categories/page';

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({}),
}));

vi.mock('@/lib/data/categories', () => ({
  getCategories: vi.fn(),
  createCategory: vi.fn(),
  updateCategory: vi.fn(),
  archiveCategory: vi.fn(),
}));

import { getCategories, updateCategory } from '@/lib/data/categories';

const categories = [
  { id: '1', nome: 'Spesa alimentare', tipo: 'expense' as const, colore: null, archiviata: false },
  { id: '2', nome: 'Stipendio', tipo: 'income' as const, colore: null, archiviata: false },
];

describe('CategoriesPage', () => {
  it('mostra di default solo le categorie di spesa, e passa a quelle di entrata col toggle', async () => {
    vi.mocked(getCategories).mockResolvedValue(categories);
    render(<CategoriesPage />);

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
    render(<CategoriesPage />);

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
    render(<CategoriesPage />);

    await waitFor(() => {
      expect(screen.getByText('Spesa alimentare')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText('Modifica Spesa alimentare'));
    expect(screen.getByText('Modifica categoria')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Annulla'));
    expect(screen.getByText('Nuova categoria')).toBeInTheDocument();
  });
});
