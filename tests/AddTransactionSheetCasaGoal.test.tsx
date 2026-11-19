import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { assertNessunaParolaVietata } from './helpers/paroleVietate';
import { AddTransactionSheet } from '@/app/add/AddTransactionSheet';
import type { CasaAggiunta } from '@/lib/loadCasaData';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));

const rpc = vi.hoisted(() => vi.fn());
const clienteFinto = vi.hoisted(() => ({ marca: 'client' }));
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ rpc, ...clienteFinto }) }));

const createGoal = vi.hoisted(() => vi.fn());
vi.mock('@/lib/data/goals', () => ({ createGoal: (...a: unknown[]) => createGoal(...a) }));

vi.mock('@/app/impara/dopoSalvataggio', () => ({
  valutaDopoSalvataggio: vi.fn(),
  rispondiAvviso: vi.fn(),
}));

const personale = {
  categories: [{ id: 'cp', nome: 'Personale cat', tipo: 'expense' as const, colore: null, archiviata: false, ruolo: null }],
  accounts: [{ id: 'ap', nome: 'Conto mio', saldoAttuale: 100, contaInDisponibile: true, targetSaldo: null, archiviato: false }],
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

const nuovo = {
  id: 'g-nuovo',
  nome: 'Assicurazione casa',
  importoTarget: 250,
  modalita: 'bloccato' as const,
  scadenza: null,
  categoriaId: 'cc',
  ricorrente: false,
  frequenzaMesi: null,
  stato: 'aperto' as const,
  createdAt: '2026-11-19T00:00:00Z',
};

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  createGoal.mockResolvedValue(nuovo);
});

function apri(modoIniziale: 'casa' | 'personale') {
  return render(
    <AddTransactionSheet aperto onClose={vi.fn()} personale={personale} casa={casa} modoIniziale={modoIniziale} meUserId="u1" onSaved={vi.fn()} />
  );
}

function creaDalForm(nome: string, importo: string) {
  fireEvent.click(screen.getByRole('button', { name: 'Aggiungi una nota' }));
  const apriForm = screen.getByRole('button', { name: '+ Nuova cosa da mettere da parte' });
  expect(apriForm.className).toContain('min-h-11');
  fireEvent.click(apriForm);
  fireEvent.change(screen.getByLabelText('Nome nuova cosa da mettere da parte'), { target: { value: nome } });
  fireEvent.change(screen.getByLabelText('Importo nuova cosa da mettere da parte'), { target: { value: importo } });
  fireEvent.click(screen.getByRole('button', { name: 'Crea e collega' }));
}

describe('foglio di aggiunta: nuova cosa da mettere da parte', () => {
  it('in Casa il pulsante è visibile, crea un obiettivo della casa e lo sceglie', async () => {
    const { container } = apri('casa');
    creaDalForm('Assicurazione casa', '250');
    await waitFor(() => expect(createGoal).toHaveBeenCalledTimes(1));
    const [client, input, scope] = createGoal.mock.calls[0];
    expect(client).toMatchObject({ marca: 'client' });
    expect(input).toEqual({
      nome: 'Assicurazione casa',
      importoTarget: 250,
      modalita: 'bloccato',
      scadenza: null,
      categoriaId: null,
      ricorrente: false,
      frequenzaMesi: null,
    });
    expect(scope).toEqual({ kind: 'casa', householdId: 'h1' });
    expect(await screen.findByRole('button', { name: 'Assicurazione casa', pressed: true })).toBeInTheDocument();
    assertNessunaParolaVietata(container);
  });

  it('in Personale crea un obiettivo personale (senza scope di casa) e lo sceglie', async () => {
    createGoal.mockResolvedValue({ ...nuovo, id: 'g-pers', nome: 'Vacanza' });
    apri('personale');
    creaDalForm('Vacanza', '500');
    await waitFor(() => expect(createGoal).toHaveBeenCalledTimes(1));
    expect(createGoal.mock.calls[0][2]).toBeUndefined();
    expect(await screen.findByRole('button', { name: 'Vacanza', pressed: true })).toBeInTheDocument();
  });

  it('per un’entrata non c’è', () => {
    apri('casa');
    fireEvent.click(screen.getByRole('button', { name: 'Spesa' }));
    fireEvent.click(screen.getByRole('button', { name: 'Entrata' }));
    fireEvent.click(screen.getByRole('button', { name: 'Aggiungi una nota' }));
    expect(screen.queryByRole('button', { name: '+ Nuova cosa da mettere da parte' })).not.toBeInTheDocument();
  });
});
