import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { InizioCasa } from '@/app/casa/inizia/InizioCasa';
import { assertNessunaParolaVietata } from './helpers/paroleVietate';

const push = vi.fn();
const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh }) }));
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }));

const createHousehold = vi.fn();
const createInvite = vi.fn();
const joinHousehold = vi.fn();
vi.mock('@/lib/data/households', async () => {
  const actual = await vi.importActual<typeof import('@/lib/data/households')>('@/lib/data/households');
  return {
    ...actual,
    createHousehold: (...a: unknown[]) => createHousehold(...a),
    createInvite: (...a: unknown[]) => createInvite(...a),
    joinHousehold: (...a: unknown[]) => joinHousehold(...a),
  };
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('InizioCasa', () => {
  it('il nome di chi crea è precompilato con defaultDisplayName', () => {
    render(<InizioCasa defaultDisplayName="fabio" />);
    expect(screen.getByLabelText("Come ti chiami per l'altro?")).toHaveValue('fabio');
  });

  it('crea la casa, genera l\'invito e mostra il codice con il trattino e "Copia il codice"', async () => {
    createHousehold.mockResolvedValue('h1');
    createInvite.mockResolvedValue('K7M2QX9P');
    render(<InizioCasa defaultDisplayName="fabio" />);
    fireEvent.change(screen.getByLabelText('Nome della casa (facoltativo)'), { target: { value: 'Casa Rossi' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crea la casa' }));

    expect(await screen.findByText('K7M2-QX9P')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copia il codice' })).toBeInTheDocument();
    expect(createHousehold).toHaveBeenCalledWith({}, { nome: 'Casa Rossi', displayName: 'fabio' });
    expect(createInvite).toHaveBeenCalledWith({}, 'h1');
    expect(createHousehold.mock.invocationCallOrder[0]).toBeLessThan(createInvite.mock.invocationCallOrder[0]);
  });

  it('entra con un codice e va su /casa', async () => {
    joinHousehold.mockResolvedValue('h1');
    render(<InizioCasa defaultDisplayName="anna" />);
    fireEvent.click(screen.getByRole('button', { name: 'Ho un codice di invito' }));
    fireEvent.change(screen.getByLabelText('Codice di invito'), { target: { value: 'k7m2-qx9p' } });
    fireEvent.click(screen.getByRole('button', { name: 'Entra' }));

    await waitFor(() => expect(push).toHaveBeenCalledWith('/casa'));
    expect(refresh).toHaveBeenCalled();
    expect(joinHousehold).toHaveBeenCalledWith({}, { codice: 'k7m2-qx9p', displayName: 'anna' });
  });

  it('un codice rifiutato mostra "Codice non valido o scaduto. Chiedine uno nuovo."', async () => {
    joinHousehold.mockRejectedValue({ message: 'Codice non valido o scaduto' });
    render(<InizioCasa defaultDisplayName="anna" />);
    fireEvent.click(screen.getByRole('button', { name: 'Ho un codice di invito' }));
    fireEvent.change(screen.getByLabelText('Codice di invito'), { target: { value: 'zzzz' } });
    fireEvent.click(screen.getByRole('button', { name: 'Entra' }));

    expect(await screen.findByText('Codice non valido o scaduto. Chiedine uno nuovo.')).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it('un altro errore mostra il messaggio generico di salvataggio', async () => {
    joinHousehold.mockRejectedValue({ message: 'hai gia una casa' });
    render(<InizioCasa defaultDisplayName="anna" />);
    fireEvent.click(screen.getByRole('button', { name: 'Ho un codice di invito' }));
    fireEvent.change(screen.getByLabelText('Codice di invito'), { target: { value: 'zzzz' } });
    fireEvent.click(screen.getByRole('button', { name: 'Entra' }));

    expect(
      await screen.findByText('Salvataggio fallito, controlla la connessione e riprova.')
    ).toBeInTheDocument();
    expect(screen.queryByText(/Codice non valido/)).not.toBeInTheDocument();
  });

  it('chiede il nome visualizzato anche a chi entra', () => {
    render(<InizioCasa defaultDisplayName="anna" />);
    fireEvent.click(screen.getByRole('button', { name: 'Ho un codice di invito' }));
    expect(screen.getByLabelText("Come ti chiami per l'altro?")).toHaveValue('anna');
  });

  it('non contiene parole vietate', () => {
    const { container } = render(<InizioCasa defaultDisplayName="anna" />);
    assertNessunaParolaVietata(container);
  });
});
