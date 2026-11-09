import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CalendarioCasa } from '@/app/casa/impostazioni/CalendarioCasa';
import { assertNessunaParolaVietata } from './helpers/paroleVietate';
import type { CalendarFeed } from '@/lib/types';

vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }));

const rotateCalendarFeed = vi.fn();
const revokeCalendarFeed = vi.fn();
vi.mock('@/lib/data/calendarFeeds', () => ({
  rotateCalendarFeed: (...a: unknown[]) => rotateCalendarFeed(...a),
  revokeCalendarFeed: (...a: unknown[]) => revokeCalendarFeed(...a),
}));

const ORIGIN = 'https://budget.example';
const feed: CalendarFeed = {
  id: 'f1',
  householdId: 'h1',
  userId: 'u1',
  token: 'vecchiotoken',
  createdAt: '2026-11-01T00:00:00Z',
  revocatoIl: null,
};

const campo = () => screen.getByLabelText('Link del calendario') as HTMLInputElement;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('CalendarioCasa', () => {
  it('senza feed mostra Crea il link', async () => {
    rotateCalendarFeed.mockResolvedValue('nuovotoken');
    render(<CalendarioCasa feedIniziale={null} origin={ORIGIN} />);
    expect(screen.queryByLabelText('Link del calendario')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Crea il link' }));
    await waitFor(() => expect(campo().value).toBe(`${ORIGIN}/api/calendario/nuovotoken`));
  });

  it('Rigenera mostra subito il nuovo link e non quello vecchio', async () => {
    rotateCalendarFeed.mockResolvedValue('nuovotoken');
    render(<CalendarioCasa feedIniziale={feed} origin={ORIGIN} />);
    expect(campo().value).toBe(`${ORIGIN}/api/calendario/vecchiotoken`);
    fireEvent.click(screen.getByRole('button', { name: 'Rigenera' }));
    expect(rotateCalendarFeed).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Sì, rigenera' }));
    await waitFor(() => expect(campo().value).toBe(`${ORIGIN}/api/calendario/nuovotoken`));
    expect(campo().value).not.toContain('vecchiotoken');
  });

  it('Revoca toglie il link e torna a Crea il link', async () => {
    revokeCalendarFeed.mockResolvedValue(undefined);
    render(<CalendarioCasa feedIniziale={feed} origin={ORIGIN} />);
    fireEvent.click(screen.getByRole('button', { name: 'Revoca' }));
    expect(revokeCalendarFeed).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Sì, revoca' }));
    expect(await screen.findByRole('button', { name: 'Crea il link' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Link del calendario')).not.toBeInTheDocument();
  });

  it('Copia usa la clipboard e con clipboard che lancia non rompe la pagina', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(<CalendarioCasa feedIniziale={feed} origin={ORIGIN} />);
    fireEvent.click(screen.getByRole('button', { name: 'Copia' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(`${ORIGIN}/api/calendario/vecchiotoken`));
    expect(await screen.findByText('Link copiato.')).toBeInTheDocument();

    writeText.mockRejectedValue(new Error('negato'));
    fireEvent.click(screen.getByRole('button', { name: 'Copia' }));
    expect(await screen.findByText(/copialo a mano/)).toBeInTheDocument();
    expect(campo()).toBeInTheDocument();
  });

  it('mostra l avviso "non condividerlo" e quello delle ore di aggiornamento', () => {
    render(<CalendarioCasa feedIniziale={feed} origin={ORIGIN} />);
    expect(
      screen.getByText('Chiunque abbia questo link vede le scadenze della casa: non condividerlo.')
    ).toBeInTheDocument();
    expect(screen.getByText('Può volerci qualche ora perché il calendario si aggiorni.')).toBeInTheDocument();
    expect(screen.getByText(/Da URL/)).toBeInTheDocument();
    expect(screen.getByText(/Aggiungi calendario con abbonamento/)).toBeInTheDocument();
  });

  it('Scarica una volta compare solo con un link attivo', () => {
    const { unmount } = render(<CalendarioCasa feedIniziale={null} origin={ORIGIN} />);
    expect(screen.queryByRole('button', { name: 'Scarica una volta' })).not.toBeInTheDocument();
    unmount();
    render(<CalendarioCasa feedIniziale={feed} origin={ORIGIN} />);
    expect(screen.getByRole('button', { name: 'Scarica una volta' })).toBeInTheDocument();
  });

  it('nessuna parola vietata', () => {
    const { container, unmount } = render(<CalendarioCasa feedIniziale={null} origin={ORIGIN} />);
    assertNessunaParolaVietata(container);
    unmount();
    const { container: c2 } = render(<CalendarioCasa feedIniziale={feed} origin={ORIGIN} />);
    assertNessunaParolaVietata(c2);
  });

  it('errore di rete mostra il messaggio standard', async () => {
    rotateCalendarFeed.mockRejectedValue(new Error('rete'));
    render(<CalendarioCasa feedIniziale={null} origin={ORIGIN} />);
    fireEvent.click(screen.getByRole('button', { name: 'Crea il link' }));
    expect(
      await screen.findByText('Salvataggio fallito, controlla la connessione e riprova.')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Crea il link' })).toBeInTheDocument();
  });
});
