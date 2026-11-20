import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { assertNessunaParolaVietata } from './helpers/paroleVietate';

const spostaMock = vi.hoisted(() => vi.fn());
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }));
vi.mock('@/lib/data/spostamenti', () => ({ sposta: spostaMock }));
vi.mock('@/lib/calculations/casa/oggi', () => ({ oggiRomaISO: () => '2026-11-20' }));

import { SpostaFoglio } from '@/app/sposta/SpostaFoglio';
import type { Account } from '@/lib/types';

const conto = (id: string, nome: string, extra: Partial<Account> = {}): Account => ({
  id,
  nome,
  saldoAttuale: 100,
  contaInDisponibile: true,
  targetSaldo: null,
  archiviato: false,
  ...extra,
});
const conti = [conto('c1', 'Corrente'), conto('c2', 'Risparmio'), conto('c3', 'Tasse')];

function apri(props: Partial<React.ComponentProps<typeof SpostaFoglio>> = {}) {
  const onFatto = vi.fn();
  const onClose = vi.fn();
  const r = render(<SpostaFoglio conti={conti} onFatto={onFatto} onClose={onClose} {...props} />);
  return { onFatto, onClose, ...r };
}

const pill = (gruppo: string, nome: string) =>
  Array.from(screen.getByRole('radiogroup', { name: gruppo }).querySelectorAll('[role=radio]')).find(
    (e) => e.textContent === nome,
  ) as HTMLElement | undefined;

beforeEach(() => {
  spostaMock.mockReset();
  spostaMock.mockResolvedValue('id1');
});

describe('SpostaFoglio', () => {
  it('invia sposta con i valori scelti', async () => {
    const { onFatto } = apri();
    fireEvent.click(pill('Da', 'Corrente')!);
    fireEvent.click(pill('A', 'Risparmio')!);
    fireEvent.change(screen.getByLabelText('Importo'), { target: { value: '45,50' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sposta' }));
    await waitFor(() => expect(onFatto).toHaveBeenCalled());
    expect(spostaMock).toHaveBeenCalledWith({}, { daAccountId: 'c1', aAccountId: 'c2', importo: 45.5, data: '2026-11-20' });
  });

  it('aperto da un rientro il bottone dice "Fatto, li ho spostati"', () => {
    apri({ daRientro: true, iniziale: { daAccountId: 'c1', aAccountId: 'c2', importo: 10 } });
    expect(screen.getByRole('button', { name: 'Fatto, li ho spostati' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Sposta' })).not.toBeInTheDocument();
  });

  it('altrimenti il bottone dice "Sposta"', () => {
    apri();
    expect(screen.getByRole('button', { name: 'Sposta' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Fatto, li ho spostati' })).not.toBeInTheDocument();
  });

  it('doppio tocco: una sola chiamata', async () => {
    let finisci!: () => void;
    spostaMock.mockReturnValue(new Promise<string>((r) => (finisci = () => r('x'))));
    apri({ iniziale: { daAccountId: 'c1', aAccountId: 'c2', importo: 10 } });
    const b = screen.getByRole('button', { name: 'Sposta' });
    fireEvent.click(b);
    fireEvent.click(b);
    expect(spostaMock).toHaveBeenCalledTimes(1);
    finisci();
  });

  it('"A" non mostra il conto scelto in "Da"', () => {
    apri({ iniziale: { daAccountId: 'c1' } });
    expect(pill('A', 'Corrente')).toBeUndefined();
    expect(pill('A', 'Risparmio')).toBeTruthy();
  });

  it('non mostra i conti archiviati', () => {
    apri({ conti: [...conti, conto('c4', 'Vecchio', { archiviato: true })] });
    expect(pill('Da', 'Vecchio')).toBeUndefined();
  });

  it('data futura: non si invia', () => {
    apri({ iniziale: { daAccountId: 'c1', aAccountId: 'c2', importo: 10 } });
    fireEvent.change(screen.getByLabelText('Data'), { target: { value: '2026-11-21' } });
    expect(screen.getByRole('button', { name: 'Sposta' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Data'), { target: { value: '2026-11-20' } });
    expect(screen.getByRole('button', { name: 'Sposta' })).toBeEnabled();
  });

  it('precompila da, a e importo', () => {
    apri({ iniziale: { daAccountId: 'c1', aAccountId: 'c2', importo: 120.5 } });
    expect(pill('Da', 'Corrente')).toHaveAttribute('aria-checked', 'true');
    expect(pill('A', 'Risparmio')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByLabelText('Importo')).toHaveValue('120,5');
  });

  it('errore: messaggio e si può riprovare', async () => {
    spostaMock.mockRejectedValueOnce(new Error('x'));
    const { baseElement, onFatto } = apri({ iniziale: { daAccountId: 'c1', aAccountId: 'c2', importo: 10 } });
    fireEvent.click(screen.getByRole('button', { name: 'Sposta' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Non sono riuscito a spostarli. Riprova tra poco.');
    assertNessunaParolaVietata(baseElement);
    expect(onFatto).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Sposta' }));
    await waitFor(() => expect(onFatto).toHaveBeenCalled());
    expect(spostaMock).toHaveBeenCalledTimes(2);
  });

  it('nessuna parola vietata', () => {
    const { baseElement } = apri();
    assertNessunaParolaVietata(baseElement);
  });
});
