import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { AddTransactionSheet } from '@/app/add/AddTransactionSheet';
import { assertNessunaParolaVietata } from './helpers/paroleVietate';
import type { CasaAggiunta } from '@/lib/loadCasaData';
import { oggiRomaISO } from '@/lib/calculations/casa/oggi';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({}),
}));

vi.mock('@/lib/data/transactions', () => ({
  createTransaction: vi.fn(),
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

// Basta l'importo: tutto il resto ha un valore di partenza.
function compila(importo: string) {
  fireEvent.change(screen.getByLabelText('Importo'), { target: { value: importo } });
  fireEvent.click(screen.getByText('Salva'));
}

const pezzo = (nome: string | RegExp) => screen.getByRole('button', { name: nome });

function scegliEntrata() {
  fireEvent.click(pezzo('Spesa'));
  fireEvent.click(pezzo('Entrata'));
}

const storicoCasa = [{ descrizione: 'Luce', categoriaId: 'cc', data: oggiRomaISO(), tipo: 'expense' as const }];
const storicoPersonale = [{ descrizione: 'Pane', categoriaId: 'cp', data: oggiRomaISO(), tipo: 'expense' as const }];

const contiDue = {
  ...personale,
  accounts: [
    ...personale.accounts,
    { id: 'ap2', nome: 'Carta', saldoAttuale: 5, contaInDisponibile: true, targetSaldo: null },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(createTransaction).mockResolvedValue({ id: 't-nuova' } as never);
  window.localStorage.clear();
  window.sessionStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('AddTransactionSheet', () => {
  it('senza casa non offre lo spazio Casa', () => {
    apri({ casa: null });
    expect(screen.getByText('Personale')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Personale' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Casa' })).not.toBeInTheDocument();
    expect(pezzo('Conto mio')).toBeInTheDocument();
  });

  it('con casa offre Personale e Casa e parte da Personale senza memoria', () => {
    apri();
    fireEvent.click(pezzo('Personale'));
    expect(screen.getByRole('button', { name: 'Personale', pressed: true })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Casa', pressed: false })).toBeInTheDocument();
    expect(pezzo('Conto mio')).toBeInTheDocument();
  });

  it('ricorda l ultima scelta in localStorage', () => {
    const { unmount } = apri();
    fireEvent.click(pezzo('Personale'));
    fireEvent.click(screen.getByRole('button', { name: 'Casa' }));
    expect(window.localStorage.getItem('aggiungiModo')).toBe('casa');
    unmount();
    apri();
    expect(pezzo('Casa')).toBeInTheDocument();
    expect(pezzo('Conto comune')).toBeInTheDocument();
  });

  it('modoIniziale casa ignora la memoria', () => {
    window.localStorage.setItem('aggiungiModo', 'personale');
    apri({ modoIniziale: 'casa' });
    expect(pezzo('Casa')).toBeInTheDocument();
  });

  it('con localStorage che lancia lo spazio funziona comunque', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('negato');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('negato');
    });
    apri();
    expect(pezzo('Personale')).toBeInTheDocument();
    fireEvent.click(pezzo('Personale'));
    fireEvent.click(screen.getByRole('button', { name: 'Casa' }));
    expect(pezzo('Casa')).toBeInTheDocument();
  });

  it('in modalità Casa mostra categoria e conto di casa, "Chi ha pagato" e "Lo vedrà anche Anna"', () => {
    apri({ modoIniziale: 'casa', storico: storicoCasa });
    expect(pezzo('Bollette')).toBeInTheDocument();
    fireEvent.click(pezzo('Conto comune'));
    expect(screen.getByRole('group', { name: 'Chi ha pagato' })).toBeInTheDocument();
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
    apri({ modoIniziale: 'casa', storico: storicoCasa });
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
    scegliEntrata();
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

  it('salvare in Personale scala il conto con un delta, mai con un saldo assoluto', async () => {
    apri({ modoIniziale: 'personale' });
    compila('10');
    await waitFor(() => expect(adjustAccountBalance).toHaveBeenCalledWith(expect.anything(), 'ap', -10));
    expect(adjustAccountBalance).toHaveBeenCalledTimes(1);
    expect(updateAccountBalance).not.toHaveBeenCalled();
    expect(vi.mocked(createTransaction).mock.calls[0]).toHaveLength(2);
  });

  it('in Casa offre il conto comune e "Io, con <conto>"', () => {
    apri({ modoIniziale: 'casa', contiPersonali: personale.accounts });
    fireEvent.click(pezzo('Conto comune'));
    const scelta = within(screen.getByRole('group', { name: 'Chi ha pagato' }));
    expect(scelta.getByRole('button', { name: 'Conto comune' })).toBeInTheDocument();
    expect(scelta.getByRole('button', { name: 'Io, con Conto mio' })).toBeInTheDocument();
  });

  it('scegliere Io, con carta crea la spesa con pagataDaUserId e scala il conto personale con delta -30', async () => {
    apri({ modoIniziale: 'casa', contiPersonali: personale.accounts });
    fireEvent.click(pezzo('Conto comune'));
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

  it('una entrata personale aumenta il conto con delta positivo', async () => {
    apri({
      modoIniziale: 'personale',
      casa: null,
      personale: {
        ...personale,
        categories: [...personale.categories, { id: 'ci', nome: 'Stipendio', tipo: 'income', colore: null, archiviata: false }],
      },
    });
    scegliEntrata();
    compila('40');
    await waitFor(() => expect(adjustAccountBalance).toHaveBeenCalledWith(expect.anything(), 'ap', 40));
  });

  it('senza conto comune "Chi ha pagato" non sceglie da solo la prima carta personale', async () => {
    apri({ modoIniziale: 'casa', casa: { ...casa, conti: [] }, contiPersonali: personale.accounts });
    fireEvent.change(screen.getByLabelText('Importo'), { target: { value: '9' } });
    expect(screen.getByText('Salva')).toBeDisabled();
    fireEvent.click(pezzo('Scegli chi ha pagato'));
    expect(screen.getByText('Scegline uno per salvare')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Io, con Conto mio' }));
    expect(screen.getByText('Salva')).not.toBeDisabled();
    fireEvent.click(screen.getByText('Salva'));
    await waitFor(() => expect(adjustAccountBalance).toHaveBeenCalledWith(expect.anything(), 'ap', -9));
  });

  it('le entrate non offrono i conti personali', () => {
    apri({
      modoIniziale: 'casa',
      contiPersonali: personale.accounts,
      casa: { ...casa, categorie: [...casa.categorie, { id: 'ci', nome: 'Altre entrate', tipo: 'income', colore: null, archiviata: false }] },
    });
    scegliEntrata();
    fireEvent.click(pezzo('Conto comune'));
    const scelta = within(screen.getByRole('group', { name: 'Chi ha pagato' }));
    expect(scelta.queryByRole('button', { name: 'Io, con Conto mio' })).not.toBeInTheDocument();
    expect(scelta.getByRole('button', { name: 'Conto comune' })).toBeInTheDocument();
  });

  it('una spesa di casa con conto comune non imposta pagataDaUserId', async () => {
    apri({ modoIniziale: 'casa', contiPersonali: personale.accounts, storico: storicoCasa });
    compila('12');
    await waitFor(() => expect(adjustAccountBalance).toHaveBeenCalledWith(expect.anything(), 'ac', -12));
    expect(vi.mocked(createTransaction).mock.calls[0][1]).not.toHaveProperty('pagataDaUserId');
  });

  it('in Casa una bolletta preseleziona l obiettivo della sua categoria', async () => {
    const obiettivoBollette = {
      id: 'g-bol',
      nome: 'Bollette da parte',
      importoTarget: 200,
      modalita: 'bloccato' as const,
      scadenza: null,
      categoriaId: 'cc',
      ricorrente: false,
      frequenzaMesi: null,
      stato: 'aperto' as const,
      createdAt: '2026-01-01T00:00:00Z',
    };
    apri({ modoIniziale: 'casa', casa: { ...casa, obiettivi: [obiettivoBollette] }, storico: storicoCasa });
    compila('12.5');
    await waitFor(() => expect(createTransaction).toHaveBeenCalled());
    expect(vi.mocked(createTransaction).mock.calls[0][1]).toMatchObject({ categoriaId: 'cc', goalId: 'g-bol' });
  });

  it('in Personale non preseleziona obiettivi dalla categoria', async () => {
    apri({
      modoIniziale: 'personale',
      storico: storicoPersonale,
      personale: {
        ...personale,
        goals: [
          {
            id: 'g-pers',
            nome: 'Vacanza',
            importoTarget: 500,
            modalita: 'bloccato' as const,
            scadenza: null,
            categoriaId: 'cp',
            ricorrente: false,
            frequenzaMesi: null,
            stato: 'aperto' as const,
            createdAt: '2026-01-01T00:00:00Z',
            accantonato: 0,
          },
        ],
      },
    });
    compila('10');
    await waitFor(() => expect(createTransaction).toHaveBeenCalled());
    expect(vi.mocked(createTransaction).mock.calls[0][1]).toMatchObject({ goalId: null });
  });

  it('il fuoco parte sull importo', () => {
    apri({ modoIniziale: 'personale' });
    expect(screen.getByLabelText('Importo')).toHaveFocus();
    expect(screen.getByLabelText('Importo')).toHaveAttribute('inputmode', 'decimal');
  });

  it('si salva con il solo importo: descrizione vuota e categoria indovinata', async () => {
    apri({ modoIniziale: 'personale', storico: storicoPersonale });
    expect(screen.getByText('Salva')).toBeDisabled();
    compila('7');
    await waitFor(() => expect(createTransaction).toHaveBeenCalled());
    expect(vi.mocked(createTransaction).mock.calls[0][1]).toMatchObject({
      tipo: 'expense',
      importo: 7,
      descrizione: '',
      categoriaId: 'cp',
      accountId: 'ap',
      goalId: null,
    });
  });

  it('senza storico la categoria è "Senza categoria" e si salva senza', async () => {
    apri({ modoIniziale: 'personale' });
    expect(pezzo('Senza categoria')).toBeInTheDocument();
    compila('7');
    await waitFor(() => expect(createTransaction).toHaveBeenCalled());
    expect(vi.mocked(createTransaction).mock.calls[0][1]).toMatchObject({ categoriaId: null });
  });

  it('il riepilogo cambia toccando un pezzo e apre solo la scelta di quel pezzo', () => {
    apri({ modoIniziale: 'personale', personale: contiDue, casa: null });
    fireEvent.click(pezzo('Conto mio'));
    expect(screen.getByRole('group', { name: 'Conto' })).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Categoria' })).not.toBeInTheDocument();
    fireEvent.click(within(screen.getByRole('group', { name: 'Conto' })).getByRole('button', { name: 'Carta' }));
    expect(pezzo('Carta')).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Conto' })).not.toBeInTheDocument();
  });

  it('descrizione e obiettivo stanno dietro "Aggiungi una nota"', async () => {
    apri({ modoIniziale: 'personale' });
    expect(screen.queryByLabelText('Descrizione')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Aggiungi una nota'));
    fireEvent.change(screen.getByLabelText('Descrizione'), { target: { value: 'Pane' } });
    compila('3');
    await waitFor(() => expect(createTransaction).toHaveBeenCalled());
    expect(vi.mocked(createTransaction).mock.calls[0][1]).toMatchObject({ descrizione: 'Pane' });
  });

  it('la categoria segue la descrizione finché non la scegli a mano', () => {
    const conDue = {
      ...personale,
      categories: [
        ...personale.categories,
        { id: 'cp2', nome: 'Caffè', tipo: 'expense' as const, colore: null, archiviata: false },
      ],
    };
    const storico = [
      { descrizione: 'Pane', categoriaId: 'cp', data: oggiRomaISO(), tipo: 'expense' as const },
      { descrizione: 'Bar', categoriaId: 'cp2', data: oggiRomaISO(), tipo: 'expense' as const },
    ];
    apri({ modoIniziale: 'personale', personale: conDue, casa: null, storico });
    fireEvent.click(screen.getByText('Aggiungi una nota'));
    fireEvent.change(screen.getByLabelText('Descrizione'), { target: { value: 'Bar' } });
    expect(pezzo('Caffè')).toBeInTheDocument();
    fireEvent.click(pezzo('Caffè'));
    fireEvent.click(within(screen.getByRole('group', { name: 'Categoria' })).getByRole('button', { name: 'Personale cat' }));
    fireEvent.change(screen.getByLabelText('Descrizione'), { target: { value: 'Bar ' } });
    expect(pezzo('Personale cat')).toBeInTheDocument();
  });

  it('riaprendo il foglio il conto è l ultimo usato per quello spazio', async () => {
    const { unmount } = apri({ modoIniziale: 'personale', personale: contiDue, casa: null });
    fireEvent.click(pezzo('Conto mio'));
    fireEvent.click(within(screen.getByRole('group', { name: 'Conto' })).getByRole('button', { name: 'Carta' }));
    compila('4');
    await waitFor(() => expect(adjustAccountBalance).toHaveBeenCalledWith(expect.anything(), 'ap2', -4));
    expect(window.localStorage.getItem('aggiungi:conto:personale')).toBe('ap2');
    unmount();
    apri({ modoIniziale: 'personale', personale: contiDue, casa: null });
    expect(pezzo('Carta')).toBeInTheDocument();
  });

  it('se l ultimo conto usato non esiste più, nessun conto: Contanti', async () => {
    window.localStorage.setItem('aggiungi:conto:personale', 'sparito');
    apri({ modoIniziale: 'personale', casa: null });
    expect(pezzo('Contanti')).toBeInTheDocument();
    compila('4');
    await waitFor(() => expect(createTransaction).toHaveBeenCalled());
    expect(vi.mocked(createTransaction).mock.calls[0][1]).toMatchObject({ accountId: null });
    expect(adjustAccountBalance).not.toHaveBeenCalled();
  });

  it('dopo il salvataggio scrive l id in sessionStorage, chiama onSaved(id) e chiude', async () => {
    const onSaved = vi.fn();
    const onClose = vi.fn();
    apri({ modoIniziale: 'personale', onSaved, onClose });
    compila('8');
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith('t-nuova'));
    expect(window.sessionStorage.getItem('libretto:registrato')).toBe('t-nuova');
    expect(onClose).toHaveBeenCalled();
    expect(screen.queryByText('Salvata ✓')).not.toBeInTheDocument();
  });

  it('con sessionStorage che lancia salva e chiude comunque', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('negato');
    });
    const onSaved = vi.fn();
    const onClose = vi.fn();
    apri({ modoIniziale: 'personale', onSaved, onClose });
    compila('8');
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith('t-nuova'));
    expect(onClose).toHaveBeenCalled();
  });

  it('dopo un errore i campi restano e compare il messaggio', async () => {
    vi.mocked(createTransaction).mockRejectedValue(new Error('rete'));
    const onSaved = vi.fn();
    apri({ modoIniziale: 'personale', onSaved });
    fireEvent.click(screen.getByText('Aggiungi una nota'));
    fireEvent.change(screen.getByLabelText('Descrizione'), { target: { value: 'Pane' } });
    compila('8');
    await screen.findByText(/Salvataggio fallito/);
    expect(screen.getByLabelText('Importo')).toHaveValue(8);
    expect(screen.getByLabelText('Descrizione')).toHaveValue('Pane');
    expect(onSaved).not.toHaveBeenCalled();
    expect(window.sessionStorage.getItem('libretto:registrato')).toBeNull();
    expect(screen.getByText('Salva')).not.toBeDisabled();
  });

  it('se il saldo non si aggiorna, riprovare non crea un doppione e finisce il salvataggio', async () => {
    vi.mocked(adjustAccountBalance).mockRejectedValueOnce(new Error('rete'));
    const onSaved = vi.fn();
    const onClose = vi.fn();
    apri({ modoIniziale: 'personale', onSaved, onClose });
    compila('8');
    await screen.findByText(/il saldo del conto non si è aggiornato/);
    expect(onSaved).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Importo')).toHaveAttribute('readonly');
    expect(pezzo('Conto mio')).toBeDisabled();
    fireEvent.click(screen.getByText('Salva'));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith('t-nuova'));
    expect(createTransaction).toHaveBeenCalledTimes(1);
    expect(adjustAccountBalance).toHaveBeenCalledTimes(2);
    expect(adjustAccountBalance).toHaveBeenLastCalledWith(expect.anything(), 'ap', -8);
    expect(window.sessionStorage.getItem('libretto:registrato')).toBe('t-nuova');
    expect(onClose).toHaveBeenCalled();
  });

  it('cambiando spazio l importo scritto resta', () => {
    apri({ modoIniziale: 'personale' });
    fireEvent.change(screen.getByLabelText('Importo'), { target: { value: '15' } });
    fireEvent.click(pezzo('Personale'));
    fireEvent.click(screen.getByRole('button', { name: 'Casa' }));
    expect(screen.getByLabelText('Importo')).toHaveValue(15);
  });

  it('nessuna parola vietata', () => {
    const { container } = apri({ modoIniziale: 'casa' });
    assertNessunaParolaVietata(container);
  });
});
