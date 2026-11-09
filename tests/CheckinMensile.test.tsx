import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CheckinMensile } from '@/app/casa/controllo/CheckinMensile';
import type { CheckinCaricato } from '@/lib/loadCheckin';
import { computeCheckin } from '@/lib/calculations/casa/checkin';
import type { PlanBundle } from '@/lib/data/householdPlans';
import type { Transaction } from '@/lib/types';
import { assertNessunaParolaVietata } from './helpers/paroleVietate';

const push = vi.fn();
const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh }) }));
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }));
vi.mock('@/lib/data/checkins', async () => ({
  ...(await vi.importActual<typeof import('@/lib/data/checkins')>('@/lib/data/checkins')),
  saveCheckin: vi.fn(),
  getCheckin: vi.fn(),
}));
vi.mock('@/lib/data/balanceChecks', async () => ({
  ...(await vi.importActual<typeof import('@/lib/data/balanceChecks')>('@/lib/data/balanceChecks')),
  recordBalanceCheck: vi.fn().mockResolvedValue('b1'),
}));
import { CheckinGiaFattoError, getCheckin, saveCheckin } from '@/lib/data/checkins';
import { recordBalanceCheck } from '@/lib/data/balanceChecks';

const conto = { id: 'ac', nome: 'Conto comune', saldoAttuale: 1000, contaInDisponibile: true, targetSaldo: null };

// I numeri vengono sempre da computeCheckin, mai scritti a mano.
interface Scenario {
  versato?: [number, number];
  speso?: number;
  nonRegistrate?: number;
  precedente?: 'ammanco' | null;
}
function scenario({ versato = [776, 604], speso = 1161, nonRegistrate = 80, precedente = null }: Scenario = {}) {
  const righe = (atteso: number, v: number) => [{ mese: '2026-10-01', atteso, versato: v, mancano: Math.max(0, atteso - v) }];
  const spese = [
    { tipo: 'expense', data: '2026-10-12', importo: speso, origine: null, goalId: null },
    ...(nonRegistrate > 0 ? [{ tipo: 'expense', data: '2026-10-20', importo: nonRegistrate, origine: 'riconciliazione', goalId: null }] : []),
  ] as unknown as Transaction[];
  const calcolo = computeCheckin({
    mese: '2026-10-01',
    righePerMembro: { u1: righe(776, versato[0]), u2: righe(604, versato[1]) },
    piano: { items: [{ frequenzaMesi: 1, importoMensile: 1288, goalId: null }] } as unknown as PlanBundle,
    spese,
    precedente: precedente ? { esito: precedente } : null,
  });
  const versamenti = [
    { userId: 'u1', nome: 'Fabio', atteso: 776, versato: versato[0] },
    { userId: 'u2', nome: 'Anna', atteso: 604, versato: versato[1] },
  ];
  return { calcolo, versamenti };
}

function dati(extra: Partial<CheckinCaricato> = {}): CheckinCaricato {
  return {
    stato: 'da_fare',
    householdId: 'h1',
    mese: '2026-10-01',
    calcolo: scenario().calcolo,
    fatto: null,
    chi: null,
    cuscinetto: { attuale: 59, obiettivo: 1321, quotaMensile: 59 },
    conti: [conto],
    fondiPerAvanzo: [
      { id: 'g1', nome: 'Vacanza estiva', importoTarget: 500, modalita: 'bloccato', scadenza: null, categoriaId: null, ricorrente: false, frequenzaMesi: null, stato: 'aperto', createdAt: '', accantonaDa: null },
    ],
    nomi: { u1: 'Fabio', u2: 'Anna' },
    versamenti: scenario().versamenti,
    serveControllo: false,
    ...extra,
  };
}

const base = {
  householdId: 'h1',
  mese: '2026-10-01',
  attesoTotale: 1380,
  versatoTotale: 1380,
  previstoMensili: 1288,
  spesoMensili: 1161,
  nonRegistrate: 80,
  avanzo: 47,
};

beforeEach(() => {
  push.mockReset();
  refresh.mockReset();
  vi.mocked(saveCheckin).mockReset();
  vi.mocked(saveCheckin).mockResolvedValue('c1');
  vi.mocked(getCheckin).mockReset();
});

describe('CheckinMensile', () => {
  it('mostra titolo, versamenti, spese, cuscinetto e come si calcola', () => {
    const { container } = render(<CheckinMensile dati={dati()} />);
    expect(screen.getByRole('heading', { name: 'Ottobre in casa' })).toBeInTheDocument();
    expect(screen.getByText('Fabio 776 di 776')).toBeInTheDocument();
    expect(screen.getByText('Anna 604 di 604')).toBeInTheDocument();
    expect(screen.getByText('Spese del mese: previste 1.288 €, registrate 1.161 €, non registrate 80 €')).toBeInTheDocument();
    expect(screen.getByText('Cuscinetto 59 di 1.321 €')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Come si calcola?' }));
    expect(screen.getByText('Versamenti ricevuti')).toBeInTheDocument();
    assertNessunaParolaVietata(container);
  });

  it('avanzo: cuscinetto già scelto, Fatto è un solo tocco', async () => {
    render(<CheckinMensile dati={dati()} />);
    expect(screen.getByText('In avanzo di 47 €. Cosa ne facciamo?')).toBeInTheDocument();
    expect(screen.getByLabelText('Lasciamoli al cuscinetto')).toBeChecked();
    expect(screen.queryByText('Mettiamoli da parte per…')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Fatto, a novembre' }));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/casa'));
    expect(saveCheckin).toHaveBeenCalledTimes(1);
    expect(vi.mocked(saveCheckin).mock.calls[0][1]).toEqual({ ...base, destinazione: 'cuscinetto' });
  });

  it('dietro "Altro": un fondo oppure una cosa nuova', async () => {
    render(<CheckinMensile dati={dati()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Altro' }));
    expect(screen.getByText('Mettiamoli da parte per…')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Vacanza estiva'));
    fireEvent.click(screen.getByRole('button', { name: 'Fatto, a novembre' }));
    await waitFor(() => expect(saveCheckin).toHaveBeenCalledTimes(1));
    expect(vi.mocked(saveCheckin).mock.calls[0][1]).toEqual({ ...base, destinazione: 'da_parte', goalId: 'g1' });
  });

  it('una cosa nuova vuole il nome', async () => {
    render(<CheckinMensile dati={dati()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Altro' }));
    fireEvent.click(screen.getByLabelText('Una cosa nuova'));
    expect(screen.getByRole('button', { name: 'Fatto, a novembre' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Nome della cosa nuova'), { target: { value: 'Vacanza' } });
    fireEvent.click(screen.getByRole('button', { name: 'Fatto, a novembre' }));
    await waitFor(() => expect(saveCheckin).toHaveBeenCalledTimes(1));
    expect(vi.mocked(saveCheckin).mock.calls[0][1]).toEqual({ ...base, destinazione: 'da_parte', nuovaCosa: 'Vacanza' });
  });

  it('ammanco per spese sopra il previsto: neutro, nessuna scelta, destinazione assente', async () => {
    const { calcolo, versamenti } = scenario({ speso: 1370, nonRegistrate: 0 });
    expect(calcolo.avanzo).toBe(-82);
    const { container } = render(<CheckinMensile dati={dati({ calcolo, versamenti })} />);
    expect(screen.getByText('Sono usciti 82 € più del previsto. Li prendiamo dal cuscinetto.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Lasciamoli al cuscinetto')).not.toBeInTheDocument();
    expect(screen.queryByText(/quota è un po/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Fatto, a novembre' }));
    await waitFor(() => expect(saveCheckin).toHaveBeenCalledTimes(1));
    expect(vi.mocked(saveCheckin).mock.calls[0][1]).toEqual({ ...base, avanzo: -82, spesoMensili: 1370, nonRegistrate: 0 });
    assertNessunaParolaVietata(container);
  });

  it('ammanco per versamenti mancanti: la causa e quanto si prende dal cuscinetto', () => {
    const { calcolo, versamenti } = scenario({ versato: [676, 604] });
    expect(calcolo.avanzo).toBe(-53);
    const { container } = render(<CheckinMensile dati={dati({ calcolo, versamenti })} />);
    expect(
      screen.getByText('Mancano 100 € di versamenti. Il mese chiude 53 € sotto il previsto: li prendiamo dal cuscinetto.')
    ).toBeInTheDocument();
    assertNessunaParolaVietata(container);
  });

  it('ammanco per versamenti mancanti, importi uguali: una frase sola', () => {
    const { calcolo, versamenti } = scenario({ versato: [746, 604], speso: 1161, nonRegistrate: 127 });
    expect(calcolo.avanzo).toBe(-30);
    const { container } = render(<CheckinMensile dati={dati({ calcolo, versamenti })} />);
    expect(screen.getByText('Mancano 30 € di versamenti. Li prendiamo dal cuscinetto.')).toBeInTheDocument();
    assertNessunaParolaVietata(container);
  });

  it('ammanco con tutte e due le cause: frase generica', () => {
    const { calcolo, versamenti } = scenario({ versato: [726, 604], speso: 1300, nonRegistrate: 0 });
    expect(calcolo.avanzo).toBe(-62);
    const { container } = render(<CheckinMensile dati={dati({ calcolo, versamenti })} />);
    expect(screen.getByText('Il mese chiude 62 € sotto il previsto. Li prendiamo dal cuscinetto.')).toBeInTheDocument();
    assertNessunaParolaVietata(container);
  });

  it('in pari', () => {
    const { calcolo, versamenti } = scenario({ speso: 1208, nonRegistrate: 80 });
    expect(calcolo.esito).toBe('in_pari');
    render(<CheckinMensile dati={dati({ calcolo, versamenti })} />);
    expect(screen.getByText('Tutto è andato come previsto.')).toBeInTheDocument();
  });

  it('secondo ammanco: la stima sta dopo Fatto, con il link alle stime reali', () => {
    const { calcolo, versamenti } = scenario({ speso: 1370, nonRegistrate: 0, precedente: 'ammanco' });
    expect(calcolo.secondoAmmanco).toBe(true);
    render(<CheckinMensile dati={dati({ calcolo, versamenti })} />);
    const testo = screen.getByText("È il secondo mese: forse la quota è un po' bassa. Non è colpa di nessuno.");
    expect(screen.getByRole('link', { name: 'Guarda le stime reali' })).toHaveAttribute('href', '/casa/quota');
    const fatto = screen.getByRole('button', { name: 'Fatto, a novembre' });
    expect(fatto.compareDocumentPosition(testo) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('passo 0: il controllo del saldo si può saltare', () => {
    render(<CheckinMensile dati={dati({ serveControllo: true })} />);
    expect(screen.getByText("Quanto c'è davvero sul conto comune?")).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Fatto, a novembre' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Salta' }));
    expect(screen.getByRole('button', { name: 'Fatto, a novembre' })).toBeInTheDocument();
  });

  it('passo 0: dopo il controllo si passa oltre', async () => {
    render(<CheckinMensile dati={dati({ serveControllo: true })} />);
    fireEvent.change(screen.getByLabelText("Quanto c'è davvero sul conto comune?"), { target: { value: '1000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Fatto' }));
    await waitFor(() => expect(recordBalanceCheck).toHaveBeenCalled());
    expect(await screen.findByRole('button', { name: 'Fatto, a novembre' })).toBeInTheDocument();
  });

  it('senza passo 0 il controllo non compare', () => {
    render(<CheckinMensile dati={dati()} />);
    expect(screen.queryByText("Quanto c'è davvero sul conto comune?")).not.toBeInTheDocument();
  });

  it('già fatto da altri: ricarica e mostra "Fatto da ..." senza messaggio transitorio', async () => {
    vi.mocked(saveCheckin).mockRejectedValue(new CheckinGiaFattoError());
    const fatto = dati({
      stato: 'fatto', calcolo: null, chi: 'Anna',
      fatto: {
        id: 'c1', householdId: 'h1', mese: '2026-10-01', userId: 'u2', createdAt: '2026-11-02T09:00:00Z',
        attesoTotale: 1380, versatoTotale: 1380, previstoMensili: 1288, spesoMensili: 1161, nonRegistrate: 80,
        avanzo: 47, esito: 'avanzo', destinazioneAvanzo: 'cuscinetto', goalId: null,
      },
    });
    const { rerender } = render(<CheckinMensile dati={dati()} />);
    // Il ricaricamento della pagina porta i dati nuovi dal server.
    refresh.mockImplementation(() => rerender(<CheckinMensile dati={fatto} />));
    fireEvent.click(screen.getByRole('button', { name: 'Fatto, a novembre' }));
    expect(await screen.findByText('Fatto da Anna il 2 novembre.')).toBeInTheDocument();
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/è già stato fatto/)).not.toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it('un altro errore ha la sua frase', async () => {
    vi.mocked(saveCheckin).mockRejectedValue(new Error('boom'));
    render(<CheckinMensile dati={dati()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Fatto, a novembre' }));
    expect(await screen.findByText('Salvataggio fallito, controlla la connessione e riprova.')).toBeInTheDocument();
  });

  it('un doppio tocco su Fatto fa una sola chiamata', () => {
    vi.mocked(saveCheckin).mockReturnValue(new Promise(() => {}));
    render(<CheckinMensile dati={dati()} />);
    const b = screen.getByRole('button', { name: 'Fatto, a novembre' });
    fireEvent.click(b);
    fireEvent.click(b);
    expect(saveCheckin).toHaveBeenCalledTimes(1);
  });

  it('stato fatto: dal record, non ricalcolato', () => {
    const { container } = render(
      <CheckinMensile
        dati={dati({
          stato: 'fatto',
          calcolo: null,
          chi: 'Fabio',
          fatto: {
            id: 'c1', householdId: 'h1', mese: '2026-10-01', userId: 'u1', createdAt: '2026-11-02T09:00:00Z',
            attesoTotale: 1380, versatoTotale: 1300, previstoMensili: 1288, spesoMensili: 1161, nonRegistrate: 80,
            avanzo: 47, esito: 'avanzo', destinazioneAvanzo: 'cuscinetto', goalId: null,
          },
        })}
      />
    );
    expect(screen.getByText('Fatto da Fabio il 2 novembre.')).toBeInTheDocument();
    expect(screen.getByText('Versamenti: 1.300 di 1.380 €')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Fatto, a/ })).not.toBeInTheDocument();
    assertNessunaParolaVietata(container);
  });

  it('nessun mese: spiega e torna alla casa', () => {
    const { container } = render(<CheckinMensile dati={dati({ stato: 'nessun_mese', mese: null, calcolo: null })} />);
    expect(screen.getByText('Il check-in parte dal primo mese intero con la quota attiva.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Torna alla casa' })).toHaveAttribute('href', '/casa');
    assertNessunaParolaVietata(container);
  });
});
