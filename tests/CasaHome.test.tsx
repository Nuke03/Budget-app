import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react';
import { CasaHome } from '@/app/casa/CasaHome';
import { casaHomeDati, type CasaHomeDati } from '@/lib/calculations/supporto/casaHome';
import type { CasaAggiunta, CasaData } from '@/lib/loadCasaData';
import type { StatoVoceDaParte } from '@/lib/calculations/casa/fondi';
import type { CasaCorrente } from '@/lib/data/households';
import type { PlanItem } from '@/lib/types';
import { assertNessunaParolaVietata } from './helpers/paroleVietate';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh, push: vi.fn() }),
}));
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }));
vi.mock('@/lib/data/fondiCasa', () => ({ creaFondoBolletta: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/data/transactions', () => ({ createTransaction: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/data/accounts', () => ({ adjustAccountBalance: vi.fn().mockResolvedValue(undefined) }));
import { creaFondoBolletta } from '@/lib/data/fondiCasa';

const fabio = { householdId: 'h1', userId: 'u1', displayName: 'Fabio', joinedAt: '2026-01-01', slot: 1, attivo: true };
const anna = { householdId: 'h1', userId: 'u2', displayName: 'Anna', joinedAt: '2026-01-02', slot: 2, attivo: true };
const casa: CasaCorrente = {
  household: { id: 'h1', nome: 'Casa Rossi', createdAt: '2026-01-01', archiviataIl: null, createdBy: 'u1' },
  members: [fabio, anna],
  invite: null,
  me: fabio,
};

const aggiunta: CasaAggiunta = {
  householdId: 'h1',
  meUserId: 'u1',
  nomi: [
    { userId: 'u1', nome: 'Fabio' },
    { userId: 'u2', nome: 'Anna' },
  ],
  conti: [{ id: 'ac', nome: 'Conto comune', saldoAttuale: 870, contaInDisponibile: true, targetSaldo: null }],
  categorie: [{ id: 'cc', nome: 'Bollette', tipo: 'expense', colore: '#0f9d6b', archiviata: false }],
  obiettivi: [],
};

const spiegazione = {
  valore: 870,
  formula: 'Quello che c’è sul conto comune, meno quello già messo da parte.',
  ingredienti: [{ etichetta: 'Saldo del conto comune', valore: 870 }],
};

const base: CasaHomeDati = {
  gestisce: true,
  disponibile: 870,
  spesoMese: 320.5,
  previstoMese: 1200,
  daFare: null,
  ultime: [
    { id: 't1', data: '2026-11-05', descrizione: 'Luce', importo: 64.2, colore: '#0f9d6b', chi: 'Anna' },
    { id: 't2', data: '2026-11-03', descrizione: 'Spesa', importo: 30, colore: null, chi: 'tu' },
  ],
  vistaSemplice: { quota: null, entroGiorno: null, versato: 0, stato: { tipo: 'pari' }, creditoVersoCasa: 0 },
};

const voce = (id: string, nome: string, importoMensile: number): StatoVoceDaParte => ({
  item: { id, nome, importoMensile, importoRicorrenza: importoMensile * 6, frequenzaMesi: 6 } as unknown as PlanItem,
  goal: null,
  stato: 'da_mettere',
});

const monta = (libretto: CasaHomeDati | undefined, extra: Partial<Parameters<typeof CasaHome>[0]> = {}) =>
  render(
    <CasaHome
      casa={casa}
      libretto={libretto}
      spiegazione={spiegazione}
      aggiunta={aggiunta}
      oggi="2026-11-12"
      {...extra}
    />
  );

describe('CasaHome del libretto', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('la copertina e la pagina bianca: titolo, mese, disponibile in serif, spese del mese', () => {
    const { container } = monta(base);
    expect(screen.getByRole('heading', { name: 'La casa' })).toBeInTheDocument();
    expect(screen.getByText('novembre 2026')).toBeInTheDocument();
    expect(screen.getByText('Disponibile di casa')).toBeInTheDocument();
    const cifra = screen.getByTestId('disponibile');
    expect(cifra).toHaveTextContent('870,00 €');
    expect(cifra.className).toMatch(/font-serif/);
    expect(cifra.className).toMatch(/\bnum\b/);
    expect(screen.getByText(/Spese di casa questo mese/)).toHaveTextContent(
      'Spese di casa questo mese: 320,50 € su 1.200 € previsti'
    );
    assertNessunaParolaVietata(container);
  });

  it('senza piano la riga delle spese dice solo quanto è stato speso', () => {
    monta({ ...base, previstoMese: null });
    const riga = screen.getByText(/Spese di casa questo mese/);
    expect(riga).toHaveTextContent('Spese di casa questo mese: 320,50 €');
    expect(riga).not.toHaveTextContent('previsti');
  });

  it('Come si calcola? apre la spiegazione che esiste oggi', () => {
    monta(base);
    const pulsante = screen.getByRole('button', { name: 'Come si calcola?' });
    fireEvent.click(pulsante);
    expect(pulsante).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Saldo del conto comune')).toBeInTheDocument();
  });

  it('senza niente da fare non c\'è la card', () => {
    monta(base);
    expect(screen.queryByRole('heading', { name: 'Da fare' })).not.toBeInTheDocument();
  });

  describe('Da fare', () => {
    const daParte: CasaHomeDati = {
      ...base,
      daFare: {
        tipo: 'da_parte',
        testo: 'Metti da parte 150 € per TARI e Acqua',
        importo: 150,
        voci: [
          { nome: 'TARI', importo: 100 },
          { nome: 'Acqua', importo: 50 },
        ],
      },
    };
    const voci = [voce('i1', 'TARI', 100), voce('i2', 'Acqua', 50)];

    it('accantonamento: le voci e Fatto, che chiama la stessa azione di Da parte', async () => {
      monta(daParte, { vociDaParte: voci });
      expect(screen.getByRole('heading', { name: 'Da fare' })).toBeInTheDocument();
      expect(screen.getByText('Metti da parte 150 € per TARI e Acqua')).toBeInTheDocument();
      expect(screen.getByText('TARI')).toBeInTheDocument();
      expect(screen.getByText('Acqua')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Fatto' }));
      await waitFor(() => expect(creaFondoBolletta).toHaveBeenCalledTimes(2));
      expect(creaFondoBolletta).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ householdId: 'h1', item: voci[0].item, oggi: '2026-11-12' })
      );
      await waitFor(() => expect(refresh).toHaveBeenCalled());
    });

    it('se il salvataggio fallisce dice cosa fare', async () => {
      vi.mocked(creaFondoBolletta).mockRejectedValueOnce(new Error('x'));
      monta(daParte, { vociDaParte: voci });
      fireEvent.click(screen.getByRole('button', { name: 'Fatto' }));
      expect(await screen.findByRole('alert')).toHaveTextContent('Salvataggio fallito, controlla la connessione e riprova.');
    });

    it('promemoria: tutta la card è un link', () => {
      monta({
        ...base,
        daFare: { tipo: 'promemoria', testo: 'Il check-in di ottobre è pronto.', href: '/casa/controllo' },
      });
      const link = screen.getByRole('link', { name: /Il check-in di ottobre è pronto/ });
      expect(link).toHaveAttribute('href', '/casa/controllo');
      expect(screen.queryByRole('button', { name: 'Fatto' })).not.toBeInTheDocument();
    });

    it('un promemoria senza pagina propria porta ai Dettagli, dove si registra', () => {
      monta({ ...base, daFare: { tipo: 'promemoria', testo: 'Il tuo versamento di 690 € è da fare entro il 5.', href: '/casa' } });
      expect(screen.getByRole('link', { name: /versamento di 690/ })).toHaveAttribute('href', '/casa/dettagli');
    });

    it('quota: tutta la card è un link alla quota', () => {
      monta({ ...base, daFare: { tipo: 'quota', testo: 'Calcolate la quota: servono 3 minuti.', href: '/casa/quota' } });
      expect(screen.getByRole('link', { name: /Calcolate la quota/ })).toHaveAttribute('href', '/casa/quota');
    });
  });

  describe('Ultime spese', () => {
    it('righe in stile registro con data, nome, chi e importo, e il link a tutti i movimenti', () => {
      monta(base);
      const luce = screen.getByText('Luce').closest('li')!;
      expect(within(luce).getByText('05/11')).toBeInTheDocument();
      expect(within(luce).getByText('Anna')).toBeInTheDocument();
      expect(within(luce).getByText('−64,20')).toBeInTheDocument();
      const dot = luce.querySelector('[data-colore]');
      expect(dot).toHaveAttribute('data-colore', '#0f9d6b');
      expect(screen.getByRole('link', { name: 'Tutti i movimenti' })).toHaveAttribute('href', '/casa/movimenti');
    });

    it('una spesa in contanti anticipata da me, senza conto, dice "tu"', () => {
      const dati = {
        casa,
        aggiunta: { ...aggiunta, conti: [] },
        transazioni: [
          {
            id: 'c1', tipo: 'expense', importo: 12, data: '2026-11-10', categoriaId: null, accountId: null,
            goalId: null, descrizione: 'Pane', nota: null, createdAt: '2026-11-10T10:00:00Z', stima: false,
            pagataDaUserId: 'u1',
          },
        ],
        piani: [],
        righe: {},
        crediti: {},
        debiti: [],
        obiettiviConAccantonato: [],
        controlli: { ultimoControllo: null, ultimoCheckinMese: null },
        disponibile: { valore: 0, spiegazione },
      } as unknown as CasaData;
      const libretto = casaHomeDati(dati, 'u1', '2026-11-12');
      monta(libretto);
      const riga = screen.getByText('Pane').closest('li')!;
      expect(within(riga).getByText('tu')).toBeInTheDocument();
    });

    it('senza spese dice cosa succede dopo', () => {
      monta({ ...base, ultime: [] });
      expect(screen.getByText('Ancora nessuna spesa di casa. Appena ne aggiungete una, la vede tutta la casa.')).toBeInTheDocument();
    });
  });

  it('la riga Dettagli porta a /casa/dettagli', () => {
    monta(base);
    expect(screen.getByRole('link', { name: /Dettagli/ })).toHaveAttribute('href', '/casa/dettagli');
  });

  it('niente blocchi impilati né ombre', () => {
    const { container } = monta(base);
    expect(screen.queryByRole('heading', { name: 'Conto comune' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: "Chi c'è in casa" })).not.toBeInTheDocument();
    expect(container.innerHTML).not.toMatch(/shadow/);
  });

  it('il pulsante + apre il foglio in modalità Casa', () => {
    monta(base, { contiPersonali: [] });
    act(() => {
      window.dispatchEvent(new CustomEvent('libretto:aggiungi', { detail: { gestito: false } }));
    });
    fireEvent.click(screen.getByRole('button', { name: 'Conto comune' }));
    expect(screen.getByRole('group', { name: 'Chi ha pagato' })).toBeInTheDocument();
    expect(screen.getByText('Lo vedrà anche Anna')).toBeInTheDocument();
  });

  it('se conti e spese non si leggono dice di riprovare e lascia la quota e le impostazioni', () => {
    const { container } = render(<CasaHome casa={casa} />);
    expect(screen.getByText('Non riesco a leggere conti e spese della casa. Riprova tra poco.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Calcolate la nostra quota' })).toHaveAttribute('href', '/casa/quota');
    expect(screen.getByRole('link', { name: 'Impostazioni' })).toHaveAttribute('href', '/casa/impostazioni');
    assertNessunaParolaVietata(container);
  });
});
