import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DomandaRientroFoglio } from '@/app/rientri/DomandaRientroFoglio';
import { assertNessunaParolaVietata } from './helpers/paroleVietate';

const refresh = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh, push: vi.fn() }) }));
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }));
const creaRientro = vi.hoisted(() => vi.fn());
vi.mock('@/lib/data/rientri', () => ({ creaRientro: (...a: unknown[]) => creaRientro(...a) }));

function apri() {
  const onChiudi = vi.fn();
  const r = render(
    <DomandaRientroFoglio importo={300} conto={{ id: 'risp', nome: 'Conto risparmio' }} oggi="2026-11-20" onChiudi={onChiudi} />
  );
  return { onChiudi, ...r };
}

beforeEach(() => {
  vi.clearAllMocks();
  creaRientro.mockResolvedValue('r1');
});

describe('DomandaRientroFoglio', () => {
  it('mostra titolo, frase e rata di 3 mesi', () => {
    const { container } = apri();
    expect(screen.getByText("Vuoi rimetterli un po' al mese?")).toBeInTheDocument();
    expect(screen.getByText("Hai preso 300 € dal Conto risparmio. Puoi riportarli lì un po' alla volta.")).toBeInTheDocument();
    expect(screen.getByText('100 € al mese, da novembre 2026 a gennaio 2027.')).toBeInTheDocument();
    assertNessunaParolaVietata(container);
  });

  it('cambiare i mesi cambia la rata', () => {
    apri();
    fireEvent.click(screen.getByRole('radio', { name: '6 mesi' }));
    expect(screen.getByText('50 € al mese, da novembre 2026 ad aprile 2027.')).toBeInTheDocument();
  });

  it('Sì crea il rientro e chiude', async () => {
    const { onChiudi } = apri();
    fireEvent.click(screen.getByRole('button', { name: 'Sì, rimettili' }));
    await waitFor(() => expect(onChiudi).toHaveBeenCalled());
    expect(creaRientro).toHaveBeenCalledWith({}, { goalId: null, accountId: 'risp', importo: 300, mesi: 3, creatoIl: '2026-11-20' });
    expect(refresh).toHaveBeenCalled();
  });

  it('No chiude senza creare nulla', () => {
    const { onChiudi } = apri();
    fireEvent.click(screen.getByRole('button', { name: 'No, va bene così' }));
    expect(onChiudi).toHaveBeenCalled();
    expect(creaRientro).not.toHaveBeenCalled();
  });

  it('errore: messaggio e resta aperta', async () => {
    creaRientro.mockRejectedValue(new Error('x'));
    const { onChiudi } = apri();
    fireEvent.click(screen.getByRole('button', { name: 'Sì, rimettili' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Non sono riuscito a salvarlo. Riprova tra poco.');
    expect(onChiudi).not.toHaveBeenCalled();
  });
});
