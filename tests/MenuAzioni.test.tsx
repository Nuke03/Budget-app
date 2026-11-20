import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MenuAzioni } from '@/app/menu/MenuAzioni';
import { CasaFab } from '@/app/casa/CasaFab';
import { EVENTO_AGGIUNGI } from '@/lib/eventoAggiungi';
import { assertNessunaParolaVietata } from './helpers/paroleVietate';
import type { VociMenu } from '@/app/menu/actions';

const push = vi.hoisted(() => vi.fn());
const leggi = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));
vi.mock('@/app/menu/actions', () => ({ leggiVociMenu: leggi }));
vi.mock('@/app/add/AddTransactionSheet', () => ({
  AddTransactionSheet: ({ aperto }: { aperto: boolean }) => (aperto ? <div>foglio-aggiunta</div> : null),
}));

const g = (id: string, nome: string, quota: number, confermatoMese = 0) => ({ id, nome, quota, confermatoMese });
const voci = (v: Partial<VociMenu>): VociMenu => ({ cassettiARate: [], haCasa: false, contiPersonali: 1, ...v });

function apri(inCasa = false) {
  const onClose = vi.fn();
  const r = render(<MenuAzioni aperto onClose={onClose} inCasa={inCasa} />);
  return { onClose, ...r };
}

function ascolta(gestito: boolean) {
  const visti: unknown[] = [];
  const fn = (e: Event) => {
    const d = (e as CustomEvent).detail;
    visti.push({ ...d });
    if (gestito) d.gestito = true;
  };
  window.addEventListener(EVENTO_AGGIUNGI, fn);
  return { visti, stop: () => window.removeEventListener(EVENTO_AGGIUNGI, fn) };
}

beforeEach(() => {
  push.mockClear();
  leggi.mockReset();
  leggi.mockResolvedValue(voci({}));
});

describe('MenuAzioni', () => {
  it('non rende nulla da chiuso', () => {
    const { container } = render(<MenuAzioni aperto={false} onClose={() => {}} inCasa={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('si apre subito, senza aspettare le voci', () => {
    leggi.mockReturnValue(new Promise(() => {}));
    apri();
    expect(screen.getByRole('dialog', { name: 'Cosa vuoi fare?' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Registra una spesa/ })).toBeInTheDocument();
    expect(screen.queryByText('Versa nel cassetto')).not.toBeInTheDocument();
  });

  it('spesa gestita dalla pagina: niente push', () => {
    const a = ascolta(true);
    const { onClose } = apri();
    fireEvent.click(screen.getByRole('button', { name: 'Registra una spesa' }));
    a.stop();
    expect(onClose).toHaveBeenCalled();
    expect(a.visti).toEqual([{ gestito: false }]);
    expect(push).not.toHaveBeenCalled();
  });

  it('spesa non gestita: push alla Home', () => {
    const a = ascolta(false);
    apri();
    fireEvent.click(screen.getByRole('button', { name: 'Registra una spesa' }));
    a.stop();
    expect(push).toHaveBeenCalledWith('/?aggiungi=1');
  });

  it('Entrata invia tipo income; non gestita va alla Home', () => {
    const a = ascolta(false);
    apri();
    expect(screen.getByText('Uno stipendio, un rimborso')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Entrata/ }));
    a.stop();
    expect(a.visti).toEqual([{ gestito: false, tipo: 'income' }]);
    expect(push).toHaveBeenCalledWith('/?aggiungi=entrata');
  });

  it('Entrata gestita: niente push', () => {
    const a = ascolta(true);
    apri();
    fireEvent.click(screen.getByRole('button', { name: /Entrata/ }));
    a.stop();
    expect(push).not.toHaveBeenCalled();
  });

  it('Metti da parte e Ci penso su portano alle pagine', () => {
    const { onClose } = apri();
    expect(screen.getByText('Crea un cassetto per una cosa che arriva')).toBeInTheDocument();
    expect(screen.getByText("Lista d'attesa prima di comprare")).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Metti da parte/ }));
    expect(push).toHaveBeenCalledWith('/goals?nuovo=1');
    fireEvent.click(screen.getByRole('button', { name: /Ci penso su/ }));
    expect(push).toHaveBeenCalledWith('/impara/attesa?nuovo=1');
    expect(onClose).toHaveBeenCalled();
  });

  it('un cassetto a rate: Versa nel cassetto porta dritto a lui', async () => {
    leggi.mockResolvedValue(voci({ cassettiARate: [g('g1', 'Vacanza', 100)] }));
    apri();
    const riga = await screen.findByRole('button', { name: /Versa nel cassetto/ });
    expect(screen.getByText('Conferma la rata del mese')).toBeInTheDocument();
    fireEvent.click(riga);
    expect(push).toHaveBeenCalledWith('/goals?versa=g1');
  });

  it('due cassetti: passo "In quale cassetto?" con nomi e rate', async () => {
    leggi.mockResolvedValue(voci({ cassettiARate: [g('g1', 'Vacanza', 100), g('g2', 'Auto', 50.5)] }));
    apri();
    fireEvent.click(await screen.findByRole('button', { name: /Versa nel cassetto/ }));
    expect(push).not.toHaveBeenCalled();
    expect(screen.getByText('In quale cassetto?')).toBeInTheDocument();
    expect(screen.getByText('Vacanza')).toBeInTheDocument();
    expect(screen.getByText(/50,50/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Auto/ }));
    expect(push).toHaveBeenCalledWith('/goals?versa=g2');
  });

  it('Indietro torna al menu', async () => {
    leggi.mockResolvedValue(voci({ cassettiARate: [g('g1', 'Vacanza', 100), g('g2', 'Auto', 50)] }));
    apri();
    fireEvent.click(await screen.findByRole('button', { name: /Versa nel cassetto/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Indietro' }));
    expect(screen.getByRole('button', { name: 'Registra una spesa' })).toBeInTheDocument();
  });

  it('il fuoco segue il cambio di passo', async () => {
    leggi.mockResolvedValue(voci({ cassettiARate: [g('g1', 'Vacanza', 100), g('g2', 'Auto', 50)] }));
    apri();
    fireEvent.click(await screen.findByRole('button', { name: /Versa nel cassetto/ }));
    expect(screen.getByRole('button', { name: /Vacanza/ })).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: 'Indietro' }));
    expect(screen.getByRole('button', { name: 'Registra una spesa' })).toHaveFocus();
  });

  it('rate tutte fatte: la riga sotto cambia', async () => {
    leggi.mockResolvedValue(voci({ cassettiARate: [g('g1', 'Vacanza', 100, 100)] }));
    apri();
    expect(await screen.findByText('Le rate di questo mese sono fatte')).toBeInTheDocument();
  });

  it('haCasa false: niente quota; true: porta al versamento', async () => {
    const { unmount } = apri();
    await waitFor(() => expect(leggi).toHaveBeenCalled());
    expect(screen.queryByText('Versa la quota della casa')).not.toBeInTheDocument();
    unmount();
    leggi.mockResolvedValue(voci({ haCasa: true }));
    apri();
    fireEvent.click(await screen.findByRole('button', { name: /Versa la quota della casa/ }));
    expect(push).toHaveBeenCalledWith('/casa?azione=versamento');
  });

  it('se leggiVociMenu lancia: solo le prime 4 voci, nessun errore', async () => {
    leggi.mockRejectedValue(new Error('giù'));
    apri();
    await waitFor(() => expect(leggi).toHaveBeenCalled());
    await Promise.resolve();
    const voceBottoni = screen.getAllByRole('button').filter((b) => b.getAttribute('aria-label') !== 'Chiudi');
    expect(voceBottoni).toHaveLength(4);
    expect(screen.queryByText(/giù/)).not.toBeInTheDocument();
  });

  it('a ogni apertura rilegge le voci e intanto tiene le ultime', async () => {
    leggi.mockResolvedValueOnce(voci({ haCasa: true }));
    const { rerender } = render(<MenuAzioni aperto onClose={() => {}} inCasa={false} />);
    await screen.findByText('Versa la quota della casa');
    rerender(<MenuAzioni aperto={false} onClose={() => {}} inCasa={false} />);
    let risolvi: (v: VociMenu) => void = () => {};
    leggi.mockReturnValueOnce(new Promise<VociMenu>((r) => (risolvi = r)));
    rerender(<MenuAzioni aperto onClose={() => {}} inCasa={false} />);
    expect(leggi).toHaveBeenCalledTimes(2);
    expect(screen.getByText('Versa la quota della casa')).toBeInTheDocument();
    risolvi(voci({ haCasa: false }));
    await waitFor(() => expect(screen.queryByText('Versa la quota della casa')).not.toBeInTheDocument());
  });

  it('se la rilettura fallisce tiene le ultime voci', async () => {
    leggi.mockResolvedValueOnce(voci({ haCasa: true }));
    const { rerender } = render(<MenuAzioni aperto onClose={() => {}} inCasa={false} />);
    await screen.findByText('Versa la quota della casa');
    rerender(<MenuAzioni aperto={false} onClose={() => {}} inCasa={false} />);
    leggi.mockRejectedValueOnce(new Error('giù'));
    rerender(<MenuAzioni aperto onClose={() => {}} inCasa={false} />);
    await waitFor(() => expect(leggi).toHaveBeenCalledTimes(2));
    await Promise.resolve();
    expect(screen.getByText('Versa la quota della casa')).toBeInTheDocument();
  });

  it('in Casa con una casa: "Registra una spesa di casa"', async () => {
    leggi.mockResolvedValue(voci({ haCasa: true }));
    apri(true);
    expect(await screen.findByRole('button', { name: 'Registra una spesa di casa' })).toBeInTheDocument();
  });

  it('in Casa senza casa: "Registra una spesa"', async () => {
    apri(true);
    await waitFor(() => expect(leggi).toHaveBeenCalled());
    await Promise.resolve();
    expect(screen.getByRole('button', { name: 'Registra una spesa' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Registra una spesa di casa' })).not.toBeInTheDocument();
  });

  it('"Sposta tra i tuoi conti" solo con almeno due conti personali', async () => {
    leggi.mockResolvedValue(voci({ contiPersonali: 1 }));
    const { unmount } = apri();
    await waitFor(() => expect(leggi).toHaveBeenCalled());
    await Promise.resolve();
    expect(screen.queryByText('Sposta tra i tuoi conti')).not.toBeInTheDocument();
    unmount();
    leggi.mockResolvedValue(voci({ contiPersonali: 2 }));
    apri();
    expect(await screen.findByText('Sposta tra i tuoi conti')).toBeInTheDocument();
    expect(screen.getByText("Da un conto all'altro, i saldi si aggiornano")).toBeInTheDocument();
  });

  it('"Sposta tra i tuoi conti" porta a /?sposta=1 e chiude il menu', async () => {
    leggi.mockResolvedValue(voci({ contiPersonali: 2 }));
    const { onClose } = apri();
    fireEvent.click(await screen.findByRole('button', { name: /Sposta tra i tuoi conti/ }));
    expect(push).toHaveBeenCalledWith('/?sposta=1');
    expect(onClose).toHaveBeenCalled();
  });

  it('la voce sta prima di quelle che dipendono dai dati', async () => {
    leggi.mockResolvedValue(voci({ contiPersonali: 2, cassettiARate: [g('g1', 'Vacanza', 100)] }));
    apri();
    const sposta = await screen.findByRole('button', { name: /Sposta tra i tuoi conti/ });
    const versa = screen.getByRole('button', { name: /Versa nel cassetto/ });
    expect(sposta.compareDocumentPosition(versa) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('nessuna parola vietata', async () => {
    leggi.mockResolvedValue(voci({ haCasa: true, contiPersonali: 2, cassettiARate: [g('g1', 'Vacanza', 100), g('g2', 'Auto', 50)] }));
    const { baseElement } = apri();
    await screen.findByText('Versa la quota della casa');
    assertNessunaParolaVietata(baseElement);
    fireEvent.click(screen.getByRole('button', { name: /Versa nel cassetto/ }));
    assertNessunaParolaVietata(baseElement);
  });
});

describe('CasaFab e tipo income', () => {
  it('non apre il foglio né segna gestito per tipo income', () => {
    render(<CasaFab aggiunta={{ meUserId: 'u' } as never} />);
    const d = { gestito: false, tipo: 'income' as const };
    window.dispatchEvent(new CustomEvent(EVENTO_AGGIUNGI, { detail: d }));
    expect(d.gestito).toBe(false);
    expect(screen.queryByText('foglio-aggiunta')).not.toBeInTheDocument();
  });

  it('apre il foglio per un evento normale', async () => {
    render(<CasaFab aggiunta={{ meUserId: 'u' } as never} />);
    const d = { gestito: false };
    window.dispatchEvent(new CustomEvent(EVENTO_AGGIUNGI, { detail: d }));
    expect(d.gestito).toBe(true);
    expect(await screen.findByText('foglio-aggiunta')).toBeInTheDocument();
  });
});
