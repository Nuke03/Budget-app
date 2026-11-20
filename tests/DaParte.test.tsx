import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DaParte } from '@/app/casa/da-parte/DaParte';
import { AnnullaProvider } from '@/app/AnnullaProvider';
import type { ObiettivoCasa, StatoVoceDaParte } from '@/lib/calculations/casa/fondi';
import { assertNessunaParolaVietata } from './helpers/paroleVietate';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh, push: vi.fn() }), usePathname: () => '/x' }));
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }));
vi.mock('@/lib/data/fondiCasa', () => ({
  creaFondoBolletta: vi.fn(),
  creaFondoUnaVolta: vi.fn(),
  creaFondiIngresso: vi.fn(),
}));
vi.mock('@/lib/data/goals', () => ({ closeGoal: vi.fn() }));
vi.mock('@/lib/data/rientri', () => ({ fermaRientro: vi.fn() }));
import { fermaRientro } from '@/lib/data/rientri';
import { closeGoal } from '@/lib/data/goals';
import { creaFondoBolletta } from '@/lib/data/fondiCasa';

const voce = (id: string, nome: string, importo: number, freq: number) => ({
  id, planId: 'p1', nome, categoriaId: 'c-' + id, frequenzaMesi: freq, importoRicorrenza: importo,
  importoMensile: importo / freq, origineStima: 'utente' as const, goalId: null, stimaIgnorataConN: null, ordine: 1,
});
const tari: StatoVoceDaParte = { item: voce('i1', 'TARI', 300, 12), goal: null, stato: 'da_mettere' };
const luce: StatoVoceDaParte = { item: voce('i2', 'Luce', 110, 2), goal: null, stato: 'da_mettere' };

const fondo: ObiettivoCasa = {
  id: 'g1', nome: 'Gas', importoTarget: 300, modalita: 'dilazionato', scadenza: '2027-03-31', categoriaId: 'c-i3',
  ricorrente: true, frequenzaMesi: 12, stato: 'aperto', createdAt: '2026-11-09', quotaMensile: 25, accantonato: 100,
  spiegazione: { valore: 100, formula: 'Bolletta di 300 euro in 12 mesi.', ingredienti: [] },
};

function monta(over: Partial<React.ComponentProps<typeof DaParte>> = {}) {
  return render(
    <AnnullaProvider>
      <DaParte householdId="h1" oggi="2026-11-09" haPiano voci={[tari]} fondi={[]} unaVolta={[]} {...over} />
    </AnnullaProvider>
  );
}

// act di React e timer finti non vanno d'accordo: si fa passare il tempo e si lasciano finire le promesse.
async function passa(ms: number) {
  await vi.advanceTimersByTimeAsync(ms);
  for (let i = 0; i < 20; i++) await Promise.resolve();
}

beforeEach(() => {
  window.localStorage.clear();
  refresh.mockReset();
  vi.mocked(creaFondoBolletta).mockReset();
  vi.mocked(creaFondoBolletta).mockResolvedValue({} as never);
  vi.mocked(closeGoal).mockReset();
  vi.mocked(closeGoal).mockResolvedValue(undefined);
});

afterEach(() => vi.useRealTimers());

describe('DaParte', () => {
  it('voce da mettere: anteprima con la scadenza più lontana, niente domanda', () => {
    const { container } = monta();
    expect(screen.getByText('TARI, circa 300 € l\'anno: 25 € al mese da ora.')).toBeInTheDocument();
    expect(screen.getByText(/Entro la prima scadenza avrete messo da parte tutto\./)).toBeInTheDocument();
    expect(screen.queryByLabelText('Quando arriva la prossima rata?')).not.toBeInTheDocument();
    assertNessunaParolaVietata(container);
  });

  it('Cambia apre il selettore; marzo 2027 dice 100 di 300 e il resto dal cuscinetto', () => {
    monta();
    fireEvent.click(screen.getByRole('button', { name: 'Cambia' }));
    fireEvent.change(screen.getByLabelText('Quando arriva la prossima rata?'), { target: { value: '2027-03-31' } });
    expect(
      screen.getByText(
        'Per questa prima volta avrete messo da parte 100 di 300 €; il resto verrà dal cuscinetto. Dalla seconda, 300 su 300.'
      )
    ).toBeInTheDocument();
  });

  it('Metti da parte chiama creaFondoBolletta una volta anche con doppio tocco, poi refresh', async () => {
    monta();
    const b = screen.getByRole('button', { name: 'Metti da parte' });
    fireEvent.click(b);
    fireEvent.click(b);
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(creaFondoBolletta).toHaveBeenCalledTimes(1);
    expect(vi.mocked(creaFondoBolletta).mock.calls[0][1]).toMatchObject({
      householdId: 'h1', scadenza: '2027-11-30', oggi: '2026-11-09',
    });
  });

  it('errore: messaggio, scelta conservata', async () => {
    vi.mocked(creaFondoBolletta).mockRejectedValue(new Error('no'));
    const { container } = monta();
    fireEvent.click(screen.getByRole('button', { name: 'Cambia' }));
    fireEvent.change(screen.getByLabelText('Quando arriva la prossima rata?'), { target: { value: '2027-03-31' } });
    fireEvent.click(screen.getByRole('button', { name: 'Metti da parte' }));
    expect(await screen.findByText('Salvataggio fallito, controlla la connessione e riprova.')).toBeInTheDocument();
    expect(screen.getByLabelText('Quando arriva la prossima rata?')).toHaveValue('2027-03-31');
    assertNessunaParolaVietata(container);
  });

  it('Metti da parte tutto: una chiamata per voce; al riprovo salta quelle già fatte', async () => {
    vi.mocked(creaFondoBolletta)
      .mockResolvedValueOnce({} as never)
      .mockRejectedValueOnce(new Error('no'));
    monta({ voci: [tari, luce] });
    fireEvent.click(screen.getByRole('button', { name: 'Metti da parte tutto' }));
    expect(await screen.findByText('Salvataggio fallito, controlla la connessione e riprova.')).toBeInTheDocument();
    expect(creaFondoBolletta).toHaveBeenCalledTimes(2);
    // TARI è fatta: resta solo Luce
    expect(screen.queryByText(/^TARI, circa/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Metti da parte' }));
    await waitFor(() => expect(creaFondoBolletta).toHaveBeenCalledTimes(3));
    const nomi = vi.mocked(creaFondoBolletta).mock.calls.map((c) => c[1].item.nome);
    expect(nomi).toEqual(['TARI', 'Luce', 'Luce']);
  });

  it('voce messa: 100 di 300 € e Come si calcola?', () => {
    const { container } = monta({
      voci: [{ item: voce('i3', 'Gas', 300, 12), goal: fondo, stato: 'messa' }],
      fondi: [fondo],
    });
    expect(screen.getByText('100 di 300 €')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Come si calcola?' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Metti da parte' })).not.toBeInTheDocument();
    assertNessunaParolaVietata(container);
  });

  it('senza piano', () => {
    const { container } = monta({ haPiano: false, voci: [] });
    expect(
      screen.getByText('Prima calcolate la quota: servono le voci per sapere cosa mettere da parte.')
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Calcolate la nostra quota' })).toHaveAttribute('href', '/casa/quota');
    assertNessunaParolaVietata(container);
  });

  it('senza fondi una volta: messaggio vuoto', () => {
    const { container } = monta();
    expect(screen.getByText('Ancora niente da pagare una volta.')).toBeInTheDocument();
    assertNessunaParolaVietata(container);
  });

  describe("L'ho pagato (con Annulla)", () => {
    const divano: ObiettivoCasa = {
      ...fondo, id: 'g9', nome: 'Divano', ricorrente: false, frequenzaMesi: null, importoTarget: 600, accantonato: 100,
    };
    function segna() {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      const utente = monta({ unaVolta: [divano] });
      expect(screen.getByText('Divano: 600 €')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: "L'ho pagato" }));
      expect(
        screen.getByText(/Prima registra la spesa nei movimenti della casa, collegata a questo fondo/)
      ).toBeInTheDocument();
      expect(screen.queryByText(/Non si può annullare/)).not.toBeInTheDocument();
      expect(closeGoal).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole('button', { name: 'Segna come pagato' }));
      return utente;
    }

    it('conferma nel foglio, poi nasconde il fondo senza scrivere ancora', () => {
      const { container } = segna();
      expect(screen.queryByText('Divano: 600 €')).not.toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveTextContent('Segnata come pagata.');
      expect(closeGoal).not.toHaveBeenCalled();
      assertNessunaParolaVietata(container);
    });

    it('dopo 5 secondi chiude il fondo una volta e rinfresca', async () => {
      segna();
      await passa(5000);
      expect(closeGoal).toHaveBeenCalledTimes(1);
      expect(vi.mocked(closeGoal).mock.calls[0][1]).toBe('g9');
      expect(refresh).toHaveBeenCalled();
    });

    it('Lascia stare non chiude niente', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      monta({ unaVolta: [divano] });
      fireEvent.click(screen.getByRole('button', { name: "L'ho pagato" }));
      fireEvent.click(screen.getByRole('button', { name: 'Lascia stare' }));
      expect(screen.getByText('Divano: 600 €')).toBeInTheDocument();
      await passa(10000);
      expect(closeGoal).not.toHaveBeenCalled();
    });

    it('con "Non avvisarmi più" si salta il foglio ma resta annullabile', () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      window.localStorage.setItem('conferme:fondo_pagato', 'no');
      monta({ unaVolta: [divano] });
      fireEvent.click(screen.getByRole('button', { name: "L'ho pagato" }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveTextContent('Segnata come pagata. Ricordati di segnare anche la spesa.');
    });

    it('"Non avvisarmi più" qui non tocca la conferma dei movimenti', () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      monta({ unaVolta: [divano] });
      fireEvent.click(screen.getByRole('button', { name: "L'ho pagato" }));
      fireEvent.click(screen.getByLabelText('Non avvisarmi più'));
      fireEvent.click(screen.getByRole('button', { name: 'Segna come pagato' }));
      expect(window.localStorage.getItem('conferme:fondo_pagato')).toBe('no');
      expect(window.localStorage.getItem('conferme:movimento_casa')).toBeNull();
    });

    it('Annulla non chiude mai il fondo e la riga torna', async () => {
      segna();
      fireEvent.click(screen.getByRole('button', { name: 'Annulla' }));
      expect(screen.getByText('Divano: 600 €')).toBeInTheDocument();
      await passa(10000);
      expect(closeGoal).not.toHaveBeenCalled();
      expect(refresh).not.toHaveBeenCalled();
    });
  });

  it('piano senza voci da parte', () => {
    const { container } = monta({ voci: [] });
    expect(screen.getByText('Nel piano non ci sono bollette da mettere da parte.')).toBeInTheDocument();
    assertNessunaParolaVietata(container);
  });
});

describe('DaParte: rientri', () => {
  it('un fondo con un rientro aperto mostra la riga e Ferma chiama fermaRientro', async () => {
    vi.mocked(fermaRientro).mockResolvedValue(undefined);
    monta({
      fondi: [fondo],
      rientri: [
        { id: 'r1', userId: 'u', householdId: 'h1', goalId: 'g1', accountId: null, importo: 300, mesi: 3,
          creatoIl: '2026-11-01', stato: 'aperto', fermatoIl: null },
      ],
    });
    expect(screen.getByText('Rientro: 100 € al mese fino a gennaio')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ferma' }));
    await waitFor(() => expect(fermaRientro).toHaveBeenCalledWith(expect.anything(), 'r1', '2026-11-09'));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it('un fondo con speso collegato e nessun rientro: link Rimetti a rate', () => {
    monta({ fondi: [{ ...fondo, specoCollegato: 80 }], rientri: [] });
    expect(screen.getByRole('link', { name: 'Rimetti a rate' })).toHaveAttribute('href', '/?rimetti=g1');
  });
});
