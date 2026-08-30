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
});
