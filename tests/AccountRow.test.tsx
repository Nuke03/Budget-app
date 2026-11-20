import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AccountRow } from '@/app/accounts/AccountRow';
import type { SituazioneRientroConto } from '@/lib/calculations/rientri';

const account = {
  id: '1',
  nome: 'Fondo emergenza',
  saldoAttuale: 1200,
  contaInDisponibile: false,
  targetSaldo: 3000,
  archiviato: false,
};

describe('AccountRow', () => {
  it('mostra la barra di progresso quando c\'è un target', () => {
    render(<AccountRow account={account} onUpdateBalance={vi.fn()} />);
    expect(screen.getByText('1.200,00 € / 3.000,00 €')).toBeInTheDocument();
  });

  it('chiama onUpdateBalance con il nuovo saldo', () => {
    const onUpdateBalance = vi.fn();
    render(<AccountRow account={account} onUpdateBalance={onUpdateBalance} />);

    fireEvent.click(screen.getByText('Aggiorna il saldo'));
    fireEvent.change(screen.getByLabelText('Nuovo saldo'), { target: { value: '1500' } });
    fireEvent.click(screen.getByText('Salva'));

    expect(onUpdateBalance).toHaveBeenCalledWith('1', 1500);
  });

  it('il campo del saldo compare solo dopo il tocco e parte dal numero formattato', () => {
    render(<AccountRow account={{ ...account, saldoAttuale: 1890.5 }} onUpdateBalance={vi.fn()} />);
    expect(screen.queryByLabelText('Nuovo saldo')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Aggiorna il saldo'));
    expect(screen.getByLabelText('Nuovo saldo')).toHaveValue('1.890,5');
  });

  it('salva "1.890,50" come 1890.5 e non salva testo che non è un numero', () => {
    const onUpdateBalance = vi.fn();
    render(<AccountRow account={account} onUpdateBalance={onUpdateBalance} />);
    fireEvent.click(screen.getByText('Aggiorna il saldo'));
    fireEvent.change(screen.getByLabelText('Nuovo saldo'), { target: { value: 'abc' } });
    expect(screen.getByText('Salva')).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Nuovo saldo'), { target: { value: '1.890,50' } });
    fireEvent.click(screen.getByText('Salva'));
    expect(onUpdateBalance).toHaveBeenCalledWith('1', 1890.5);
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
    fireEvent.change(screen.getByLabelText('Saldo da raggiungere (opzionale)'), {
      target: { value: '5000' },
    });
    fireEvent.click(screen.getByText('Salva modifiche'));

    expect(onUpdateDetails).toHaveBeenCalledWith('1', {
      nome: 'Fondo sicurezza',
      contaInDisponibile: true,
      targetSaldo: 5000,
    });
  });

  it('il conto tasse non ha l interruttore: dice che resta fuori dal disponibile e salva sempre "fuori"', () => {
    const onUpdateDetails = vi.fn();
    render(
      <AccountRow
        account={{ ...account, contaInDisponibile: true }}
        contoTasse
        onUpdateBalance={vi.fn()}
        onUpdateDetails={onUpdateDetails}
      />
    );
    fireEvent.click(screen.getByLabelText('Modifica conto'));
    expect(screen.queryByLabelText('Conta nel disponibile libero')).not.toBeInTheDocument();
    expect(screen.getByText('È il conto tasse: resta fuori dal disponibile.')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Salva modifiche'));
    expect(onUpdateDetails).toHaveBeenCalledWith('1', { nome: 'Fondo emergenza', contaInDisponibile: false, targetSaldo: 3000 });
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

describe('AccountRow: rientri', () => {
  const situazione = (over = {}): SituazioneRientroConto => ({
    rientro: {
      id: 'r1', userId: 'u', householdId: null, goalId: null, accountId: '1', importo: 300, mesi: 3,
      creatoIl: '2026-11-01', stato: 'aperto', fermatoIl: null,
    },
    maturato: 200, spostato: 0, daSpostare: 200, finito: false, ...over,
  });

  it('mostra la riga, il da spostare, Ferma e Lascia stare', async () => {
    const onFermaRientro = vi.fn().mockResolvedValue(undefined);
    const onLasciaStare = vi.fn().mockResolvedValue(undefined);
    render(
      <AccountRow account={account} rientri={[situazione()]} onFermaRientro={onFermaRientro} onLasciaStare={onLasciaStare} onUpdateBalance={vi.fn()} />
    );
    expect(screen.getByText('Rientro: 100 € al mese fino a gennaio')).toBeInTheDocument();
    expect(screen.getByText('Da spostare: 200 €')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ferma' }));
    expect(onFermaRientro).toHaveBeenCalledWith('r1');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Lascia stare' })).not.toBeDisabled());
    fireEvent.click(screen.getByRole('button', { name: 'Lascia stare' }));
    expect(onLasciaStare).toHaveBeenCalledWith('r1');
  });

  it('un rientro chiuso o finito non si vede', () => {
    const chiuso = situazione();
    chiuso.rientro.stato = 'chiuso';
    render(<AccountRow account={account} rientri={[chiuso, situazione({ finito: true })]} onUpdateBalance={vi.fn()} />);
    expect(screen.queryByText(/Rientro/)).toBeNull();
  });
});
