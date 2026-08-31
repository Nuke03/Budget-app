import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AddTransactionForm } from '@/app/add/AddTransactionForm';

const categories = [
  { id: 'cat-1', nome: 'Groceries', tipo: 'expense' as const, colore: null, archiviata: false },
];
const accounts = [
  { id: 'acc-1', nome: 'Conto corrente', saldoAttuale: 500, contaInDisponibile: true, targetSaldo: null },
];

describe('AddTransactionForm', () => {
  it('chiama onSubmit con i valori del form e mostra subito la transazione come aggiunta (optimistic UI)', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <AddTransactionForm categories={categories} accounts={accounts} onSubmit={onSubmit} />
    );

    fireEvent.change(screen.getByLabelText('Importo'), { target: { value: '26' } });
    fireEvent.change(screen.getByLabelText('Descrizione'), { target: { value: 'Spesa' } });
    fireEvent.click(screen.getByText('Salva'));

    expect(screen.getByText('Salvata ✓')).toBeInTheDocument();

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        tipo: 'expense',
        importo: 26,
        categoriaId: 'cat-1',
        accountId: 'acc-1',
        descrizione: 'Spesa',
      });
    });
  });

  it('disabilita il pulsante se importo o descrizione sono vuoti', () => {
    const onSubmit = vi.fn();
    render(
      <AddTransactionForm categories={categories} accounts={accounts} onSubmit={onSubmit} />
    );

    expect(screen.getByText('Salva')).toBeDisabled();
  });

  it('precompila i campi con i valori iniziali e usa l\'etichetta di modifica', () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <AddTransactionForm
        categories={categories}
        accounts={accounts}
        initial={{
          tipo: 'expense',
          importo: 42,
          categoriaId: 'cat-1',
          accountId: 'acc-1',
          descrizione: 'Vecchia spesa',
        }}
        submitLabel="Salva modifiche"
        onSubmit={onSubmit}
      />
    );

    expect(screen.getByLabelText('Importo')).toHaveValue(42);
    expect(screen.getByLabelText('Descrizione')).toHaveValue('Vecchia spesa');
    expect(screen.getByText('Salva modifiche')).toBeInTheDocument();
  });

  it('mostra un pulsante Annulla solo se viene passato onCancel, e lo chiama al click', () => {
    const onCancel = vi.fn();
    render(
      <AddTransactionForm
        categories={categories}
        accounts={accounts}
        onCancel={onCancel}
        onSubmit={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText('Annulla'));
    expect(onCancel).toHaveBeenCalled();
  });

  it('non mostra il pulsante Annulla se onCancel non è passato', () => {
    render(<AddTransactionForm categories={categories} accounts={accounts} onSubmit={vi.fn()} />);
    expect(screen.queryByText('Annulla')).not.toBeInTheDocument();
  });
});
