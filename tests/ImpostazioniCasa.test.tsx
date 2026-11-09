import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ImpostazioniCasa } from '@/app/casa/impostazioni/ImpostazioniCasa';
import { assertNessunaParolaVietata } from './helpers/paroleVietate';
import type { CasaCorrente } from '@/lib/data/households';

const push = vi.fn();
const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh }) }));
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }));

const createInvite = vi.fn();
const revokeInvite = vi.fn();
const leaveHousehold = vi.fn();
const closeHousehold = vi.fn();
vi.mock('@/lib/data/households', async () => {
  const actual = await vi.importActual<typeof import('@/lib/data/households')>('@/lib/data/households');
  return {
    ...actual,
    createInvite: (...a: unknown[]) => createInvite(...a),
    revokeInvite: (...a: unknown[]) => revokeInvite(...a),
    leaveHousehold: (...a: unknown[]) => leaveHousehold(...a),
    closeHousehold: (...a: unknown[]) => closeHousehold(...a),
  };
});

import { CasaBloccataError } from '@/lib/data/households';

const fabio = { householdId: 'h1', userId: 'u1', displayName: 'Fabio', joinedAt: '2026-01-01', slot: 1, attivo: true };
const anna = { householdId: 'h1', userId: 'u2', displayName: 'Anna', joinedAt: '2026-01-02', slot: 2, attivo: true };
const invito = {
  id: 'i1',
  householdId: 'h1',
  codice: 'K7M2QX9P',
  createdAt: '2026-11-01T00:00:00Z',
  scadeIl: '2999-01-01T00:00:00Z',
  revocatoIl: null,
};

function casa(over: Partial<CasaCorrente> = {}): CasaCorrente {
  return {
    household: { id: 'h1', nome: 'Casa Rossi', createdAt: '2026-01-01', archiviataIl: null },
    members: [fabio, anna],
    invite: invito,
    me: fabio,
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ImpostazioniCasa', () => {
  it('elenca i membri', () => {
    render(<ImpostazioniCasa casa={casa()} />);
    expect(screen.getByText(/Fabio/)).toBeInTheDocument();
    expect(screen.getByText(/Anna/)).toBeInTheDocument();
  });

  it('mostra il codice di invito con "Rigenera" e "Revoca"', async () => {
    createInvite.mockResolvedValue('NEWCODE1');
    revokeInvite.mockResolvedValue(undefined);
    render(<ImpostazioniCasa casa={casa()} />);
    expect(screen.getByText('K7M2-QX9P')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Rigenera' }));
    expect(await screen.findByText('NEWC-ODE1')).toBeInTheDocument();
    expect(createInvite).toHaveBeenCalledWith({}, 'h1');

    fireEvent.click(screen.getByRole('button', { name: 'Revoca' }));
    await waitFor(() => expect(revokeInvite).toHaveBeenCalledWith({}, 'h1'));
    await waitFor(() => expect(screen.queryByText('NEWC-ODE1')).not.toBeInTheDocument());
  });

  it('Esci dalla casa chiama leaveHousehold e torna a /casa', async () => {
    leaveHousehold.mockResolvedValue(undefined);
    render(<ImpostazioniCasa casa={casa()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Esci dalla casa' }));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/casa'));
    expect(leaveHousehold).toHaveBeenCalled();
    expect(refresh).toHaveBeenCalled();
  });

  it.each([
    [
      'credito',
      'Prima di uscire serve chiudere i soldi che hai anticipato: fatti rimborsare dal conto comune o scegli di rinunciarvi.',
    ],
    [
      'debito',
      'Prima di uscire serve chiudere la quota versata per te o da te: restituitela, anche a rate, oppure rinunciate.',
    ],
    ['arretrati', 'Prima di uscire serve versare le quote del piano di questo mese e dei mesi passati.'],
  ] as const)('con un blocco %s mostra il testo neutro', async (reason, testo) => {
    leaveHousehold.mockRejectedValue(new CasaBloccataError(reason));
    const { container } = render(<ImpostazioniCasa casa={casa()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Esci dalla casa' }));
    expect(await screen.findByText(testo)).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
    assertNessunaParolaVietata(container);
  });

  it('se sei l\'ultimo membro mostra "Chiudi la casa" con la conferma e chiama closeHousehold', async () => {
    closeHousehold.mockResolvedValue(undefined);
    render(<ImpostazioniCasa casa={casa({ members: [fabio] })} />);
    expect(screen.queryByRole('button', { name: 'Esci dalla casa' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Chiudi la casa' }));
    expect(
      screen.getByText(
        "Non vedrai più i dati della casa. I soldi sul conto comune non si muovono da soli: mettetevi d'accordo prima su come dividerli."
      )
    ).toBeInTheDocument();
    expect(closeHousehold).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Sì, chiudi la casa' }));
    await waitFor(() => expect(closeHousehold).toHaveBeenCalled());
    await waitFor(() => expect(push).toHaveBeenCalledWith('/casa'));
  });

  it('un errore generico mostra il messaggio di salvataggio fallito', async () => {
    leaveHousehold.mockRejectedValue(new Error('boom'));
    render(<ImpostazioniCasa casa={casa()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Esci dalla casa' }));
    expect(
      await screen.findByText('Salvataggio fallito, controlla la connessione e riprova.')
    ).toBeInTheDocument();
  });

  it('non contiene parole vietate', () => {
    const { container } = render(<ImpostazioniCasa casa={casa()} />);
    assertNessunaParolaVietata(container);
  });
});

describe('ImpostazioniCasa, calendario', () => {
  it('mostra la sezione Calendario', () => {
    render(<ImpostazioniCasa casa={casa()} />);
    expect(screen.getByRole('heading', { name: 'Calendario' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Crea il link' })).toBeInTheDocument();
  });
});
