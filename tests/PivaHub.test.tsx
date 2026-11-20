import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { PivaHub } from '@/app/piva/PivaHub';
import { assertNessunaParolaVietata } from './helpers/paroleVietate';
import type { PivaSettings, Transaction } from '@/lib/types';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }));
vi.mock('@/lib/data/transactions', () => ({ getTransactions: vi.fn() }));
vi.mock('@/lib/data/accounts', () => ({ getAccounts: vi.fn() }));
vi.mock('@/lib/data/rientriLetti', () => ({ leggiRientriESpostamenti: vi.fn() }));
vi.mock('@/lib/data/piva', () => ({
  getAccantonamenti: vi.fn(),
  getQuoteScartate: vi.fn(),
  scartaQuota: vi.fn(),
  accantonaTasse: vi.fn(),
  assicuraScadenze: vi.fn(),
  getScadenze: vi.fn(),
  updateScadenza: vi.fn(),
  pagaScadenza: vi.fn(),
  nascondiScadenza: vi.fn(),
  getFatture: vi.fn(),
  creaFattura: vi.fn(),
  incassaFattura: vi.fn(),
  updateFattura: vi.fn(),
  deleteFattura: vi.fn(),
}));
vi.mock('@/app/AnnullaProvider', () => ({ useEliminaConAnnulla: () => vi.fn() }));
vi.mock('@/lib/pivaHome', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/pivaHome')>()),
  leggiCasaPerStipendio: vi.fn(),
  leggiGoalsConSpeso: vi.fn(),
}));

import { getTransactions } from '@/lib/data/transactions';
import { getAccounts } from '@/lib/data/accounts';
import { leggiRientriESpostamenti } from '@/lib/data/rientriLetti';
import type { Rientro } from '@/lib/calculations/rientri';
import { leggiCasaPerStipendio, leggiGoalsConSpeso } from '@/lib/pivaHome';
import {
  getAccantonamenti, accantonaTasse, assicuraScadenze, getScadenze, getFatture, creaFattura, incassaFattura,
  getQuoteScartate, scartaQuota,
} from '@/lib/data/piva';

const settings: PivaSettings = {
  id: '1',
  attivo: true,
  dataApertura: '2024-01-10',
  categoriaFatturatoId: 'cat-fatt',
  coefficienteRedditivita: 78,
  aliquotaSostitutivaOverride: 5,
  aliquotaContributoSoggettivo: 10,
  aliquotaContributoIntegrativo: 2,
  minimaleContributivoAnnuo: 856,
  contributiVersatiAnnoPrecedente: 0,
  contoTasseId: 'tasse',
  preset: 'enpap',
  guidataDal: '2026-11-01',
  stipendioMensile: null,
  stipendioRivistoIl: null,
  incassoMeseMagro: null,
  categoriaDal: null,
};

const conti = [
  { id: 'a1', nome: 'Conto corrente', saldoAttuale: 900, contaInDisponibile: true, targetSaldo: null, archiviato: false },
  { id: 'tasse', nome: 'Conto tasse', saldoAttuale: 400, contaInDisponibile: false, targetSaldo: null, archiviato: false },
];

const incasso = (id: string, data: string, importo: number): Transaction => ({
  id, tipo: 'income', importo, data, categoriaId: 'cat-fatt', accountId: 'a1', goalId: null,
  descrizione: id, nota: null, createdAt: `${data}T10:00:00Z`, stima: false,
});

function apri(
  over: { onModifica?: () => void; onDisattiva?: () => Promise<void> } = {},
  impostazioni: Partial<PivaSettings> = {}
) {
  const props = {
    onModifica: vi.fn(),
    onDisattiva: vi.fn().mockResolvedValue(undefined),
    onSalvaStipendio: vi.fn().mockResolvedValue(undefined),
    ...over,
  };
  render(<PivaHub settings={{ ...settings, ...impostazioni }} {...props} />);
  return props;
}

const spesa = (id: string, data: string, importo: number): Transaction => ({
  id, tipo: 'expense', importo, data, categoriaId: null, accountId: 'a1', goalId: null,
  descrizione: id, nota: null, createdAt: `${data}T10:00:00Z`, stima: false,
});

// 6 mesi pieni di incassi (mag-ott) e 3 di spese (ago-ott) per avere una proposta.
const STORICO = [
  ...['2026-05-10', '2026-06-10', '2026-07-10', '2026-08-10', '2026-09-10', '2026-10-10'].map((d, i) => incasso(`s${i}`, d, 1000)),
  ...['2026-08-05', '2026-09-05', '2026-10-05'].map((d, i) => spesa(`x${i}`, d, 300)),
];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-17T12:00:00Z') });
  vi.mocked(getAccounts).mockResolvedValue(conti);
  vi.mocked(getTransactions).mockResolvedValue([incasso('i2', '2026-11-10', 600), incasso('i1', '2026-03-10', 5000)]);
  vi.mocked(getAccantonamenti).mockReset();
  vi.mocked(getAccantonamenti).mockResolvedValue([
    { id: 'pa1', transactionId: 'i0', importo: 400, data: '2026-11-12', daAccountId: 'a1', aAccountId: 'tasse' },
  ]);
  vi.mocked(assicuraScadenze).mockReset().mockResolvedValue(undefined);
  vi.mocked(getScadenze).mockReset().mockResolvedValue([
    {
      id: 'sc1', anno: 2026, chiave: 'f24_novembre', tipo: 'f24', descrizione: 'F24 di novembre: secondo acconto',
      data: '2026-11-30', importo: null, pagataIl: null, transactionId: null, nascosta: false,
    },
  ]);
  vi.mocked(getFatture).mockReset().mockResolvedValue([
    { id: 'f1', cliente: 'Rossi', importo: 900, dataEmissione: '2026-08-18', dataIncasso: null, transactionId: null, nota: null },
    { id: 'f2', cliente: 'Verdi', importo: 300, dataEmissione: '2026-11-01', dataIncasso: null, transactionId: null, nota: null },
  ]);
  vi.mocked(creaFattura).mockReset().mockResolvedValue('f-nuova');
  vi.mocked(incassaFattura).mockReset().mockResolvedValue('i-nuovo');
  vi.mocked(accantonaTasse).mockReset();
  vi.mocked(accantonaTasse).mockResolvedValue('pa-nuovo');
  vi.mocked(getQuoteScartate).mockReset().mockResolvedValue(new Set());
  vi.mocked(scartaQuota).mockReset().mockResolvedValue(undefined);
  vi.mocked(leggiCasaPerStipendio).mockReset().mockResolvedValue(null);
  vi.mocked(leggiGoalsConSpeso).mockReset().mockResolvedValue([]);
  vi.mocked(leggiRientriESpostamenti).mockReset().mockResolvedValue({ rientri: [], spostamenti: [] });
});

afterEach(() => vi.useRealTimers());

const frase = (testo: string) => screen.getByText((_, el) => el?.tagName === 'P' && el.textContent === testo);

describe('PivaHub', () => {
  it('dice la percentuale di ogni incasso, in una riga sans dentro la scheda del conto tasse', async () => {
    apri();
    const riga = await screen.findByText('Di ogni incasso metti da parte il 13,7%.');
    expect(riga.closest('section')).toHaveAttribute('aria-label', 'Conto tasse');
    expect(riga).not.toHaveClass('font-serif');
  });

  it('l ordine: stipendio, conto tasse, da spostare, ti devono, azioni, scadenze, impostazioni', async () => {
    apri();
    await screen.findByRole('region', { name: 'Conto tasse' });
    const ordine = [
      screen.getByRole('region', { name: 'Stipendio' }),
      screen.getByRole('region', { name: 'Conto tasse' }),
      screen.getByRole('region', { name: 'Da spostare' }),
      screen.getByRole('region', { name: 'Fatture in attesa' }),
      screen.getByRole('button', { name: '+ Incasso' }),
      screen.getByRole('region', { name: "Scadenze dell'anno" }),
      screen.getByRole('button', { name: 'Impostazioni' }),
    ];
    for (let i = 1; i < ordine.length; i++) {
      expect(ordine[i - 1].compareDocumentPosition(ordine[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });

  it('il vaso mostra il saldo del conto tasse e il confronto dell anno', async () => {
    apri();
    const vaso = await screen.findByRole('region', { name: 'Conto tasse' });
    expect(within(vaso).getByTestId('saldo-vaso')).toHaveTextContent('400 €');
    // 5600 incassati: 4368 di reddito, 218 + 856 + 112 = 1186 di stima
    expect(within(vaso).getByText(/Quest'anno servono circa 1\.186 €, ne hai messi da parte 400 €/)).toBeInTheDocument();
  });

  it('il Perché del vaso spiega la stima e dice che la conferma è del commercialista, una volta sola', async () => {
    apri();
    const vaso = await screen.findByRole('region', { name: 'Conto tasse' });
    expect(screen.queryByText(/la conferma è del commercialista/)).not.toBeInTheDocument();
    // la frase sulla stima è visibile una volta nel hub; nel Perché resta l'avviso a parole sue
    expect(within(vaso).getByText('Sono stime: le cifre vere le conferma il commercialista.')).toBeInTheDocument();
    fireEvent.click(within(vaso).getByRole('button', { name: "Perché? le tasse di quest'anno" }));
    expect(screen.getAllByText(/la conferma è del commercialista/)).toHaveLength(1);
    expect(within(vaso).getByText(/non meno del minimo che la cassa chiede ogni anno, 856 €/)).toBeInTheDocument();
    expect(within(vaso).getByText('Imposta sostitutiva')).toBeInTheDocument();
    expect(within(vaso).getByText("Incassato quest'anno")).toBeInTheDocument();
  });

  it('il Perché della percentuale la divide in imposta, soggettivo e integrativo', async () => {
    apri();
    const sezione = await screen.findByRole('region', { name: 'Conto tasse' });
    fireEvent.click(within(sezione).getByRole('button', { name: 'Perché? la percentuale' }));
    expect(within(sezione).getByText(/Imposta sostitutiva \(78% × 5%\)/)).toBeInTheDocument();
    expect(within(sezione).getByText(/Contributo soggettivo \(78% × 10%\)/)).toBeInTheDocument();
    expect(within(sezione).getByText('Contributo integrativo')).toBeInTheDocument();
    expect(within(sezione).queryByText(/la conferma è del commercialista/)).not.toBeInTheDocument();
  });

  it('Da spostare elenca le quote in sospeso e Fatto le sposta', async () => {
    apri();
    const lista = await screen.findByRole('region', { name: 'Da spostare' });
    // solo l'incasso dal giorno della guida (10 novembre): 13,7% di 600 = 82
    expect(within(lista).getByText('Metti da parte 82 €')).toBeInTheDocument();
    expect(within(lista).getByText('Incasso di 600 € del 10 novembre 2026')).toBeInTheDocument();
    expect(within(lista).getByRole('button', { name: 'Perché? da spostare' })).toBeInTheDocument();
    expect(within(lista).getAllByRole('button', { name: 'Fatto' })).toHaveLength(1);
    fireEvent.click(within(lista).getByRole('button', { name: 'Fatto' }));
    // Fatto apre il foglio: il campo importo sta dietro il link
    fireEvent.click(await screen.findByRole('button', { name: 'Ho spostato una cifra diversa' }));
    const importoSpostato = await screen.findByLabelText('Importo spostato (€)');
    expect(importoSpostato).toHaveValue(82);
    fireEvent.click(screen.getByRole('button', { name: 'Fatto, li ho spostati' }));
    await waitFor(() =>
      expect(accantonaTasse).toHaveBeenCalledWith(expect.anything(), {
        importo: 82,
        data: '2026-11-17',
        daAccountId: 'a1',
        aAccountId: 'tasse',
        transactionId: 'i2',
      })
    );
    // dopo lo spostamento si rileggono i dati
    await waitFor(() => expect(getAccantonamenti).toHaveBeenCalledTimes(2));
  });

  it('Fatto non si ripete mentre è in corso', async () => {
    let finisci: (v: string) => void = () => {};
    vi.mocked(accantonaTasse).mockReturnValue(new Promise<string>((r) => (finisci = r)));
    apri();
    const lista = await screen.findByRole('region', { name: 'Da spostare' });
    fireEvent.click(within(lista).getByRole('button', { name: 'Fatto' }));
    const conferma = await screen.findByRole('button', { name: 'Fatto, li ho spostati' });
    fireEvent.click(conferma);
    fireEvent.click(conferma);
    expect(accantonaTasse).toHaveBeenCalledTimes(1);
    expect(conferma).toBeDisabled();
    finisci('x');
  });

  it('all apertura crea le scadenze mancanti e mostra la prossima nel vaso', async () => {
    apri();
    const vaso = await screen.findByRole('region', { name: 'Conto tasse' });
    expect(assicuraScadenze).toHaveBeenCalledWith(expect.anything(), [
      expect.objectContaining({ anno: 2026, chiave: 'f24_novembre', data: '2026-11-30' }),
    ]);
    expect(getScadenze).toHaveBeenCalledWith(expect.anything(), 2026);
    expect(
      within(vaso).getByText('Prossima scadenza: F24 (il modulo per pagare le tasse), 30 novembre.')
    ).toBeInTheDocument();
    const sezione = screen.getByRole('region', { name: "Scadenze dell'anno" });
    // chiusa: la riga dice la prossima in breve, la lista sta dietro il toggle
    const toggle = within(sezione).getByRole('button', { name: /Scadenze dell'anno/ });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveTextContent('Prossima: F24 di novembre, 30 novembre 2026');
    expect(within(sezione).queryByText('F24 di novembre: secondo acconto')).not.toBeInTheDocument();
    fireEvent.click(toggle);
    expect(within(sezione).getByText('F24 di novembre: secondo acconto')).toBeInTheDocument();
  });

  it('per la cassa dice il prossimo versamento con il nome della cassa o "alla cassa"', async () => {
    vi.mocked(getScadenze).mockResolvedValue([
      {
        id: 'sc2', anno: 2026, chiave: 'cassa_acconto', tipo: 'cassa', descrizione: 'ENPAP: primo acconto',
        data: '2026-12-01', importo: null, pagataIl: null, transactionId: null, nascosta: false,
      },
    ]);
    const { unmount } = render(
      <PivaHub settings={settings} onModifica={vi.fn()} onDisattiva={vi.fn()} onSalvaStipendio={vi.fn()} />
    );
    expect(await screen.findByText("Prossimo versamento all'ENPAP: 1° dicembre.")).toBeInTheDocument();
    unmount();
    render(
      <PivaHub settings={{ ...settings, preset: 'altro' }} onModifica={vi.fn()} onDisattiva={vi.fn()} onSalvaStipendio={vi.fn()} />
    );
    expect(await screen.findByText('Prossimo versamento alla cassa: 1° dicembre.')).toBeInTheDocument();
  });

  it('se le scadenze non si caricano il vaso e le quote restano usabili', async () => {
    vi.mocked(assicuraScadenze).mockRejectedValue(new Error('rete'));
    apri();
    const vaso = await screen.findByRole('region', { name: 'Conto tasse' });
    expect(within(vaso).getByTestId('saldo-vaso')).toHaveTextContent('400 €');
    fireEvent.click(screen.getByRole('button', { name: "Scadenze dell'anno" }));
    expect(screen.getByText('Le scadenze non si caricano ora.')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Da spostare' })).toBeInTheDocument();
  });

  it('se dopo Fatto la ricarica fallisce non dice che l azione è fallita', async () => {
    apri();
    const lista = await screen.findByRole('region', { name: 'Da spostare' });
    fireEvent.click(within(lista).getByRole('button', { name: 'Fatto' }));
    vi.mocked(getAccounts).mockRejectedValue(new Error('rete'));
    fireEvent.click(await screen.findByRole('button', { name: 'Fatto, li ho spostati' }));
    await waitFor(() => expect(accantonaTasse).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(/non riesco ad aggiornare/)).toBeInTheDocument();
    expect(screen.queryByText('Non è riuscito. Riprova.')).not.toBeInTheDocument();
  });

  it('senza quote in sospeso dice che non c è niente da spostare', async () => {
    vi.mocked(getAccantonamenti).mockResolvedValue([
      { id: 'pa1', transactionId: 'i2', importo: 82, data: '2026-11-12', daAccountId: 'a1', aAccountId: 'tasse' },
    ]);
    apri();
    expect(await screen.findByText('Niente da spostare: sei in pari con gli incassi.')).toBeInTheDocument();
  });

  it('mostra Ti devono con totale, numero e fattura vecchia', async () => {
    apri();
    const sezione = await screen.findByRole('region', { name: 'Fatture in attesa' });
    expect(
      within(sezione).getByText((_, el) => el?.tagName === 'P' && el.textContent === 'Ti devono 1.200 €')
    ).toBeInTheDocument();
    // la lista una per una sta dietro il toggle
    expect(within(sezione).queryByText('Rossi')).not.toBeInTheDocument();
    fireEvent.click(within(sezione).getByRole('button', { name: 'Le fatture una per una' }));
    expect(within(sezione).getByText('Rossi')).toBeInTheDocument();
    expect(within(sezione).getByText('2 fatture, 1 da 91 giorni')).toBeInTheDocument();
  });

  it('se le fatture non si leggono il resto della pagina funziona', async () => {
    vi.mocked(getFatture).mockRejectedValue(new Error('rete'));
    apri();
    const vaso = await screen.findByRole('region', { name: 'Conto tasse' });
    expect(within(vaso).getByTestId('saldo-vaso')).toHaveTextContent('400 €');
    expect(screen.getByText('Le fatture non si caricano ora.')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Da spostare' })).toBeInTheDocument();
  });

  it('+ Incasso apre la modalità incasso: importo a fuoco, conto, Chi facoltativo, niente Pagata adesso', async () => {
    apri();
    fireEvent.click(await screen.findByRole('button', { name: '+ Incasso' }));
    const foglio = await screen.findByRole('dialog', { name: 'Nuovo incasso' });
    expect(within(foglio).queryByRole('checkbox', { name: 'Pagata adesso' })).not.toBeInTheDocument();
    expect(within(foglio).getByLabelText('Importo (€)')).toHaveFocus();
    expect(within(foglio).getByLabelText('Chi')).toHaveValue('');
    expect(within(foglio).getByPlaceholderText('Chi ti ha pagato (se vuoi)')).toBeInTheDocument();
    expect(within(foglio).getByLabelText("Data dell'incasso")).toBeInTheDocument();
    // il conto di partenza è quello dell'ultimo incasso del fatturato
    expect(within(foglio).getByLabelText('Conto')).toHaveValue('a1');
    expect(within(foglio).queryByRole('option', { name: 'Conto tasse' })).not.toBeInTheDocument();
  });

  it('+ Fattura apre la nuova fattura con Pagata adesso spento', async () => {
    apri();
    fireEvent.click(await screen.findByRole('button', { name: '+ Fattura' }));
    const foglio = await screen.findByRole('dialog', { name: 'Nuova fattura' });
    expect(within(foglio).getByRole('checkbox', { name: 'Pagata adesso' })).not.toBeChecked();
    expect(within(foglio).getByLabelText('Chi')).toHaveValue('');
    expect(within(foglio).getByLabelText('Data di emissione')).toBeInTheDocument();
  });

  it('+ Incasso salva già pagata con Incasso in studio e apre il prompt della quota', async () => {
    apri();
    fireEvent.click(await screen.findByRole('button', { name: '+ Incasso' }));
    const foglio = await screen.findByRole('dialog', { name: 'Nuovo incasso' });
    // dopo il salvataggio l'entrata nuova è fra gli incassi riletti
    vi.mocked(getTransactions).mockResolvedValue([
      incasso('i-nuovo', '2026-11-17', 1000), incasso('i2', '2026-11-10', 600), incasso('i1', '2026-03-10', 5000),
    ]);
    vi.mocked(creaFattura).mockResolvedValue('f-nuova');
    vi.mocked(getFatture).mockResolvedValue([
      { id: 'f-nuova', cliente: 'Incasso in studio', importo: 1000, dataEmissione: '2026-11-17', dataIncasso: '2026-11-17', transactionId: 'i-nuovo', nota: null },
    ]);
    fireEvent.change(within(foglio).getByLabelText('Importo (€)'), { target: { value: '1000' } });
    fireEvent.click(within(foglio).getByRole('button', { name: 'Salva' }));
    await waitFor(() =>
      expect(creaFattura).toHaveBeenCalledWith(expect.anything(), {
        cliente: 'Incasso in studio', importo: 1000, dataEmissione: '2026-11-17', nota: null,
        incassaSu: { accountId: 'a1', categoriaId: 'cat-fatt' },
      })
    );
    expect(await screen.findByText('da mettere da parte sul conto tasse (su 1.000 € incassati)')).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Metti da parte le tasse' })).toHaveTextContent('137 €');
  });

  it('una fattura senza Pagata adesso crea solo la fattura, senza prompt', async () => {
    apri();
    fireEvent.click(await screen.findByRole('button', { name: '+ Fattura' }));
    const foglio = await screen.findByRole('dialog', { name: 'Nuova fattura' });
    fireEvent.change(within(foglio).getByLabelText('Chi'), { target: { value: 'Bianchi' } });
    fireEvent.change(within(foglio).getByLabelText('Importo (€)'), { target: { value: '500' } });
    fireEvent.click(within(foglio).getByRole('button', { name: 'Salva' }));
    await waitFor(() =>
      expect(creaFattura).toHaveBeenCalledWith(expect.anything(), {
        cliente: 'Bianchi', importo: 500, dataEmissione: '2026-11-17', nota: null,
      })
    );
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Nuova fattura' })).not.toBeInTheDocument());
    expect(screen.queryByText(/da mettere da parte sul conto tasse/)).not.toBeInTheDocument();
  });

  it('dopo Pagata si apre il prompt della quota con l importo della fattura', async () => {
    apri();
    const sezione = await screen.findByRole('region', { name: 'Fatture in attesa' });
    vi.mocked(getTransactions).mockResolvedValue([
      incasso('i-nuovo', '2026-11-17', 900), incasso('i2', '2026-11-10', 600), incasso('i1', '2026-03-10', 5000),
    ]);
    fireEvent.click(within(sezione).getByRole('button', { name: 'Le fatture una per una' }));
    fireEvent.click(within(within(sezione).getByText('Rossi').closest('li') as HTMLElement).getByRole('button', { name: 'Pagata' }));
    fireEvent.click(screen.getByRole('button', { name: 'Segna incassata' }));
    await waitFor(() =>
      expect(incassaFattura).toHaveBeenCalledWith(expect.anything(), 'f1', { data: '2026-11-17', accountId: 'a1', categoriaId: 'cat-fatt' })
    );
    expect(await screen.findByText('da mettere da parte sul conto tasse (su 900 € incassati)')).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Metti da parte le tasse' })).toHaveTextContent('123 €');
  });

  it('Modifica i parametri e Disattiva stanno sotto Impostazioni', async () => {
    const { onModifica, onDisattiva } = apri();
    await screen.findByText(/Di ogni incasso metti da parte il 13,7%/);
    expect(screen.queryByText('Modifica i parametri')).not.toBeInTheDocument();
    expect(screen.queryByText('Disattiva gestione P.IVA')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Impostazioni' }));
    fireEvent.click(screen.getByText('Modifica i parametri'));
    expect(onModifica).toHaveBeenCalled();
    fireEvent.click(screen.getByText('Disattiva gestione P.IVA'));
    await waitFor(() => expect(onDisattiva).toHaveBeenCalled());
  });

  it('nessuna parola vietata', async () => {
    apri();
    await screen.findByText(/Di ogni incasso metti da parte il 13,7%/);
    assertNessunaParolaVietata(document.body);
  });

  it('ogni Perché dice di cosa parla nel nome accessibile', async () => {
    apri({}, { stipendioMensile: 800, stipendioRivistoIl: '2026-11-01' });
    await screen.findByRole('region', { name: 'Conto tasse' });
    for (const nome of [
      'Perché? la percentuale',
      'Perché? il conto tasse',
      "Perché? le tasse di quest'anno",
      'Perché? da spostare',
      'Perché? lo stipendio',
      'Perché? le fatture',
    ]) {
      expect(screen.getByRole('button', { name: nome })).toBeInTheDocument();
    }
    expect(screen.queryByRole('button', { name: 'Perché?' })).not.toBeInTheDocument();
  });

  describe('stipendio', () => {
    it('senza storico fa la sola domanda del mese magro', async () => {
      apri();
      expect(await screen.findByLabelText('In un mese magro, quanto incassi più o meno?')).toBeInTheDocument();
    });

    it('con lo storico propone lo stipendio e Va bene lo salva con la data di oggi', async () => {
      vi.mocked(getTransactions).mockResolvedValue(STORICO);
      const { onSalvaStipendio } = apri();
      // A = 1000 al netto del 13,7% = 860; B = 300: proposta 300, il resto 560 va nel cuscinetto
      expect(await screen.findByText((_, el) => el?.tagName === 'P' && el.textContent === 'Ti propongo 300 € al mese.')).toBeInTheDocument();
      expect(screen.getByText('Il resto, 560 € al mese, va nel cuscinetto: una riserva per i mesi con pochi incassi.')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Va bene' }));
      await waitFor(() =>
        expect(onSalvaStipendio).toHaveBeenCalledWith({ stipendioMensile: 300, stipendioRivistoIl: '2026-11-17' })
      );
    });

    it('il mese magro si salva', async () => {
      const { onSalvaStipendio } = apri();
      fireEvent.change(await screen.findByLabelText('In un mese magro, quanto incassi più o meno?'), { target: { value: '900' } });
      fireEvent.click(screen.getByRole('button', { name: 'Continua' }));
      await waitFor(() => expect(onSalvaStipendio).toHaveBeenCalledWith({ incassoMeseMagro: 900 }));
    });

    it('con lo stipendio mostra quanto resta e il cuscinetto, calcolati come nella Home', async () => {
      vi.mocked(getTransactions).mockResolvedValue([...STORICO, spesa('sm', '2026-11-05', 200)]);
      apri({}, { stipendioMensile: 800, stipendioRivistoIl: '2026-11-01' });
      // conto a 900; incassi dalla guida (1/11): nessuno nel fatturato di novembre, quindi niente quote in sospeso.
      // rimasto = 800 - 200 = 600; cuscinetto = 900 - 600 = 300 (0,4 mesi)
      expect(await screen.findByRole('heading', { name: 'Stipendio di novembre' })).toBeInTheDocument();
      const stip = screen.getByRole('region', { name: 'Stipendio' });
      expect(within(stip).getByText('800 €')).toHaveClass('num', 'font-serif');
      expect(within(stip).getByText('Te ne restano 600 €')).toBeInTheDocument();
      expect(within(stip).getByText('300 €')).toBeInTheDocument();
      expect(within(stip).getByText('Copre 0,4 mesi')).toBeInTheDocument();
    });

    const rientroConto: Rientro = {
      id: 'r1', userId: 'u', householdId: null, goalId: null, accountId: 'risp', importo: 300, mesi: 3,
      creatoIl: '2026-11-01', stato: 'aperto', fermatoIl: null,
    };

    it('un rientro verso un conto risparmio da spostare toglie la rata, come nella Home', async () => {
      vi.mocked(getTransactions).mockResolvedValue([...STORICO, spesa('sm', '2026-11-05', 200)]);
      vi.mocked(leggiRientriESpostamenti).mockResolvedValue({ rientri: [rientroConto], spostamenti: [] });
      apri({}, { stipendioMensile: 800, stipendioRivistoIl: '2026-11-01' });
      // disponibile 900 - 100 di rata = 800; rimasto 600; cuscinetto 200
      const stip = await screen.findByRole('region', { name: 'Stipendio' });
      expect(await within(stip).findByText('Te ne restano 600 €')).toBeInTheDocument();
      expect(within(stip).getByText('200 €')).toBeInTheDocument();
    });

    it('se gli spostamenti non si leggono i rientri verso i conti si ignorano', async () => {
      vi.mocked(getTransactions).mockResolvedValue([...STORICO, spesa('sm', '2026-11-05', 200)]);
      vi.mocked(leggiRientriESpostamenti).mockResolvedValue({ rientri: [rientroConto], spostamenti: null });
      apri({}, { stipendioMensile: 800, stipendioRivistoIl: '2026-11-01' });
      const stip = await screen.findByRole('region', { name: 'Stipendio' });
      expect(await within(stip).findByText('300 €')).toBeInTheDocument();
    });

    it('il conto tasse con l interruttore acceso non gonfia il cuscinetto', async () => {
      vi.mocked(getTransactions).mockResolvedValue([...STORICO, spesa('sm', '2026-11-05', 200)]);
      vi.mocked(getAccounts).mockResolvedValue(conti.map((c) => (c.id === 'tasse' ? { ...c, contaInDisponibile: true } : c)));
      apri({}, { stipendioMensile: 800, stipendioRivistoIl: '2026-11-01' });
      const stip = await screen.findByRole('region', { name: 'Stipendio' });
      expect(await within(stip).findByText('Copre 0,4 mesi')).toBeInTheDocument();
      expect(within(stip).getByText('300 €')).toBeInTheDocument();
    });

    it('se la casa non si legge non propone uno stipendio sbagliato', async () => {
      vi.mocked(getTransactions).mockResolvedValue(STORICO);
      vi.mocked(leggiCasaPerStipendio).mockRejectedValue(new Error('rete'));
      apri();
      expect(await screen.findByText('Lo stipendio non si calcola ora. Riprova tra poco.')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Va bene' })).not.toBeInTheDocument();
      expect(screen.getByText(/Di ogni incasso metti da parte il 13,7%/)).toBeInTheDocument();
    });
  });

  describe('P9: stipendio superato', () => {
    it('oltre lo stipendio: 0 € rimasti e la frase calma, la stessa della Home', async () => {
      vi.mocked(getTransactions).mockResolvedValue([...STORICO, spesa('sm', '2026-11-05', 920)]);
      apri({}, { stipendioMensile: 800, stipendioRivistoIl: '2026-11-01' });
      const stip = await screen.findByRole('region', { name: 'Stipendio' });
      expect(await within(stip).findByText('Te ne restano 0 €')).toBeInTheDocument();
      expect(within(stip).getByText('Hai già speso 120 € più dello stipendio di questo mese.')).toBeInTheDocument();
      expect(stip.textContent).not.toMatch(/-\d/);
      assertNessunaParolaVietata(stip);
    });
    it('senza eccedenza nessuna frase', async () => {
      vi.mocked(getTransactions).mockResolvedValue([...STORICO, spesa('sm', '2026-11-05', 200)]);
      apri({}, { stipendioMensile: 800, stipendioRivistoIl: '2026-11-01' });
      await screen.findByText('Te ne restano 600 €');
      expect(screen.queryByText(/Hai già speso/)).not.toBeInTheDocument();
    });
  });

  describe('P4: conti che non contano e Scarta', () => {
    it('un incasso su un conto fuori dal disponibile non chiede la quota', async () => {
      vi.mocked(getTransactions).mockResolvedValue([{ ...incasso('i2', '2026-11-10', 600), accountId: 'risp' }]);
      vi.mocked(getAccounts).mockResolvedValue([
        ...conti,
        { id: 'risp', nome: 'Risparmi', saldoAttuale: 100, contaInDisponibile: false, targetSaldo: null, archiviato: false },
      ]);
      apri();
      const lista = await screen.findByRole('region', { name: 'Da spostare' });
      expect(within(lista).getByText('Niente da spostare: sei in pari con gli incassi.')).toBeInTheDocument();
    });

    it('una quota già scartata non compare', async () => {
      vi.mocked(getQuoteScartate).mockResolvedValue(new Set(['i2']));
      apri();
      const lista = await screen.findByRole('region', { name: 'Da spostare' });
      expect(within(lista).getByText('Niente da spostare: sei in pari con gli incassi.')).toBeInTheDocument();
    });

    it('se le quote scartate non si leggono la quota resta da spostare', async () => {
      vi.mocked(getQuoteScartate).mockRejectedValue(new Error('rete'));
      apri();
      const lista = await screen.findByRole('region', { name: 'Da spostare' });
      expect(within(lista).getByText('Metti da parte 82 €')).toBeInTheDocument();
    });

    it('Scarta chiede conferma con una frase calma, poi scrive e rilegge', async () => {
      apri();
      const lista = await screen.findByRole('region', { name: 'Da spostare' });
      fireEvent.click(within(lista).getByRole('button', { name: 'Scarta' }));
      expect(within(lista).getByText('Non metti da parte niente per questo incasso.')).toBeInTheDocument();
      expect(scartaQuota).not.toHaveBeenCalled();
      assertNessunaParolaVietata(lista);
      fireEvent.click(within(lista).getByRole('button', { name: 'Sì, scarta' }));
      await waitFor(() => expect(scartaQuota).toHaveBeenCalledWith(expect.anything(), 'i2', '2026-11-17'));
      await waitFor(() => expect(getQuoteScartate).toHaveBeenCalledTimes(2));
    });

    it('"Tieni" chiude la conferma senza scrivere', async () => {
      apri();
      const lista = await screen.findByRole('region', { name: 'Da spostare' });
      fireEvent.click(within(lista).getByRole('button', { name: 'Scarta' }));
      fireEvent.click(within(lista).getByRole('button', { name: 'Tieni' }));
      expect(scartaQuota).not.toHaveBeenCalled();
      expect(within(lista).getByText('Metti da parte 82 €')).toBeInTheDocument();
      expect(within(lista).queryByText('Non metti da parte niente per questo incasso.')).not.toBeInTheDocument();
    });

    it('se Scarta non riesce lo dice e la quota resta', async () => {
      vi.mocked(scartaQuota).mockRejectedValue(new Error('rete'));
      apri();
      const lista = await screen.findByRole('region', { name: 'Da spostare' });
      fireEvent.click(within(lista).getByRole('button', { name: 'Scarta' }));
      fireEvent.click(within(lista).getByRole('button', { name: 'Sì, scarta' }));
      expect(await within(lista).findByText('Non è riuscito. Riprova.')).toBeInTheDocument();
      expect(within(lista).getByText('Metti da parte 82 €')).toBeInTheDocument();
    });
  });

  it('P5: dopo il cambio di categoria (categoriaDal) gli incassi precedenti non chiedono la quota', async () => {
    apri({}, { categoriaDal: '2026-11-12' });
    const lista = await screen.findByRole('region', { name: 'Da spostare' });
    expect(within(lista).getByText('Niente da spostare: sei in pari con gli incassi.')).toBeInTheDocument();
  });

  describe('P2: scadenze dell anno dopo', () => {
    const anniCreati = () => vi.mocked(assicuraScadenze).mock.calls.flatMap((c) => c[1].map((r) => r.anno));
    it('dopo il 15 dicembre si creano anche le scadenze dell anno dopo', async () => {
      vi.setSystemTime(new Date('2026-12-20T12:00:00Z'));
      apri();
      await screen.findByRole('region', { name: 'Conto tasse' });
      expect(new Set(anniCreati())).toEqual(new Set([2026, 2027]));
    });
    it('a novembre solo quelle dell anno', async () => {
      apri();
      await screen.findByRole('region', { name: 'Conto tasse' });
      expect(new Set(anniCreati())).toEqual(new Set([2026]));
    });
    it('se le righe dell anno dopo non si creano la pagina resta usabile', async () => {
      vi.setSystemTime(new Date('2026-12-20T12:00:00Z'));
      vi.mocked(assicuraScadenze).mockImplementation(async (_s, righe) => {
        if (righe.some((r) => r.anno === 2027)) throw new Error('rete');
      });
      apri();
      expect(await screen.findByRole('region', { name: 'Conto tasse' })).toBeInTheDocument();
    });
  });

  it('se la ricarica dopo un incasso fallisce non resta una quota aperta che salta fuori dopo', async () => {
    apri();
    const sezione = await screen.findByRole('region', { name: 'Fatture in attesa' });
    vi.mocked(getTransactions).mockRejectedValue(new Error('rete'));
    fireEvent.click(within(sezione).getByRole('button', { name: 'Le fatture una per una' }));
    fireEvent.click(within(within(sezione).getByText('Rossi').closest('li') as HTMLElement).getByRole('button', { name: 'Pagata' }));
    fireEvent.click(screen.getByRole('button', { name: 'Segna incassata' }));
    expect(await screen.findByText(/non riesco ad aggiornare/)).toBeInTheDocument();
    // più tardi la lettura torna e l'incasso c'è: il foglio della quota non deve comparire da solo
    vi.mocked(getTransactions).mockResolvedValue([
      incasso('i-nuovo', '2026-11-17', 900), incasso('i2', '2026-11-10', 600), incasso('i1', '2026-03-10', 5000),
    ]);
    fireEvent.click(await screen.findByRole('button', { name: '+ Fattura' }));
    const foglio = await screen.findByRole('dialog', { name: 'Nuova fattura' });
    fireEvent.change(within(foglio).getByLabelText('Chi'), { target: { value: 'Bianchi' } });
    fireEvent.change(within(foglio).getByLabelText('Importo (€)'), { target: { value: '500' } });
    fireEvent.click(within(foglio).getByRole('button', { name: 'Salva' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Nuova fattura' })).not.toBeInTheDocument());
    expect(screen.queryByText(/da mettere da parte sul conto tasse/)).not.toBeInTheDocument();
  });
});

describe('PivaHub fumetto', () => {
  it('la cifra del vaso porta data-fumetto="piva"', async () => {
    apri();
    const cifra = await screen.findByTestId('saldo-vaso');
    expect(cifra).toHaveAttribute('data-fumetto', 'piva');
  });
});
