import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CategoriesPage from '@/app/categories/page';

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({}),
}));

vi.mock('@/lib/data/categories', () => ({
  getCategories: vi.fn(),
  createCategory: vi.fn(),
  archiveCategory: vi.fn(),
}));

import { getCategories } from '@/lib/data/categories';

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
});
