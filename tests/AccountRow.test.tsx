import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AccountRow } from '@/app/accounts/AccountRow';

const account = {
  id: '1',
  nome: 'Fondo emergenza',
  saldoAttuale: 1200,
  contaInDisponibile: false,
  targetSaldo: 3000,
};

describe('AccountRow', () => {
  it('mostra la barra di progresso quando c\'è un target', () => {
    render(<AccountRow account={account} onUpdateBalance={vi.fn()} />);
    expect(screen.getByText('1.200,00 € / 3.000,00 €')).toBeInTheDocument();
  });

  it('chiama onUpdateBalance con il nuovo saldo', () => {
    const onUpdateBalance = vi.fn();
    render(<AccountRow account={account} onUpdateBalance={onUpdateBalance} />);

    fireEvent.change(screen.getByLabelText('Aggiorna saldo'), { target: { value: '1500' } });
    fireEvent.click(screen.getByText('Aggiorna'));

    expect(onUpdateBalance).toHaveBeenCalledWith('1', 1500);
  });

  it('non mostra il pulsante di modifica dettagli se onUpdateDetails non è passato', () => {
    render(<AccountRow account={account} onUpdateBalance={vi.fn()} />);
    expect(screen.queryByLabelText('Modifica conto')).not.toBeInTheDocument();
  });

  it('precompila e salva nome, conta-nel-disponibile e target col pulsante di modifica', () => {
    const onUpdateDetails = vi.fn();
    render(
      <AccountRow account={account} onUpdateBalance={vi.fn()} onUpdateDetails={onUpdateDetails} />
    );

    fireEvent.click(screen.getByLabelText('Modifica conto'));

    expect(screen.getByLabelText('Nome conto')).toHaveValue('Fondo emergenza');
    fireEvent.change(screen.getByLabelText('Nome conto'), { target: { value: 'Fondo sicurezza' } });
    fireEvent.click(screen.getByLabelText('Conta nel disponibile libero'));
    fireEvent.change(screen.getByLabelText('Obiettivo di saldo (opzionale)'), {
      target: { value: '5000' },
    });
    fireEvent.click(screen.getByText('Salva modifiche'));

    expect(onUpdateDetails).toHaveBeenCalledWith('1', {
      nome: 'Fondo sicurezza',
      contaInDisponibile: true,
      targetSaldo: 5000,
    });
  });

  it('annulla la modifica senza chiamare onUpdateDetails', () => {
    const onUpdateDetails = vi.fn();
    render(
      <AccountRow account={account} onUpdateBalance={vi.fn()} onUpdateDetails={onUpdateDetails} />
    );

    fireEvent.click(screen.getByLabelText('Modifica conto'));
    fireEvent.change(screen.getByLabelText('Nome conto'), { target: { value: 'Qualcos\'altro' } });
    fireEvent.click(screen.getByText('Annulla'));

    expect(onUpdateDetails).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('Nome conto')).not.toBeInTheDocument();
  });
});
