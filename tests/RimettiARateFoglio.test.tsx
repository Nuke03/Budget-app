import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AnnullaProvider } from '@/app/AnnullaProvider';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh, push: vi.fn() }), usePathname: () => '/x' }));
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }));
vi.mock('@/lib/data/rientri', () => ({ creaRientro: vi.fn(), eliminaRientro: vi.fn() }));
import { creaRientro, eliminaRientro } from '@/lib/data/rientri';
import { RimettiARateFoglio, type DestinazioneRientro } from '@/app/rientri/RimettiARateFoglio';
import { assertNessunaParolaVietata } from './helpers/paroleVietate';

const destinazioni: DestinazioneRientro[] = [
  { tipo: 'conto', id: 'c1', nome: 'Risparmio' },
  { tipo: 'cassetto', id: 'g1', nome: 'Vacanza', spesoDaRientrare: 300 },
  { tipo: 'cassetto-casa', id: 'g2', nome: 'Bollette', householdId: 'h1' },
];

function monta(over: Partial<React.ComponentProps<typeof RimettiARateFoglio>> = {}) {
  const onFatto = vi.fn();
  const r = render(
    <AnnullaProvider>
      <RimettiARateFoglio destinazioni={destinazioni} onFatto={onFatto} onClose={vi.fn()} {...over} />
    </AnnullaProvider>
  );
  return { ...r, onFatto };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-20T10:00:00Z'));
  refresh.mockReset();
  vi.mocked(creaRientro).mockReset().mockResolvedValue('nuovo');
  vi.mocked(eliminaRientro).mockReset().mockResolvedValue(undefined);
});
afterEach(() => vi.useRealTimers());

describe('RimettiARateFoglio', () => {
  it('un passo alla volta: dove, quanto, quanti mesi; crea con i valori scelti', async () => {
    const { container, onFatto } = monta();
    fireEvent.click(screen.getByRole('radio', { name: 'Risparmio' }));
    fireEvent.change(screen.getByLabelText('Quanto?'), { target: { value: '300' } });
    fireEvent.click(screen.getByRole('button', { name: 'Avanti' }));
    expect(screen.getByText('100 € al mese, da novembre 2026 a gennaio 2027.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: '6 mesi' }));
    expect(screen.getByText('50 € al mese, da novembre 2026 ad aprile 2027.')).toBeInTheDocument();
    assertNessunaParolaVietata(container);
    expect(container.textContent!.toLowerCase()).not.toMatch(/autorata|debito|rimborso/);
    fireEvent.click(screen.getByRole('radio', { name: '3 mesi' }));
    fireEvent.click(screen.getByRole('button', { name: 'Rimetti a rate' }));
    await waitFor(() => expect(onFatto).toHaveBeenCalled());
    expect(creaRientro).toHaveBeenCalledTimes(1);
    expect(vi.mocked(creaRientro).mock.calls[0][1]).toEqual({
      goalId: null, accountId: 'c1', importo: 300, mesi: 3, creatoIl: '2026-11-20',
    });
    expect(await screen.findByText('Rientro creato.')).toBeInTheDocument();
  });

  it('doppio tocco: una sola creazione', async () => {
    monta({ scelta: 'g1' });
    fireEvent.click(screen.getByRole('button', { name: 'Avanti' }));
    const b = screen.getByRole('button', { name: 'Rimetti a rate' });
    fireEvent.click(b);
    fireEvent.click(b);
    await waitFor(() => expect(creaRientro).toHaveBeenCalledTimes(1));
  });

  it('un cassetto scelto parte dal quanto speso e si crea come cassetto', async () => {
    monta({ scelta: 'g1' });
    expect(screen.getByLabelText('Quanto?')).toHaveValue('300');
    fireEvent.click(screen.getByRole('button', { name: 'Avanti' }));
    fireEvent.click(screen.getByRole('button', { name: 'Rimetti a rate' }));
    await waitFor(() => expect(creaRientro).toHaveBeenCalled());
    expect(vi.mocked(creaRientro).mock.calls[0][1]).toMatchObject({ goalId: 'g1', accountId: null, importo: 300 });
  });

  it('cassetto di casa: etichetta Casa, nota, scope della casa', async () => {
    monta({ notaCasa: 'Lo vedrà anche Miriam.' });
    fireEvent.click(screen.getByRole('radio', { name: 'Bollette · Casa' }));
    fireEvent.change(screen.getByLabelText('Quanto?'), { target: { value: '90' } });
    fireEvent.click(screen.getByRole('button', { name: 'Avanti' }));
    expect(screen.getByText('Lo vedrà anche Miriam.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Rimetti a rate' }));
    await waitFor(() => expect(creaRientro).toHaveBeenCalled());
    expect(vi.mocked(creaRientro).mock.calls[0][2]).toMatchObject({ householdId: 'h1' });
  });

  it('senza destinazioni: frase e link Metti da parte', () => {
    monta({ destinazioni: [] });
    expect(screen.getByText("Non c'è ancora un conto risparmio o un cassetto.")).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Metti da parte' })).toHaveAttribute('href', '/goals?nuovo=1');
  });

  it('se la scrittura fallisce lo dice e non chiude', async () => {
    vi.mocked(creaRientro).mockRejectedValue(new Error('x'));
    const { onFatto } = monta({ scelta: 'g1' });
    fireEvent.click(screen.getByRole('button', { name: 'Avanti' }));
    fireEvent.click(screen.getByRole('button', { name: 'Rimetti a rate' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(onFatto).not.toHaveBeenCalled();
  });

  it('Annulla toglie il rientro appena creato', async () => {
    monta({ scelta: 'g1' });
    fireEvent.click(screen.getByRole('button', { name: 'Avanti' }));
    fireEvent.click(screen.getByRole('button', { name: 'Rimetti a rate' }));
    fireEvent.click(await screen.findByRole('button', { name: /Annulla/ }));
    await waitFor(() => expect(eliminaRientro).toHaveBeenCalledWith(expect.anything(), 'nuovo'));
  });
});
