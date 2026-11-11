import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

const iscrivi = vi.hoisted(() => vi.fn());
const ambiente = vi.hoisted(() => vi.fn());
const rispondi = vi.hoisted(() => vi.fn());

vi.mock('@/lib/iscriviNotifiche', () => ({
  iscriviNotifiche: (...a: unknown[]) => iscrivi(...a),
  ambienteNotifiche: () => ambiente(),
}));
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ client: true }) }));
vi.mock('@/lib/data/notifiche', () => ({ rispondiNotifiche: (...a: unknown[]) => rispondi(...a) }));

import { SchedaNotifiche } from '@/app/home/SchedaNotifiche';
import { Notifiche } from '@/app/altro/Notifiche';
import { assertNessunaParolaVietata } from './helpers/paroleVietate';

beforeEach(() => {
  iscrivi.mockReset().mockResolvedValue('attive');
  rispondi.mockReset().mockResolvedValue(undefined);
  ambiente.mockReset().mockReturnValue('installata');
});

describe('SchedaNotifiche in Home', () => {
  it('è nascosta se la risposta c è già (true o false)', () => {
    const a = render(<SchedaNotifiche chiavePubblica="K" notificheAttive={true} />);
    expect(a.container).toBeEmptyDOMElement();
    a.unmount();
    const b = render(<SchedaNotifiche chiavePubblica="K" notificheAttive={false} />);
    expect(b.container).toBeEmptyDOMElement();
  });

  it('con l app installata chiede e mostra i due pulsanti', () => {
    const { container } = render(<SchedaNotifiche chiavePubblica="K" notificheAttive={null} />);
    expect(screen.getByText(/Vuoi che ti avvisi se resti indietro con le spese\?/)).toBeInTheDocument();
    expect(screen.getByText(/Al massimo una volta ogni tre giorni, mai di notte/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sì, avvisami' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'No, grazie' })).toBeInTheDocument();
    assertNessunaParolaVietata(container);
  });

  it('in Safari su iPhone spiega come installare e non ha pulsanti di permesso', () => {
    ambiente.mockReturnValue('ios_da_installare');
    render(<SchedaNotifiche chiavePubblica="K" notificheAttive={null} />);
    expect(screen.getByText(/aggiungi l'app alla schermata Home/)).toBeInTheDocument();
    expect(screen.getByText(/Aggiungi alla schermata Home/)).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
    expect(iscrivi).not.toHaveBeenCalled();
  });

  it('senza supporto o senza chiave non compare', () => {
    ambiente.mockReturnValue('non_supportate');
    const a = render(<SchedaNotifiche chiavePubblica="K" notificheAttive={null} />);
    expect(a.container).toBeEmptyDOMElement();
    a.unmount();
    ambiente.mockReturnValue('installata');
    const b = render(<SchedaNotifiche chiavePubblica={null} notificheAttive={null} />);
    expect(b.container).toBeEmptyDOMElement();
  });

  it('"Sì" passa la chiave a iscriviNotifiche e conferma', async () => {
    render(<SchedaNotifiche chiavePubblica="CHIAVE" notificheAttive={null} />);
    fireEvent.click(screen.getByRole('button', { name: 'Sì, avvisami' }));
    expect(iscrivi).toHaveBeenCalledWith('CHIAVE');
    expect(await screen.findByText(/Fatto/)).toBeInTheDocument();
  });

  it('se il telefono nega, la scheda sparisce', async () => {
    iscrivi.mockResolvedValue('negate');
    const { container } = render(<SchedaNotifiche chiavePubblica="K" notificheAttive={null} />);
    fireEvent.click(screen.getByRole('button', { name: 'Sì, avvisami' }));
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it('"No, grazie" risponde false senza chiedere il permesso', async () => {
    const { container } = render(<SchedaNotifiche chiavePubblica="K" notificheAttive={null} />);
    fireEvent.click(screen.getByRole('button', { name: 'No, grazie' }));
    expect(rispondi).toHaveBeenCalledWith({ client: true }, false);
    expect(iscrivi).not.toHaveBeenCalled();
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it('se l iscrizione fallisce dice cosa fare', async () => {
    iscrivi.mockRejectedValue(new Error('x'));
    render(<SchedaNotifiche chiavePubblica="K" notificheAttive={null} />);
    fireEvent.click(screen.getByRole('button', { name: 'Sì, avvisami' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/Riprova/);
  });
});

describe('Notifiche in Altro', () => {
  it('ha id notifiche ed è sempre visibile, con lo stato attivo', () => {
    const { container } = render(<Notifiche chiavePubblica="K" notificheAttive={true} />);
    expect(container.querySelector('#notifiche')).not.toBeNull();
    expect(screen.getByText(/Promemoria attivi/)).toBeInTheDocument();
    assertNessunaParolaVietata(container);
  });

  it('da spente si possono riattivare', async () => {
    render(<Notifiche chiavePubblica="K" notificheAttive={false} />);
    expect(screen.getByText(/Promemoria spenti/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Attiva i promemoria' }));
    expect(iscrivi).toHaveBeenCalledWith('K');
    expect(await screen.findByText(/Promemoria attivi/)).toBeInTheDocument();
  });

  it('su iPhone in Safari spiega come installare', () => {
    ambiente.mockReturnValue('ios_da_installare');
    render(<Notifiche chiavePubblica="K" notificheAttive={null} />);
    expect(screen.getByText(/aggiungi l'app alla schermata Home/)).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('senza supporto lo dice', () => {
    ambiente.mockReturnValue('non_supportate');
    render(<Notifiche chiavePubblica="K" notificheAttive={null} />);
    expect(screen.getByText(/non supporta i promemoria/)).toBeInTheDocument();
  });
});
