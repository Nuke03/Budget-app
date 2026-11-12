import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SaldoTricount } from '@/app/casa/impostazioni/SaldoTricount';
import { assertNessunaParolaVietata } from './helpers/paroleVietate';
import type { HouseholdMember } from '@/lib/types';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh }) }));
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }));
vi.mock('@/lib/data/transfers', async () => ({
  ...(await vi.importActual<typeof import('@/lib/data/transfers')>('@/lib/data/transfers')),
  registraSaldoIniziale: vi.fn(),
}));
import { registraSaldoIniziale } from '@/lib/data/transfers';

const m = (userId: string, displayName: string, slot: number): HouseholdMember => ({
  householdId: 'h1', userId, displayName, joinedAt: '2026-01-01', slot, attivo: true,
});
const fabio = m('u1', 'Fabio', 1);
const anna = m('u2', 'Anna', 2);
const luca = m('u3', 'Luca', 3);

beforeEach(() => {
  vi.mocked(registraSaldoIniziale).mockReset();
  vi.mocked(registraSaldoIniziale).mockResolvedValue('t1');
  refresh.mockReset();
});

describe('SaldoTricount', () => {
  it('non compare con un solo membro', () => {
    const { container } = render(<SaldoTricount householdId="h1" members={[fabio]} saldoEsistente={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('A deve a B 43 €: chiama registraSaldoIniziale con creditore B e debitore A', async () => {
    const { container } = render(<SaldoTricount householdId="h1" members={[fabio, anna]} saldoEsistente={null} />);
    expect(screen.getByText('Venite da Tricount? Scrivi il saldo di oggi e ripartite da qui.')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Fabio deve a Anna'));
    fireEvent.change(screen.getByLabelText('Importo'), { target: { value: '43' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salva il saldo' }));
    await waitFor(() => expect(registraSaldoIniziale).toHaveBeenCalled());
    expect(vi.mocked(registraSaldoIniziale).mock.calls[0][1]).toEqual({
      householdId: 'h1', creditoreId: 'u2', debitoreId: 'u1', importo: 43,
    });
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    assertNessunaParolaVietata(container);
  });

  it('accetta la virgola', async () => {
    render(<SaldoTricount householdId="h1" members={[fabio, anna]} saldoEsistente={null} />);
    fireEvent.click(screen.getByLabelText('Anna deve a Fabio'));
    fireEvent.change(screen.getByLabelText('Importo'), { target: { value: '12,50' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salva il saldo' }));
    await waitFor(() => expect(registraSaldoIniziale).toHaveBeenCalled());
    expect(vi.mocked(registraSaldoIniziale).mock.calls[0][1]).toMatchObject({ creditoreId: 'u1', debitoreId: 'u2', importo: 12.5 });
  });

  it('senza scelta o importo valido il pulsante è spento', () => {
    render(<SaldoTricount householdId="h1" members={[fabio, anna]} saldoEsistente={null} />);
    const salva = screen.getByRole('button', { name: 'Salva il saldo' });
    expect(salva).toBeDisabled();
    fireEvent.click(screen.getByLabelText('Fabio deve a Anna'));
    fireEvent.change(screen.getByLabelText('Importo'), { target: { value: '0' } });
    expect(salva).toBeDisabled();
  });

  it('con più di 2 membri si scelgono le due persone', async () => {
    render(<SaldoTricount householdId="h1" members={[fabio, anna, luca]} saldoEsistente={null} />);
    fireEvent.change(screen.getByLabelText('Chi deve dare'), { target: { value: 'u3' } });
    fireEvent.change(screen.getByLabelText('A chi'), { target: { value: 'u1' } });
    fireEvent.change(screen.getByLabelText('Importo'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salva il saldo' }));
    await waitFor(() => expect(registraSaldoIniziale).toHaveBeenCalled());
    expect(vi.mocked(registraSaldoIniziale).mock.calls[0][1]).toMatchObject({ creditoreId: 'u1', debitoreId: 'u3', importo: 10 });
  });

  it('con più di 2 membri non si può scegliere la stessa persona', () => {
    render(<SaldoTricount householdId="h1" members={[fabio, anna, luca]} saldoEsistente={null} />);
    fireEvent.change(screen.getByLabelText('Chi deve dare'), { target: { value: 'u1' } });
    fireEvent.change(screen.getByLabelText('A chi'), { target: { value: 'u1' } });
    fireEvent.change(screen.getByLabelText('Importo'), { target: { value: '10' } });
    expect(screen.getByRole('button', { name: 'Salva il saldo' })).toBeDisabled();
  });

  it('già inserito: mostra la frase e nessun modulo', () => {
    render(
      <SaldoTricount householdId="h1" members={[fabio, anna]} saldoEsistente={{ creditoreId: 'u2', debitoreId: 'u1', importo: 43 }} />
    );
    expect(document.body.textContent).toContain('Già inserito: Fabio doveva 43 € a Anna.');
    expect(screen.queryByRole('button', { name: 'Salva il saldo' })).toBeNull();
  });

  it('"gia registrato" è tradotto in italiano', async () => {
    vi.mocked(registraSaldoIniziale).mockRejectedValue({ message: 'saldo iniziale gia registrato' });
    render(<SaldoTricount householdId="h1" members={[fabio, anna]} saldoEsistente={null} />);
    fireEvent.click(screen.getByLabelText('Fabio deve a Anna'));
    fireEvent.change(screen.getByLabelText('Importo'), { target: { value: '43' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salva il saldo' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Il saldo da Tricount è già stato inserito.');
    expect(refresh).toHaveBeenCalled();
  });

  it('un altro errore dà il messaggio generico', async () => {
    vi.mocked(registraSaldoIniziale).mockRejectedValue({ message: 'boom' });
    render(<SaldoTricount householdId="h1" members={[fabio, anna]} saldoEsistente={null} />);
    fireEvent.click(screen.getByLabelText('Fabio deve a Anna'));
    fireEvent.change(screen.getByLabelText('Importo'), { target: { value: '43' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salva il saldo' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Salvataggio fallito, controlla la connessione e riprova.');
    expect(refresh).not.toHaveBeenCalled();
  });
});
