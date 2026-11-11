import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MovimentiCasa } from '@/app/casa/movimenti/MovimentiCasa';
import { assertNessunaParolaVietata } from './helpers/paroleVietate';
import type { CasaCorrente } from '@/lib/data/households';
import type { CasaAggiunta } from '@/lib/loadCasaData';
import type { Transaction, Transfer } from '@/lib/types';

const refresh = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh, push: vi.fn() }),
}));
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }));
vi.mock('@/lib/data/transactions', () => ({
  deleteTransaction: vi.fn().mockResolvedValue(undefined),
  updateTransaction: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/lib/data/transfers', () => ({ deleteTransfer: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/data/accounts', () => ({ adjustAccountBalance: vi.fn().mockResolvedValue(undefined) }));

import { deleteTransaction, updateTransaction } from '@/lib/data/transactions';
import { adjustAccountBalance } from '@/lib/data/accounts';
import { deleteTransfer } from '@/lib/data/transfers';

const fabio = { householdId: 'h1', userId: 'u1', displayName: 'Fabio', joinedAt: '2026-01-01', slot: 1, attivo: true };
const anna = { householdId: 'h1', userId: 'u2', displayName: 'Anna', joinedAt: '2026-01-02', slot: 2, attivo: true };
const casa: CasaCorrente = {
  household: { id: 'h1', nome: 'Casa Rossi', createdAt: '2026-01-01', archiviataIl: null, createdBy: 'u1' },
  members: [fabio, anna],
  invite: null,
  me: fabio,
};
const aggiunta: CasaAggiunta = {
  householdId: 'h1',
  meUserId: 'u1',
  nomi: [
    { userId: 'u1', nome: 'Fabio' },
    { userId: 'u2', nome: 'Anna' },
  ],
  conti: [{ id: 'ac', nome: 'Conto comune', saldoAttuale: 500, contaInDisponibile: true, targetSaldo: null }],
  categorie: [{ id: 'cc', nome: 'Bollette', tipo: 'expense', colore: null, archiviata: false }],
  obiettivi: [],
};

function tx(over: Partial<Transaction>): Transaction {
  return {
    id: 't', tipo: 'expense', importo: 10, data: '2026-11-05', categoriaId: 'cc', accountId: 'ac',
    goalId: null, descrizione: 'Voce', nota: null, createdAt: '', stima: false, userId: 'u1', ...over,
  };
}

const lista = [
  tx({ id: 'luce', descrizione: 'Luce', importo: 64.2, data: '2026-11-05' }),
  tx({ id: 'gas', descrizione: 'Gas ottobre', importo: 30, data: '2026-10-20' }),
  tx({ id: 'altrui', descrizione: 'Spesa di Anna', importo: 12, data: '2026-11-03', pagataDaUserId: 'u2' }),
];

function trasf(over: Partial<Transfer>): Transfer {
  return {
    id: 'v1', householdId: 'h1', userId: 'u1', daAccountId: null, aAccountId: 'ac', importo: 250,
    data: '2026-11-04', causale: 'versamento', beneficiarioUserId: null, perContoDiUserId: null,
    meseCompetenza: '2026-11-01', soloRegistrazione: false, nota: null, createdAt: '', ...over,
  };
}

function apri(trasferimenti: Transfer[] = [], transazioni: Transaction[] = lista) {
  return render(
    <MovimentiCasa casa={casa} aggiunta={aggiunta} transazioni={transazioni} trasferimenti={trasferimenti} meUserId="u1" />
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-09T10:00:00Z'));
});
afterEach(() => vi.useRealTimers());

describe('MovimentiCasa', () => {
  it('filtra per mese', () => {
    apri();
    expect(screen.getByText('Luce')).toBeInTheDocument();
    expect(screen.queryByText('Gas ottobre')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Mese'), { target: { value: '2026-10' } });
    expect(screen.getByText('Gas ottobre')).toBeInTheDocument();
    expect(screen.queryByText('Luce')).not.toBeInTheDocument();
  });

  it('mostra importo con segno, categoria e chi ha pagato', () => {
    apri();
    expect(screen.getByText('-64,20 €')).toBeInTheDocument();
    expect(screen.getAllByText(/Bollette/).length).toBeGreaterThan(0);
    expect(screen.getByText('Anna')).toBeInTheDocument();
  });

  it('Elimina rimuove subito la riga e chiama adjustAccountBalance con +64.2', async () => {
    apri();
    const riga = screen.getByText('Luce').closest('li') as HTMLElement;
    fireEvent.click(riga.querySelector('button:last-of-type') as HTMLElement);
    expect(screen.queryByText('Luce')).not.toBeInTheDocument();
    await waitFor(() => expect(adjustAccountBalance).toHaveBeenCalledWith(expect.anything(), 'ac', 64.2));
    expect(deleteTransaction).toHaveBeenCalledWith(expect.anything(), 'luce');
  });

  it('modificare applica la differenza sul conto', async () => {
    apri();
    fireEvent.click(screen.getAllByText('Modifica')[0]);
    fireEvent.change(screen.getByLabelText('Importo'), { target: { value: '70' } });
    fireEvent.click(screen.getByText('Salva modifiche'));
    await waitFor(() => expect(adjustAccountBalance).toHaveBeenCalledWith(expect.anything(), 'ac', -5.8));
    expect(updateTransaction).toHaveBeenCalledWith(
      expect.anything(),
      'luce',
      expect.objectContaining({ importo: 70, data: '2026-11-05' })
    );
    expect(screen.getByText('-70,00 €')).toBeInTheDocument();
  });

  it('non mostra Elimina né Modifica per una spesa pagata da un altro', () => {
    apri();
    const riga = screen.getByText('Spesa di Anna').closest('li') as HTMLElement;
    expect(riga.querySelector('button')).toBeNull();
    expect(screen.getAllByText('Elimina')).toHaveLength(1);
  });

  it('se la scrittura fallisce mostra il messaggio standard e rimette la riga', async () => {
    vi.mocked(deleteTransaction).mockRejectedValueOnce(new Error('rete'));
    apri();
    fireEvent.click(screen.getAllByText('Elimina')[0]);
    expect(await screen.findByText('Salvataggio fallito, controlla la connessione e riprova.')).toBeInTheDocument();
    expect(screen.getByText('Luce')).toBeInTheDocument();
    expect(adjustAccountBalance).not.toHaveBeenCalled();
  });

  it('mostra un versamento in stile neutro e senza importo nei totali', () => {
    apri([trasf({})]);
    expect(screen.getByText('Versamento di Fabio')).toBeInTheDocument();
    const riga = screen.getByText('Versamento di Fabio').closest('li') as HTMLElement;
    expect(riga.textContent).toContain('novembre');
    expect(riga.textContent).not.toMatch(/[+-]\s?250/);
    expect(riga.querySelector('.text-danger, .text-success')).toBeNull();
  });

  it('Annulla compare solo per l autore e chiama deleteTransfer', async () => {
    apri([trasf({}), trasf({ id: 'v2', userId: 'u2', importo: 90 })]);
    expect(screen.getAllByText('Annulla')).toHaveLength(1);
    fireEvent.click(screen.getByText('Annulla'));
    expect(screen.queryByText('Versamento di Fabio')).not.toBeInTheDocument();
    await waitFor(() => expect(deleteTransfer).toHaveBeenCalledWith(expect.anything(), 'v1'));
  });

  it('se Annulla fallisce mostra il messaggio standard e rimette il movimento', async () => {
    vi.mocked(deleteTransfer).mockRejectedValueOnce(new Error('rete'));
    apri([trasf({})]);
    fireEvent.click(screen.getByText('Annulla'));
    expect(await screen.findByText('Salvataggio fallito, controlla la connessione e riprova.')).toBeInTheDocument();
    expect(screen.getByText('Versamento di Fabio')).toBeInTheDocument();
  });

  it('una spesa pagata da Fabio con la sua carta mostra "Fabio" come chi ha pagato', () => {
    apri([], [tx({ id: 'carta', descrizione: 'Spesa carta', accountId: 'ap', pagataDaUserId: 'u1' })]);
    const riga = screen.getByText('Spesa carta').closest('li') as HTMLElement;
    expect(riga.textContent).toContain('Fabio');
    expect(screen.getByText('Elimina')).toBeInTheDocument();
    expect(screen.queryByText('Modifica')).not.toBeInTheDocument();
  });

  it('se la spesa è salvata ma il saldo fallisce la riga resta nuova, si ricarica e compare l errore', async () => {
    vi.mocked(adjustAccountBalance).mockRejectedValueOnce(new Error('rete'));
    apri();
    fireEvent.click(screen.getAllByText('Modifica')[0]);
    fireEvent.change(screen.getByLabelText('Importo'), { target: { value: '70' } });
    fireEvent.click(screen.getByText('Salva modifiche'));
    expect(await screen.findByText('Salvataggio fallito, controlla la connessione e riprova.')).toBeInTheDocument();
    expect(updateTransaction).toHaveBeenCalledTimes(1);
    expect(screen.getByText('-70,00 €')).toBeInTheDocument();
    expect(screen.queryByText('-64,20 €')).not.toBeInTheDocument();
    expect(refresh).toHaveBeenCalled();
  });

  it('se è la spesa a non salvarsi la riga torna quella vecchia', async () => {
    vi.mocked(updateTransaction).mockRejectedValueOnce(new Error('rete'));
    apri();
    fireEvent.click(screen.getAllByText('Modifica')[0]);
    fireEvent.change(screen.getByLabelText('Importo'), { target: { value: '70' } });
    fireEvent.click(screen.getByText('Salva modifiche'));
    expect(await screen.findByText('Salvataggio fallito, controlla la connessione e riprova.')).toBeInTheDocument();
    expect(screen.getByText('-64,20 €')).toBeInTheDocument();
    expect(adjustAccountBalance).not.toHaveBeenCalled();
  });

  describe('conferma prima di lasciare qualcuno senza soldi', () => {
    const cartaRimborsata = tx({ id: 'carta', descrizione: 'Spesa carta', importo: 100, accountId: 'ap', pagataDaUserId: 'u1' });
    const rimborso = trasf({ id: 'rb', causale: 'rimborso', userId: 'u2', beneficiarioUserId: 'u1', importo: 100, aAccountId: null });

    it('eliminare una spesa già rimborsata chiede conferma e spiega chi resta senza', async () => {
      apri([rimborso], [cartaRimborsata]);
      fireEvent.click(screen.getByText('Elimina'));
      expect(screen.getByText(/già stata rimborsata a Fabio/)).toBeInTheDocument();
      expect(screen.getByText(/la casa resta senza 100,00 €/)).toBeInTheDocument();
      expect(deleteTransaction).not.toHaveBeenCalled();
      assertNessunaParolaVietata(screen.getByLabelText('Conferma'));
      fireEvent.click(screen.getByText('Procedi lo stesso'));
      await waitFor(() => expect(deleteTransaction).toHaveBeenCalledWith(expect.anything(), 'carta'));
      expect(screen.queryByLabelText('Conferma')).not.toBeInTheDocument();
    });

    it('Lascia com è non cancella niente', () => {
      apri([rimborso], [cartaRimborsata]);
      fireEvent.click(screen.getByText('Elimina'));
      fireEvent.click(screen.getByText("Lascia com'è"));
      expect(screen.queryByLabelText('Conferma')).not.toBeInTheDocument();
      expect(screen.getByText('Spesa carta')).toBeInTheDocument();
      expect(deleteTransaction).not.toHaveBeenCalled();
    });

    it('una spesa non rimborsata si elimina subito, senza conferma', async () => {
      apri([], [cartaRimborsata]);
      fireEvent.click(screen.getByText('Elimina'));
      expect(screen.queryByLabelText('Conferma')).not.toBeInTheDocument();
      await waitFor(() => expect(deleteTransaction).toHaveBeenCalled());
    });

    it('annullare un versamento per conto di un altro già restituito chiede conferma', async () => {
      const prestito = trasf({ id: 'pc', perContoDiUserId: 'u2', importo: 200, aAccountId: null });
      const resto = trasf({ id: 'rs', causale: 'restituzione', userId: 'u2', beneficiarioUserId: 'u1', importo: 200, meseCompetenza: null, aAccountId: null });
      apri([prestito, resto], []);
      fireEvent.click(screen.getAllByText('Annulla')[0]);
      expect(screen.getByText(/Anna ha già restituito dei soldi a Fabio/)).toBeInTheDocument();
      expect(deleteTransfer).not.toHaveBeenCalled();
      fireEvent.click(screen.getByText('Procedi lo stesso'));
      await waitFor(() => expect(deleteTransfer).toHaveBeenCalledWith(expect.anything(), 'pc'));
    });
  });

  it('mese senza movimenti: una frase neutra, senza conteggi né colpe', () => {
    const { container } = apri([], []);
    expect(screen.getByText('Nessun movimento in questo mese.')).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    assertNessunaParolaVietata(container);
  });

  it('nessuna parola vietata', () => {
    const { container } = apri();
    assertNessunaParolaVietata(container);
  });
});
