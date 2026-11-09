import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ControlloSaldo } from '@/app/casa/ControlloSaldo';
import { assertNessunaParolaVietata } from './helpers/paroleVietate';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh, push: vi.fn() }) }));
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }));
vi.mock('@/lib/data/balanceChecks', async () => ({
  ...(await vi.importActual<typeof import('@/lib/data/balanceChecks')>('@/lib/data/balanceChecks')),
  recordBalanceCheck: vi.fn(),
}));
import { recordBalanceCheck } from '@/lib/data/balanceChecks';

const conto = { id: 'ac-casa', nome: 'Conto comune', saldoAttuale: 1020, contaInDisponibile: true, targetSaldo: null };

function monta(conti = [conto], onFatto = vi.fn()) {
  const utente = render(<ControlloSaldo conti={conti} onFatto={onFatto} />);
  return { ...utente, onFatto };
}
const scrivi = (v: string) => fireEvent.change(screen.getByLabelText("Quanto c'è davvero sul conto comune?"), { target: { value: v } });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-09T10:00:00Z'));
  refresh.mockReset();
  vi.mocked(recordBalanceCheck).mockReset();
  vi.mocked(recordBalanceCheck).mockResolvedValue('b1');
});
afterEach(() => vi.useRealTimers());

describe('ControlloSaldo', () => {
  it('mostra il saldo dell app e la differenza, registra una volta sola e conferma', async () => {
    const { container, onFatto } = monta();
    expect(screen.getByText("Per l'app c'è: 1.020 €")).toBeInTheDocument();
    scrivi('940');
    expect(screen.getByText('Mancano 80 €. Succede: nessuno ricorda ogni spesa.')).toBeInTheDocument();
    assertNessunaParolaVietata(container);
    const bottone = screen.getByRole('button', { name: 'Segna come spese non registrate' });
    fireEvent.click(bottone);
    fireEvent.click(bottone);
    await waitFor(() => expect(screen.getByText('Fatto. Il saldo ora è 940 €.')).toBeInTheDocument());
    expect(recordBalanceCheck).toHaveBeenCalledTimes(1);
    expect(vi.mocked(recordBalanceCheck).mock.calls[0][1]).toEqual({
      accountId: 'ac-casa',
      saldoDichiarato: 940,
      data: '2026-11-09',
      creaMovimento: true,
    });
    expect(refresh).toHaveBeenCalled();
    expect(onFatto).toHaveBeenCalled();
    assertNessunaParolaVietata(container);
  });

  it('mostra Oggi e permette di cambiare la data', async () => {
    monta();
    expect(screen.getByText(/^Oggi/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Data')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cambia data' }));
    fireEvent.change(screen.getByLabelText('Data'), { target: { value: '2026-11-05' } });
    scrivi('940');
    fireEvent.click(screen.getByRole('button', { name: 'Segna come spese non registrate' }));
    await waitFor(() => expect(recordBalanceCheck).toHaveBeenCalled());
    expect(vi.mocked(recordBalanceCheck).mock.calls[0][1].data).toBe('2026-11-05');
  });

  it('migliaia all italiana: 1.020 vale 1020', async () => {
    monta();
    scrivi('1.020');
    expect(screen.getByText('Torna tutto.')).toBeInTheDocument();
  });

  it('virgola decimale', async () => {
    monta();
    scrivi('940,5');
    fireEvent.click(screen.getByRole('button', { name: 'Segna come spese non registrate' }));
    await waitFor(() => expect(recordBalanceCheck).toHaveBeenCalled());
    expect(vi.mocked(recordBalanceCheck).mock.calls[0][1].saldoDichiarato).toBe(940.5);
  });

  it('torna tutto', async () => {
    monta();
    scrivi('1020,4');
    expect(screen.getByText('Torna tutto.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Fatto' }));
    await waitFor(() => expect(recordBalanceCheck).toHaveBeenCalled());
    expect(vi.mocked(recordBalanceCheck).mock.calls[0][1]).toMatchObject({ saldoDichiarato: 1020.4, creaMovimento: true });
  });

  it('in più', async () => {
    const { container } = monta();
    scrivi('1100');
    expect(screen.getByText('In banca ci sono 80 € in più di quelli registrati.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ho dimenticato un versamento' })).toHaveAttribute('href', '/casa');
    fireEvent.click(screen.getByRole('button', { name: 'Segna come entrata non registrata' }));
    await waitFor(() => expect(recordBalanceCheck).toHaveBeenCalled());
    expect(vi.mocked(recordBalanceCheck).mock.calls[0][1]).toMatchObject({ saldoDichiarato: 1100, creaMovimento: true });
    assertNessunaParolaVietata(container);
  });

  it('mancano: la via per tornare indietro', () => {
    monta();
    scrivi('940');
    expect(screen.getByRole('link', { name: 'Ho dimenticato di registrare qualcosa' })).toHaveAttribute('href', '/casa');
    fireEvent.click(screen.getByRole('button', { name: 'Come si calcola?' }));
    expect(screen.getByText("In banca meno quello che risulta nell'app.")).toBeInTheDocument();
    expect(screen.getByText('Differenza')).toBeInTheDocument();
  });

  it('vuoto, abc e -5 non permettono di registrare, zero sì; mai NaN', () => {
    const { container } = monta();
    const registra = () => screen.getByRole('button', { name: /Segna come|Fatto/ });
    for (const v of ['', 'abc', '-5']) {
      scrivi(v);
      expect(registra()).toBeDisabled();
      expect(container).not.toHaveTextContent('NaN');
    }
    scrivi('0');
    expect(registra()).not.toBeDisabled();
    expect(container).not.toHaveTextContent('NaN');
  });

  it('errore: messaggio neutro e il valore resta', async () => {
    vi.mocked(recordBalanceCheck).mockRejectedValue(new Error('boom'));
    monta();
    scrivi('940');
    fireEvent.click(screen.getByRole('button', { name: 'Segna come spese non registrate' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Salvataggio fallito'));
    expect(screen.getByLabelText("Quanto c'è davvero sul conto comune?")).toHaveValue('940');
    expect(refresh).not.toHaveBeenCalled();
  });

  it('due conti: un selettore', () => {
    monta([conto, { ...conto, id: 'ac2', nome: 'Risparmi', saldoAttuale: 50 }]);
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'ac2' } });
    expect(screen.getByText("Per l'app c'è: 50 €")).toBeInTheDocument();
  });

  it('nessun conto', () => {
    const { container } = monta([]);
    expect(screen.getByRole('link', { name: 'Aggiungete prima il conto comune dalla pagina Casa.' })).toHaveAttribute('href', '/casa');
    assertNessunaParolaVietata(container);
  });

  it('la data è oggi a Roma anche a cavallo della mezzanotte', async () => {
    vi.setSystemTime(new Date('2026-10-31T23:30:00Z'));
    monta();
    scrivi('940');
    fireEvent.click(screen.getByRole('button', { name: 'Segna come spese non registrate' }));
    await waitFor(() => expect(recordBalanceCheck).toHaveBeenCalled());
    expect(vi.mocked(recordBalanceCheck).mock.calls[0][1].data).toBe('2026-11-01');
  });
});
