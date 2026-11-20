import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { assertNessunaParolaVietata } from './helpers/paroleVietate';

const replace = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace, refresh: vi.fn(), push: vi.fn() }) }));
const ricominciaDaZero = vi.fn(async () => {});
vi.mock('@/lib/data/percorso', () => ({ ricominciaDaZero: (...a: unknown[]) => ricominciaDaZero(...(a as [])) }));
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ marca: 'client' }) }));

const azzeraFumetti = vi.fn();
vi.mock('@/lib/fumetti/visti', () => ({ azzeraFumetti: (...a: unknown[]) => azzeraFumetti(...a) }));
vi.mock('@/lib/fumetti/ambiente', () => ({ useUtenteId: () => 'u1' }));

import { RicominciaDaZero } from '@/app/altro/RicominciaDaZero';

function apri(casa: { credito: number; debito: number } | null = null) {
  const r = render(<RicominciaDaZero casa={casa} />);
  fireEvent.click(screen.getByRole('button', { name: 'Ricomincia da zero' }));
  return r;
}
const conferma = () => screen.getByRole('button', { name: 'Cancella tutto e ricomincia' });
const campo = () => screen.getByLabelText(/RICOMINCIA/);

beforeEach(() => {
  vi.clearAllMocks();
  ricominciaDaZero.mockResolvedValue(undefined);
});

describe('RicominciaDaZero', () => {
  it('il pulsante resta disattivato finché non si scrive RICOMINCIA', () => {
    apri();
    expect(conferma()).toBeDisabled();
    fireEvent.change(campo(), { target: { value: 'RICOMINCI' } });
    expect(conferma()).toBeDisabled();
    fireEvent.change(campo(), { target: { value: 'RICOMINCIA' } });
    expect(conferma()).toBeEnabled();
  });

  it('accetta ricomincia minuscolo con spazi', () => {
    apri();
    fireEvent.change(campo(), { target: { value: '  ricomincia ' } });
    expect(conferma()).toBeEnabled();
  });

  it('mostra l avviso sui backup e cosa cancella e cosa resta', () => {
    apri();
    expect(
      screen.getByText('Il piano gratuito non ha copie di sicurezza: dopo la conferma questi dati non si recuperano.')
    ).toBeInTheDocument();
    expect(screen.getByText(/Cancella:/)).toBeInTheDocument();
    expect(screen.getByText(/obiettivi e le categorie che la casa usa restano, chiusi o archiviati/i)).toBeInTheDocument();
    expect(screen.getByText(/Resta:/)).toBeInTheDocument();
  });

  it('senza conferma non cancella nulla', () => {
    apri();
    fireEvent.click(screen.getByRole('button', { name: 'Annulla' }));
    expect(ricominciaDaZero).not.toHaveBeenCalled();
  });

  it('con debito aperto lo dice prima', () => {
    apri({ credito: 0, debito: 40 });
    expect(screen.getByText(/ancora 40 € da restituire/)).toBeInTheDocument();
  });

  it('con credito aperto lo dice prima', () => {
    apri({ credito: 25, debito: 0 });
    expect(screen.getByText(/credito di 25 €/)).toBeInTheDocument();
  });

  it('senza nulla di aperto non parla della casa aperta', () => {
    apri(null);
    expect(screen.queryByText(/da restituire/)).not.toBeInTheDocument();
    expect(screen.queryByText(/credito di/)).not.toBeInTheDocument();
  });

  it('al successo azzera i fumetti dell utente prima di andare ai primi passi', async () => {
    apri();
    fireEvent.change(campo(), { target: { value: 'RICOMINCIA' } });
    fireEvent.click(conferma());
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/impara/primi-passi'));
    expect(azzeraFumetti).toHaveBeenCalledWith('u1');
    expect(azzeraFumetti.mock.invocationCallOrder[0]).toBeLessThan(replace.mock.invocationCallOrder[0]);
  });

  it('al successo va ai primi passi', async () => {
    apri();
    fireEvent.change(campo(), { target: { value: 'RICOMINCIA' } });
    fireEvent.click(conferma());
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/impara/primi-passi'));
    expect(ricominciaDaZero).toHaveBeenCalledTimes(1);
  });

  it('all errore resta e mostra il messaggio', async () => {
    ricominciaDaZero.mockRejectedValueOnce(new Error('boom'));
    apri();
    fireEvent.change(campo(), { target: { value: 'RICOMINCIA' } });
    fireEvent.click(conferma());
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it('nessuna parola vietata', () => {
    apri({ credito: 25, debito: 40 });
    assertNessunaParolaVietata(document.body);
  });
});
