import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CreateGoalForm } from '@/app/goals/CreateGoalForm';

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({}),
}));

vi.mock('@/lib/data/transactions', () => ({
  getRecentTransactionAmounts: vi.fn().mockResolvedValue([]),
}));

describe('CreateGoalForm', () => {
  it('richiede una scadenza quando la modalità è dilazionato', () => {
    const onSubmit = vi.fn();
    render(<CreateGoalForm categories={[]} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Regalo anniversario' } });
    fireEvent.change(screen.getByLabelText('Importo target'), { target: { value: '100' } });
    fireEvent.change(screen.getByLabelText('Modalità'), { target: { value: 'dilazionato' } });

    expect(screen.getByText('Crea obiettivo')).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Scadenza'), { target: { value: '2026-11-27' } });

    expect(screen.getByText('Crea obiettivo')).toBeEnabled();
  });

  it('non richiede scadenza quando la modalità è bloccato', () => {
    const onSubmit = vi.fn();
    render(<CreateGoalForm categories={[]} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Telepass' } });
    fireEvent.change(screen.getByLabelText('Importo target'), { target: { value: '130' } });

    expect(screen.getByText('Crea obiettivo')).toBeEnabled();
  });

  it('invia frequenzaMesi corretta in base al preset selezionato', () => {
    const onSubmit = vi.fn();
    render(<CreateGoalForm categories={[]} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Tidal' } });
    fireEvent.change(screen.getByLabelText('Importo target'), { target: { value: '10' } });
    fireEvent.click(screen.getByLabelText('Ricorrente'));
    fireEvent.change(screen.getByLabelText('Frequenza'), { target: { value: '3' } });

    fireEvent.click(screen.getByText('Crea obiettivo'));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ ricorrente: true, frequenzaMesi: 3 })
    );
  });

  it('mostra il pannello di suggerimento quando si seleziona una categoria', async () => {
    const categories = [
      { id: 'cat-1', nome: 'Bollette luce', tipo: 'expense' as const, colore: null, archiviata: false },
    ];
    render(<CreateGoalForm categories={categories} onSubmit={vi.fn()} />);

    expect(screen.queryByLabelText('Quante spese passate')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Categoria'), { target: { value: 'cat-1' } });

    expect(await screen.findByLabelText('Quante spese passate')).toBeInTheDocument();
  });
});
