import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MovimentiCasa } from '@/app/casa/movimenti/MovimentiCasa';
import { assertNessunaParolaVietata } from './helpers/paroleVietate';
import type { CasaCorrente } from '@/lib/data/households';
import type { CasaAggiunta } from '@/lib/loadCasaData';
import type { Transaction } from '@/lib/types';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }));
vi.mock('@/lib/data/transactions', () => ({
  deleteTransaction: vi.fn().mockResolvedValue(undefined),
  updateTransaction: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/lib/data/accounts', () => ({ adjustAccountBalance: vi.fn().mockResolvedValue(undefined) }));

import { deleteTransaction, updateTransaction } from '@/lib/data/transactions';
import { adjustAccountBalance } from '@/lib/data/accounts';

const fabio = { householdId: 'h1', userId: 'u1', displayName: 'Fabio', joinedAt: '2026-01-01', slot: 1, attivo: true };
const anna = { householdId: 'h1', userId: 'u2', displayName: 'Anna', joinedAt: '2026-01-02', slot: 2, attivo: true };
const casa: CasaCorrente = {
  household: { id: 'h1', nome: 'Casa Rossi', createdAt: '2026-01-01', archiviataIl: null },
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
    goalId: null, descrizione: 'Voce', nota: null, createdAt: '', userId: 'u1', ...over,
  };
}

const lista = [
  tx({ id: 'luce', descrizione: 'Luce', importo: 64.2, data: '2026-11-05' }),
  tx({ id: 'gas', descrizione: 'Gas ottobre', importo: 30, data: '2026-10-20' }),
  tx({ id: 'altrui', descrizione: 'Spesa di Anna', importo: 12, data: '2026-11-03', pagataDaUserId: 'u2' }),
];

function apri() {
  return render(<MovimentiCasa casa={casa} aggiunta={aggiunta} transazioni={lista} meUserId="u1" />);
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

  it('nessuna parola vietata', () => {
    const { container } = apri();
    assertNessunaParolaVietata(container);
  });
});
