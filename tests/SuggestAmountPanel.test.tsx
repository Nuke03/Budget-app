import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SuggestAmountPanel } from '@/app/goals/SuggestAmountPanel';

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({}),
}));

vi.mock('@/lib/data/transactions', () => ({
  getRecentTransactionAmounts: vi.fn(),
}));

import { getRecentTransactionAmounts } from '@/lib/data/transactions';

describe('SuggestAmountPanel', () => {
  it('mostra il messaggio quando non ci sono spese storiche nella categoria', async () => {
    vi.mocked(getRecentTransactionAmounts).mockResolvedValue([]);
    render(<SuggestAmountPanel categoriaId="cat-1" onUseAmount={vi.fn()} />);

    await waitFor(() => {
      expect(
        screen.getByText(
          'Non ci sono ancora abbastanza spese in questa categoria per calcolare una media.'
        )
      ).toBeInTheDocument();
    });
  });

  it("calcola e mostra l'importo suggerito, e lo passa a onUseAmount al click", async () => {
    vi.mocked(getRecentTransactionAmounts).mockResolvedValue([100, 110, 90]);
    const onUseAmount = vi.fn();
    render(<SuggestAmountPanel categoriaId="cat-1" onUseAmount={onUseAmount} />);

    // media = 100, margine default 10% => 110
    await waitFor(() => {
      expect(screen.getByText('110,00 €')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Usa questo importo'));
    expect(onUseAmount).toHaveBeenCalledWith(110);
  });
});
