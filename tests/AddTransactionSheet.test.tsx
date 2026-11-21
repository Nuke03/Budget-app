import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { AddTransactionSheet } from '@/app/add/AddTransactionSheet';
import { assertNessunaParolaVietata } from './helpers/paroleVietate';
import type { CasaAggiunta } from '@/lib/loadCasaData';
import { oggiRomaISO } from '@/lib/calculations/casa/oggi';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ rpc }),
}));

const valutaDopoSalvataggio = vi.hoisted(() => vi.fn());
const rispondiAvviso = vi.hoisted(() => vi.fn());
vi.mock('@/app/impara/dopoSalvataggio', () => ({
  valutaDopoSalvataggio: (...a: unknown[]) => valutaDopoSalvataggio(...a),
  rispondiAvviso: (...a: unknown[]) => rispondiAvviso(...a),
}));

const creaRientro = vi.hoisted(() => vi.fn());
vi.mock('@/lib/data/rientri', () => ({
  creaRientro: (...a: unknown[]) => creaRientro(...a),
}));

// Tutti i salvataggi passano da una sola rpc: movimento e saldo insieme.
const parametri = (n = 0) => rpc.mock.calls[n][1] as Record<string, unknown>;

const personale = {
  categories: [{ id: 'cp', nome: 'Personale cat', tipo: 'expense' as const, colore: null, archiviata: false, ruolo: null }],
  accounts: [
    { id: 'ap', nome: 'Conto mio', saldoAttuale: 100, contaInDisponibile: true, targetSaldo: null, archiviato: false },
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
  conti: [{ id: 'ac', nome: 'Conto comune', saldoAttuale: 500, contaInDisponibile: true, targetSaldo: null, archiviato: false }],
  categorie: [{ id: 'cc', nome: 'Bollette', tipo: 'expense', colore: null, archiviata: false, ruolo: null }],
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
    { id: 'ap2', nome: 'Carta', saldoAttuale: 5, contaInDisponibile: true, targetSaldo: null, archiviato: false },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  rpc.mockResolvedValue({ data: 't-nuova', error: null });
  valutaDopoSalvataggio.mockResolvedValue(null);
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

  it('salvare in Casa chiama crea_movimento con la casa e il conto comune', async () => {
    apri({ modoIniziale: 'casa', storico: storicoCasa });
    compila('12.5');
    await waitFor(() => expect(rpc).toHaveBeenCalledTimes(1));
    expect(rpc).toHaveBeenCalledWith(
      'crea_movimento',
      expect.objectContaining({ p_tipo: 'expense', p_importo: 12.5, p_account: 'ac', p_categoria: 'cc', p_household: 'h1' })
    );
  });

  it('una entrata di casa aumenta il conto', async () => {
    apri({ modoIniziale: 'casa', casa: { ...casa, categorie: [...casa.categorie, { id: 'ci', nome: 'Altre entrate', tipo: 'income', colore: null, archiviata: false, ruolo: null }] } });
    scegliEntrata();
    compila('40');
    await waitFor(() => expect(rpc).toHaveBeenCalledTimes(1));
    expect(parametri()).toMatchObject({ p_tipo: 'income', p_importo: 40, p_account: 'ac' });
  });

  it('una spesa di casa registrata alle 23:30 UTC del 31 ottobre ha data 2026-11-01', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-31T23:30:00Z'));
    apri({ modoIniziale: 'casa' });
    compila('5');
    await waitFor(() => expect(rpc).toHaveBeenCalled());
    expect(parametri()).toMatchObject({ p_data: '2026-11-01' });
  });

  it('salvare in Personale scala il conto con un delta, mai con un saldo assoluto', async () => {
    apri({ modoIniziale: 'personale' });
    compila('10');
    await waitFor(() => expect(rpc).toHaveBeenCalledTimes(1));
    expect(rpc.mock.calls[0][0]).toBe('crea_movimento');
    expect(parametri()).toMatchObject({ p_tipo: 'expense', p_importo: 10, p_account: 'ap', p_household: null });
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
    await waitFor(() => expect(rpc).toHaveBeenCalledTimes(1));
    expect(parametri()).toMatchObject({ p_account: 'ap', p_importo: 30, p_pagata_da: 'u1', p_household: 'h1' });
  });

  it('una entrata personale aumenta il conto con delta positivo', async () => {
    apri({
      modoIniziale: 'personale',
      casa: null,
      personale: {
        ...personale,
        categories: [...personale.categories, { id: 'ci', nome: 'Stipendio', tipo: 'income', colore: null, archiviata: false, ruolo: null }],
      },
    });
    scegliEntrata();
    compila('40');
    await waitFor(() => expect(rpc).toHaveBeenCalledTimes(1));
    expect(parametri()).toMatchObject({ p_tipo: 'income', p_importo: 40, p_account: 'ap' });
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
    await waitFor(() => expect(rpc).toHaveBeenCalledTimes(1));
    expect(parametri()).toMatchObject({ p_importo: 9, p_account: 'ap', p_pagata_da: 'u1' });
  });

  it('le entrate non offrono i conti personali', () => {
    apri({
      modoIniziale: 'casa',
      contiPersonali: personale.accounts,
      casa: { ...casa, categorie: [...casa.categorie, { id: 'ci', nome: 'Altre entrate', tipo: 'income', colore: null, archiviata: false, ruolo: null }] },
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
    await waitFor(() => expect(rpc).toHaveBeenCalledTimes(1));
    expect(parametri()).toMatchObject({ p_account: 'ac', p_importo: 12, p_pagata_da: null });
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
    await waitFor(() => expect(rpc).toHaveBeenCalled());
    expect(parametri()).toMatchObject({ p_categoria: 'cc', p_goal: 'g-bol' });
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
    await waitFor(() => expect(rpc).toHaveBeenCalled());
    expect(parametri()).toMatchObject({ p_goal: null });
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
    await waitFor(() => expect(rpc).toHaveBeenCalled());
    expect(parametri()).toMatchObject({
      p_tipo: 'expense',
      p_importo: 7,
      p_descrizione: '',
      p_categoria: 'cp',
      p_account: 'ap',
      p_goal: null,
    });
  });

  it('senza storico la categoria è "Senza categoria" e si salva senza', async () => {
    apri({ modoIniziale: 'personale' });
    expect(pezzo('Senza categoria')).toBeInTheDocument();
    compila('7');
    await waitFor(() => expect(rpc).toHaveBeenCalled());
    expect(parametri()).toMatchObject({ p_categoria: null });
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
    await waitFor(() => expect(rpc).toHaveBeenCalled());
    expect(parametri()).toMatchObject({ p_descrizione: 'Pane' });
  });

  it('la categoria segue la descrizione finché non la scegli a mano', () => {
    const conDue = {
      ...personale,
      categories: [
        ...personale.categories,
        { id: 'cp2', nome: 'Caffè', tipo: 'expense' as const, colore: null, archiviata: false, ruolo: null },
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
    await waitFor(() => expect(rpc).toHaveBeenCalledTimes(1));
    expect(parametri()).toMatchObject({ p_account: 'ap2', p_importo: 4 });
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
    await waitFor(() => expect(rpc).toHaveBeenCalled());
    expect(parametri()).toMatchObject({ p_account: null });
  });

  it('dopo il salvataggio scrive l id in sessionStorage, chiama onSaved(id) e chiude', async () => {
    const onSaved = vi.fn();
    const onClose = vi.fn();
    apri({ modoIniziale: 'personale', onSaved, onClose });
    compila('8');
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith('t-nuova', expect.any(String)));
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
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith('t-nuova', expect.any(String)));
    expect(onClose).toHaveBeenCalled();
  });

  it('un errore al salvataggio lascia il modulo aperto con i campi', async () => {
    rpc.mockResolvedValue({ data: null, error: new Error('rete') });
    const onSaved = vi.fn();
    const onClose = vi.fn();
    apri({ modoIniziale: 'personale', onSaved, onClose });
    fireEvent.click(screen.getByText('Aggiungi una nota'));
    fireEvent.change(screen.getByLabelText('Descrizione'), { target: { value: 'Pane' } });
    compila('8');
    await screen.findByText(/Salvataggio fallito/);
    expect(screen.getByLabelText('Importo')).toHaveValue(8);
    expect(screen.getByLabelText('Descrizione')).toHaveValue('Pane');
    expect(onSaved).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(window.sessionStorage.getItem('libretto:registrato')).toBeNull();
    expect(screen.getByText('Salva')).not.toBeDisabled();
  });

  it('dopo un errore, riprovare salva con una chiamata riuscita', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: new Error('rete') });
    const onSaved = vi.fn();
    apri({ modoIniziale: 'personale', onSaved });
    compila('8');
    await screen.findByText(/Salvataggio fallito/);
    fireEvent.click(screen.getByText('Salva'));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith('t-nuova', expect.any(String)));
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(window.sessionStorage.getItem('libretto:registrato')).toBe('t-nuova');
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

  it('dopo un salvataggio la riapertura parte senza l importo', async () => {
    const props = { onClose: vi.fn(), personale, casa: null, meUserId: 'u1', onSaved: vi.fn() };
    const { rerender } = render(<AddTransactionSheet aperto {...props} />);
    compila('12');
    await waitFor(() => expect(props.onSaved).toHaveBeenCalled());
    rerender(<AddTransactionSheet aperto={false} {...props} />);
    rerender(<AddTransactionSheet aperto {...props} />);
    expect((screen.getByLabelText('Importo') as HTMLInputElement).value).toBe('');
  });

  it('in Casa con i contanti la spesa è anticipata da te e nessun saldo cambia', async () => {
    window.localStorage.setItem('aggiungiModo', 'casa');
    window.localStorage.setItem('aggiungi:conto:casa', '');
    const onSaved = vi.fn();
    apri({ onSaved });
    compila('9');
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith('t-nuova', 'casa'));
    expect(parametri()).toMatchObject({ p_account: null, p_pagata_da: 'u1' });
  });
});

describe('AddTransactionSheet: quota delle tasse', () => {
  const persPiva = {
    categories: [
      { id: 'cp', nome: 'Spesa', tipo: 'expense' as const, colore: null, archiviata: false, ruolo: null },
      { id: 'cat-fatt', nome: 'Compensi', tipo: 'income' as const, colore: null, archiviata: false, ruolo: null },
      { id: 'cat-altro', nome: 'Regali', tipo: 'income' as const, colore: null, archiviata: false, ruolo: null },
    ],
    accounts: [
      { id: 'ap', nome: 'Conto mio', saldoAttuale: 100, contaInDisponibile: true, targetSaldo: null, archiviato: false },
      { id: 'tasse', nome: 'Conto tasse', saldoAttuale: 0, contaInDisponibile: false, targetSaldo: null, archiviato: false },
    ],
    goals: [],
  };
  const piva = { categoriaFatturatoId: 'cat-fatt', percentuale: 13.7, contoTasseId: 'tasse' };

  function incassa(categoria: string, importo: string) {
    scegliEntrata();
    fireEvent.click(pezzo('Senza categoria'));
    fireEvent.click(pezzo(categoria));
    compila(importo);
  }

  it('entrata di categoria fatturato apre il prompt con 82 su 600', async () => {
    apri({ casa: null, personale: persPiva, piva, modoIniziale: 'personale' });
    incassa('Compensi', '600');
    expect(await screen.findByText('da mettere da parte sul conto tasse (su 600 € incassati)')).toBeInTheDocument();
    expect(screen.getByText('82 €')).toBeInTheDocument();
  });

  describe('P13: il pezzo in più per la scadenza', () => {
    const scadenza = {
      id: 'sc', anno: 2099, chiave: 'f24_novembre' as const, tipo: 'f24' as const, descrizione: 'F24',
      data: '2099-12-31', importo: 200, pagataIl: null, transactionId: null, nascosta: false,
    };
    const scadenzaVaso = { scadenze: [scadenza], saldoVaso: 0, inSospeso: 0, incassiMensili: [] };

    it('con un buco nel vaso la domanda dice quota e pezzo in più', async () => {
      apri({ casa: null, personale: persPiva, piva: { ...piva, scadenzaVaso }, modoIniziale: 'personale' });
      incassa('Compensi', '600');
      expect(await screen.findByText('da mettere da parte sul conto tasse (su 600 € incassati)')).toBeInTheDocument();
      expect(screen.getByText('200 €')).toBeInTheDocument();
      expect(screen.getByText(/82 € di quota e 118 € per la scadenza del 31 dicembre 2099/)).toBeInTheDocument();
    });

    it('con scadenzaVaso null la domanda è quella di oggi', async () => {
      apri({ casa: null, personale: persPiva, piva: { ...piva, scadenzaVaso: null }, modoIniziale: 'personale' });
      incassa('Compensi', '600');
      expect(await screen.findByText('82 €')).toBeInTheDocument();
      expect(screen.queryByText(/per la scadenza del/)).not.toBeInTheDocument();
    });
  });

  it('entrata di altra categoria non apre il prompt', async () => {
    const onSaved = vi.fn();
    apri({ casa: null, personale: persPiva, piva, modoIniziale: 'personale', onSaved });
    incassa('Regali', '600');
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(screen.queryByText(/metti da parte/)).not.toBeInTheDocument();
  });

  it('una spesa non apre il prompt', async () => {
    const onSaved = vi.fn();
    apri({ casa: null, personale: persPiva, piva, modoIniziale: 'personale', onSaved });
    compila('20');
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(screen.queryByText(/metti da parte/)).not.toBeInTheDocument();
  });

  it('senza la prop piva non cambia niente', async () => {
    const onSaved = vi.fn();
    apri({ casa: null, personale: persPiva, modoIniziale: 'personale', onSaved });
    incassa('Compensi', '600');
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(screen.queryByText(/metti da parte/)).not.toBeInTheDocument();
  });

  it('Fatto chiama accantonaTasse con conto personale e conto tasse', async () => {
    const onAccantonato = vi.fn();
    apri({ casa: null, personale: persPiva, piva, modoIniziale: 'personale', onAccantonato });
    incassa('Compensi', '600');
    fireEvent.click(await screen.findByRole('button', { name: 'Fatto, li ho spostati' }));
    await waitFor(() => expect(rpc.mock.calls[1]?.[0]).toBe('accantona_tasse'));
    expect(parametri(1)).toEqual({
      p_importo: 82,
      p_data: oggiRomaISO(),
      p_da_account: 'ap',
      p_a_account: 'tasse',
      p_transaction: 't-nuova',
    });
    await waitFor(() => expect(screen.queryByText(/metti da parte/)).not.toBeInTheDocument());
    expect(onAccantonato).toHaveBeenCalled();
  });

  it('un incasso in contanti sposta dal primo conto che conta nel disponibile', async () => {
    apri({ casa: null, personale: persPiva, piva, modoIniziale: 'personale' });
    scegliEntrata();
    fireEvent.click(pezzo('Conto mio'));
    fireEvent.click(pezzo('Contanti'));
    fireEvent.click(pezzo('Senza categoria'));
    fireEvent.click(pezzo('Compensi'));
    compila('600');
    fireEvent.click(await screen.findByRole('button', { name: 'Fatto, li ho spostati' }));
    await waitFor(() => expect(rpc.mock.calls[1]?.[0]).toBe('accantona_tasse'));
    expect(parametri(1)).toMatchObject({ p_da_account: 'ap', p_a_account: 'tasse' });
  });

  it('Più tardi chiude e la quota resta in sospeso', async () => {
    apri({ casa: null, personale: persPiva, piva, modoIniziale: 'personale' });
    incassa('Compensi', '600');
    fireEvent.click(await screen.findByRole('button', { name: 'Più tardi' }));
    await waitFor(() => expect(screen.queryByText(/metti da parte/)).not.toBeInTheDocument());
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});

describe('AddTransactionSheet: dopo il salvataggio', () => {
  const avviso = {
    tipo: 'avviso' as const,
    avviso: { buco: 50, toccati: ['obiettivi' as const], fondoImprevisti: null },
    transactionId: 't-nuova',
    lezione: 'imprevisti' as const,
  };

  it('dopo un salvataggio personale chiama valutaDopoSalvataggio, dopo uno di casa no', async () => {
    const { unmount } = apri({ modoIniziale: 'personale' });
    compila('20');
    await waitFor(() => expect(valutaDopoSalvataggio).toHaveBeenCalledWith('t-nuova'));
    unmount();
    valutaDopoSalvataggio.mockClear();
    const onSaved = vi.fn();
    apri({ modoIniziale: 'casa', onSaved });
    compila('20');
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(valutaDopoSalvataggio).not.toHaveBeenCalled();
  });

  it('mostra l avviso quando arriva, anche a foglio chiuso', async () => {
    valutaDopoSalvataggio.mockResolvedValue(avviso);
    const { rerender } = apri({ modoIniziale: 'personale' });
    compila('20');
    rerender(
      <AddTransactionSheet aperto={false} onClose={vi.fn()} personale={personale} casa={casa} meUserId="u1" onSaved={vi.fn()} />
    );
    expect(await screen.findByText('Questa spesa usa 50 € che avevi messo da parte.')).toBeInTheDocument();
  });

  it('un errore del calcolo non rompe il salvataggio', async () => {
    valutaDopoSalvataggio.mockRejectedValue(new Error('x'));
    const onSaved = vi.fn();
    apri({ modoIniziale: 'personale', onSaved });
    compila('20');
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('la quota P.IVA viene prima dell avviso', async () => {
    valutaDopoSalvataggio.mockResolvedValue({ tipo: 'lezione', lezione: 'prima-da-parte' });
    const persPiva = {
      categories: [{ id: 'cat-fatt', nome: 'Compensi', tipo: 'income' as const, colore: null, archiviata: false, ruolo: null }],
      accounts: [
        { id: 'ap', nome: 'Conto mio', saldoAttuale: 100, contaInDisponibile: true, targetSaldo: null, archiviato: false },
        { id: 'tasse', nome: 'Conto tasse', saldoAttuale: 0, contaInDisponibile: false, targetSaldo: null, archiviato: false },
      ],
      goals: [],
    };
    apri({
      casa: null,
      personale: persPiva,
      piva: { categoriaFatturatoId: 'cat-fatt', percentuale: 13.7, contoTasseId: 'tasse' },
      modoIniziale: 'personale',
    });
    scegliEntrata();
    fireEvent.click(pezzo('Senza categoria'));
    fireEvent.click(pezzo('Compensi'));
    compila('600');
    expect(await screen.findByText('da mettere da parte sul conto tasse (su 600 € incassati)')).toBeInTheDocument();
    await waitFor(() => expect(valutaDopoSalvataggio).toHaveBeenCalled());
    expect(screen.queryByText('In breve')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Più tardi' }));
    expect(await screen.findByText('In breve')).toBeInTheDocument();
  });
});

describe('AddTransactionSheet: la domanda sul rientro', () => {
  const conti = [
    { id: 'ap', nome: 'Conto mio', saldoAttuale: 100, contaInDisponibile: true, targetSaldo: null, archiviato: false },
    { id: 'risp', nome: 'Conto risparmio', saldoAttuale: 900, contaInDisponibile: false, targetSaldo: null, archiviato: false },
    { id: 'tasse', nome: 'Conto tasse', saldoAttuale: 0, contaInDisponibile: false, targetSaldo: null, archiviato: false },
  ];
  const pers = {
    categories: [
      { id: 'cp', nome: 'Spesa', tipo: 'expense' as const, colore: null, archiviata: false, ruolo: null },
      { id: 'cat-fatt', nome: 'Compensi', tipo: 'income' as const, colore: null, archiviata: false, ruolo: null },
    ],
    accounts: conti,
    goals: [],
  };
  const piva = { categoriaFatturatoId: 'cat-fatt', percentuale: 13.7, contoTasseId: 'tasse' };
  const TITOLO = "Vuoi rimetterli un po' al mese?";

  function spendiDa(contoId: string, importo: string, extra: Partial<React.ComponentProps<typeof AddTransactionSheet>> = {}) {
    window.localStorage.setItem('aggiungi:conto:personale', contoId);
    creaRientro.mockResolvedValue('r1');
    apri({ casa: null, personale: pers, piva, modoIniziale: 'personale', ...extra });
    compila(importo);
  }

  it('una spesa dal conto risparmio fa comparire la domanda, coi testi giusti', async () => {
    spendiDa('risp', '300');
    expect(await screen.findByText(TITOLO)).toBeInTheDocument();
    expect(screen.getByText("Hai preso 300 € dal Conto risparmio. Puoi riportarli lì un po' alla volta.")).toBeInTheDocument();
    expect(screen.getByText(/100 € al mese, da /)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sì, rimettili' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'No, va bene così' })).toBeInTheDocument();
    assertNessunaParolaVietata(document.body);
  });

  it('Sì chiama creaRientro con conto, importo e 3 mesi', async () => {
    spendiDa('risp', '300');
    fireEvent.click(await screen.findByRole('button', { name: 'Sì, rimettili' }));
    await waitFor(() => expect(creaRientro).toHaveBeenCalledTimes(1));
    expect(creaRientro.mock.calls[0][1]).toEqual({
      goalId: null,
      accountId: 'risp',
      importo: 300,
      mesi: 3,
      creatoIl: oggiRomaISO(),
    });
    await waitFor(() => expect(screen.queryByText(TITOLO)).not.toBeInTheDocument());
  });

  it('se creaRientro fallisce mostra l errore e la domanda resta', async () => {
    spendiDa('risp', '300');
    creaRientro.mockRejectedValue(new Error('no'));
    fireEvent.click(await screen.findByRole('button', { name: 'Sì, rimettili' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Non sono riuscito a salvarlo. Riprova tra poco.');
    expect(screen.getByText(TITOLO)).toBeInTheDocument();
  });

  it('un conto che conta nel disponibile non fa domande', async () => {
    const onSaved = vi.fn();
    spendiDa('ap', '30', { onSaved });
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(screen.queryByText(TITOLO)).not.toBeInTheDocument();
  });

  it('una spesa dal risparmio collegata a un cassetto non fa domande', async () => {
    const onSaved = vi.fn();
    window.localStorage.setItem('aggiungi:conto:personale', 'risp');
    apri({
      casa: null,
      piva,
      modoIniziale: 'personale',
      onSaved,
      personale: {
        ...pers,
        goals: [
          {
            id: 'g-cass', nome: 'Vacanza', importoTarget: 500, modalita: 'bloccato' as const, scadenza: null,
            categoriaId: 'cp', ricorrente: false, frequenzaMesi: null, stato: 'aperto' as const,
            createdAt: '2026-01-01T00:00:00Z', accantonato: 0,
          },
        ],
      },
    });
    fireEvent.click(screen.getByText('Aggiungi una nota'));
    fireEvent.click(screen.getByRole('button', { name: 'Vacanza' }));
    compila('300');
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(parametri()).toMatchObject({ p_goal: 'g-cass' });
    expect(screen.queryByText(TITOLO)).not.toBeInTheDocument();
  });

  it('il conto tasse non fa domande', async () => {
    const onSaved = vi.fn();
    spendiDa('tasse', '30', { onSaved });
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(screen.queryByText(TITOLO)).not.toBeInTheDocument();
  });

  it('una spesa in Casa non fa domande', async () => {
    const onSaved = vi.fn();
    apri({ modoIniziale: 'casa', onSaved, contiPersonali: conti });
    compila('12');
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(screen.queryByText(TITOLO)).not.toBeInTheDocument();
  });

  it('un incasso P.IVA mostra la quota, non la domanda', async () => {
    window.localStorage.setItem('aggiungi:conto:personale', 'risp');
    apri({ casa: null, personale: pers, piva, modoIniziale: 'personale' });
    scegliEntrata();
    fireEvent.click(pezzo('Senza categoria'));
    fireEvent.click(pezzo('Compensi'));
    compila('600');
    expect(await screen.findByText('da mettere da parte sul conto tasse (su 600 € incassati)')).toBeInTheDocument();
    expect(screen.queryByText(TITOLO)).not.toBeInTheDocument();
  });

  it('dopo la domanda si vede ancora la lezione', async () => {
    valutaDopoSalvataggio.mockResolvedValue({ tipo: 'lezione', lezione: 'prima-da-parte' });
    spendiDa('risp', '300');
    expect(await screen.findByText(TITOLO)).toBeInTheDocument();
    await waitFor(() => expect(valutaDopoSalvataggio).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByText('In breve')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'No, va bene così' }));
    expect(await screen.findByText('In breve')).toBeInTheDocument();
  });
});
