import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AddTransactionSheet } from '@/app/add/AddTransactionSheet';
import { assertNessunaParolaVietata } from './helpers/paroleVietate';
import type { CasaAggiunta } from '@/lib/loadCasaData';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({}),
}));

vi.mock('@/lib/data/transactions', () => ({
  createTransaction: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/data/accounts', () => ({
  updateAccountBalance: vi.fn().mockResolvedValue(undefined),
  adjustAccountBalance: vi.fn().mockResolvedValue(undefined),
}));

import { createTransaction } from '@/lib/data/transactions';
import { adjustAccountBalance, updateAccountBalance } from '@/lib/data/accounts';

const personale = {
  categories: [{ id: 'cp', nome: 'Personale cat', tipo: 'expense' as const, colore: null, archiviata: false }],
  accounts: [
    { id: 'ap', nome: 'Conto mio', saldoAttuale: 100, contaInDisponibile: true, targetSaldo: null },
  ],
  goals: [],
};

const casa: CasaAggiunta = {
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

function apri(props: Partial<React.ComponentProps<typeof AddTransactionSheet>> = {}) {
  return render(
    <AddTransactionSheet
      aperto
      onClose={vi.fn()}
      personale={personale}
      casa={casa}
      meUserId="u1"
      onSaved={vi.fn()}
      {...props}
    />
  );
}

function compila(importo: string) {
  fireEvent.change(screen.getByLabelText('Importo'), { target: { value: importo } });
  fireEvent.change(screen.getByLabelText('Descrizione'), { target: { value: 'Prova' } });
  fireEvent.click(screen.getByText('Salva'));
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('AddTransactionSheet', () => {
  it('senza casa non mostra il selettore', () => {
    apri({ casa: null });
    expect(screen.queryByRole('button', { name: 'Casa' })).not.toBeInTheDocument();
    expect(screen.getByText('Conto mio')).toBeInTheDocument();
  });

  it('con casa mostra Personale e Casa e parte da Personale senza memoria', () => {
    apri();
    expect(screen.getByRole('button', { name: 'Personale' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Casa' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('Conto mio')).toBeInTheDocument();
  });

  it('ricorda l ultima scelta in localStorage', () => {
    const { unmount } = apri();
    fireEvent.click(screen.getByRole('button', { name: 'Casa' }));
    expect(window.localStorage.getItem('aggiungiModo')).toBe('casa');
    unmount();
    apri();
    expect(screen.getByRole('button', { name: 'Casa' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('modoIniziale casa ignora la memoria', () => {
    window.localStorage.setItem('aggiungiModo', 'personale');
    apri({ modoIniziale: 'casa' });
    expect(screen.getByRole('button', { name: 'Casa' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('con localStorage che lancia il selettore funziona comunque', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('negato');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('negato');
    });
    apri();
    expect(screen.getByRole('button', { name: 'Personale' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Casa' }));
    expect(screen.getByRole('button', { name: 'Casa' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('in modalità Casa mostra categorie e conti di casa, "Chi ha pagato" e "Lo vedrà anche Anna"', () => {
    apri({ modoIniziale: 'casa' });
    expect(screen.getByText('Bollette')).toBeInTheDocument();
    expect(screen.getByText('Conto comune')).toBeInTheDocument();
    expect(screen.getByText('Chi ha pagato')).toBeInTheDocument();
    expect(screen.getByText('Lo vedrà anche Anna')).toBeInTheDocument();
    expect(screen.queryByText('Conto mio')).not.toBeInTheDocument();
    expect(screen.queryByText('Gestisci categorie')).not.toBeInTheDocument();
  });

  it('con più persone usa il plurale', () => {
    apri({
      modoIniziale: 'casa',
      casa: { ...casa, nomi: [...casa.nomi, { userId: 'u3', nome: 'Marco' }] },
    });
    expect(screen.getByText('Lo vedranno anche Anna e Marco')).toBeInTheDocument();
  });

  it('salvare in Casa crea la transazione con scope casa e chiama adjustAccountBalance con -12.5', async () => {
    apri({ modoIniziale: 'casa' });
    compila('12.5');
    await waitFor(() => expect(adjustAccountBalance).toHaveBeenCalledWith(expect.anything(), 'ac', -12.5));
    expect(createTransaction).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ tipo: 'expense', importo: 12.5, accountId: 'ac', categoriaId: 'cc' }),
      { kind: 'casa', householdId: 'h1' }
    );
    expect(updateAccountBalance).not.toHaveBeenCalled();
  });

  it('una entrata di casa aumenta il conto', async () => {
    apri({ modoIniziale: 'casa', casa: { ...casa, categorie: [...casa.categorie, { id: 'ci', nome: 'Altre entrate', tipo: 'income', colore: null, archiviata: false }] } });
    fireEvent.click(screen.getByText('Entrata'));
    compila('40');
    await waitFor(() => expect(adjustAccountBalance).toHaveBeenCalledWith(expect.anything(), 'ac', 40));
  });

  it('una spesa di casa registrata alle 23:30 UTC del 31 ottobre ha data 2026-11-01', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-31T23:30:00Z'));
    apri({ modoIniziale: 'casa' });
    compila('5');
    await waitFor(() => expect(createTransaction).toHaveBeenCalled());
    expect(vi.mocked(createTransaction).mock.calls[0][1]).toMatchObject({ data: '2026-11-01' });
  });

  it('salvare in Personale non chiama adjustAccountBalance', async () => {
    apri({ modoIniziale: 'personale' });
    compila('10');
    await waitFor(() => expect(updateAccountBalance).toHaveBeenCalledWith(expect.anything(), 'ap', 90));
    expect(adjustAccountBalance).not.toHaveBeenCalled();
    expect(vi.mocked(createTransaction).mock.calls[0]).toHaveLength(2);
  });

  it('in Casa offre il conto comune e "Io, con <conto>"', () => {
    apri({ modoIniziale: 'casa', contiPersonali: personale.accounts });
    expect(screen.getByRole('button', { name: 'Conto comune' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Io, con Conto mio' })).toBeInTheDocument();
  });

  it('scegliere Io, con carta crea la spesa con pagataDaUserId e scala il conto personale con delta -30', async () => {
    apri({ modoIniziale: 'casa', contiPersonali: personale.accounts });
    fireEvent.click(screen.getByRole('button', { name: 'Io, con Conto mio' }));
    compila('30');
    await waitFor(() => expect(adjustAccountBalance).toHaveBeenCalledWith(expect.anything(), 'ap', -30));
    expect(createTransaction).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ accountId: 'ap', importo: 30, pagataDaUserId: 'u1' }),
      { kind: 'casa', householdId: 'h1' }
    );
    expect(adjustAccountBalance).toHaveBeenCalledTimes(1);
    expect(updateAccountBalance).not.toHaveBeenCalled();
  });

  it('le entrate non offrono i conti personali', () => {
    apri({
      modoIniziale: 'casa',
      contiPersonali: personale.accounts,
      casa: { ...casa, categorie: [...casa.categorie, { id: 'ci', nome: 'Altre entrate', tipo: 'income', colore: null, archiviata: false }] },
    });
    fireEvent.click(screen.getByText('Entrata'));
    expect(screen.queryByRole('button', { name: 'Io, con Conto mio' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Conto comune' })).toBeInTheDocument();
  });

  it('una spesa di casa con conto comune non imposta pagataDaUserId', async () => {
    apri({ modoIniziale: 'casa', contiPersonali: personale.accounts });
    compila('12');
    await waitFor(() => expect(adjustAccountBalance).toHaveBeenCalledWith(expect.anything(), 'ac', -12));
    expect(vi.mocked(createTransaction).mock.calls[0][1]).not.toHaveProperty('pagataDaUserId');
  });

  it('nessuna parola vietata', () => {
    const { container } = apri({ modoIniziale: 'casa' });
    assertNessunaParolaVietata(container);
  });
});
