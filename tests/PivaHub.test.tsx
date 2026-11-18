import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { PivaHub } from '@/app/piva/PivaHub';
import { assertNessunaParolaVietata } from './helpers/paroleVietate';
import type { PivaSettings, Transaction } from '@/lib/types';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }));
vi.mock('@/lib/data/transactions', () => ({ getTransactions: vi.fn() }));
vi.mock('@/lib/data/accounts', () => ({ getAccounts: vi.fn() }));
vi.mock('@/lib/data/piva', () => ({
  getAccantonamenti: vi.fn(),
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
import { leggiCasaPerStipendio, leggiGoalsConSpeso } from '@/lib/pivaHome';
import {
  getAccantonamenti, accantonaTasse, assicuraScadenze, getScadenze, getFatture, creaFattura, incassaFattura,
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
};

const conti = [
  { id: 'a1', nome: 'Conto corrente', saldoAttuale: 900, contaInDisponibile: true, targetSaldo: null },
  { id: 'tasse', nome: 'Conto tasse', saldoAttuale: 400, contaInDisponibile: false, targetSaldo: null },
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
  vi.mocked(leggiCasaPerStipendio).mockReset().mockResolvedValue(null);
  vi.mocked(leggiGoalsConSpeso).mockReset().mockResolvedValue([]);
});

afterEach(() => vi.useRealTimers());

describe('PivaHub', () => {
  it('dice la percentuale di ogni incasso', async () => {
    apri();
    expect(await screen.findByText(/13,7% di ogni incasso/)).toBeInTheDocument();
  });

  it('il vaso mostra il saldo del conto tasse e il confronto dell anno', async () => {
    apri();
    const vaso = await screen.findByRole('region', { name: 'Conto tasse' });
    expect(within(vaso).getByText('400,00 €')).toBeInTheDocument();
    // 5600 incassati: 4368 di reddito, 218 + 856 + 112 = 1186 di stima
    expect(within(vaso).getByText(/Quest'anno servono circa 1\.186 €, ne hai messi da parte 400 €/)).toBeInTheDocument();
  });

  it('il Perché del vaso spiega la stima e dice che la conferma è del commercialista, una volta sola', async () => {
    apri();
    const vaso = await screen.findByRole('region', { name: 'Conto tasse' });
    expect(screen.queryByText(/la conferma è del commercialista/)).not.toBeInTheDocument();
    const bottoni = within(vaso).getAllByRole('button', { name: 'Perché?' });
    fireEvent.click(bottoni[bottoni.length - 1]);
    expect(screen.getAllByText(/la conferma è del commercialista/)).toHaveLength(1);
    expect(within(vaso).getByText('Imposta sostitutiva')).toBeInTheDocument();
    expect(within(vaso).getByText("Incassato quest'anno")).toBeInTheDocument();
  });

  it('il Perché della percentuale la divide in imposta, soggettivo e integrativo', async () => {
    apri();
    const sezione = await screen.findByRole('region', { name: 'Quanto mettere da parte' });
    fireEvent.click(within(sezione).getByRole('button', { name: 'Perché?' }));
    expect(within(sezione).getByText(/Imposta sostitutiva \(78% × 5%\)/)).toBeInTheDocument();
    expect(within(sezione).getByText(/Contributo soggettivo \(78% × 10%\)/)).toBeInTheDocument();
    expect(within(sezione).getByText('Contributo integrativo')).toBeInTheDocument();
    expect(within(sezione).queryByText(/la conferma è del commercialista/)).not.toBeInTheDocument();
  });

  it('Da spostare elenca le quote in sospeso e Fatto le sposta', async () => {
    apri();
    const lista = await screen.findByRole('region', { name: 'Da spostare' });
    // solo l'incasso dal giorno della guida (10 novembre): 13,7% di 600 = 82
    expect(within(lista).getByText(/82 €/)).toBeInTheDocument();
    expect(within(lista).getAllByRole('button', { name: 'Fatto' })).toHaveLength(1);
    fireEvent.click(within(lista).getByRole('button', { name: 'Fatto' }));
    // Fatto apre il foglio con la quota modificabile
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
    expect(within(vaso).getByText('prossima F24 30/11')).toBeInTheDocument();
    const sezione = screen.getByRole('region', { name: "Scadenze dell'anno" });
    expect(within(sezione).getByText('F24 di novembre: secondo acconto')).toBeInTheDocument();
  });

  it('se le scadenze non si caricano il vaso e le quote restano usabili', async () => {
    vi.mocked(assicuraScadenze).mockRejectedValue(new Error('rete'));
    apri();
    const vaso = await screen.findByRole('region', { name: 'Conto tasse' });
    expect(within(vaso).getByText('400,00 €')).toBeInTheDocument();
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
    expect(within(sezione).getByText('Ti devono 1.200 €')).toBeInTheDocument();
    expect(within(sezione).getByText('2 fatture, 1 da 91 giorni')).toBeInTheDocument();
  });

  it('se le fatture non si leggono il resto della pagina funziona', async () => {
    vi.mocked(getFatture).mockRejectedValue(new Error('rete'));
    apri();
    const vaso = await screen.findByRole('region', { name: 'Conto tasse' });
    expect(within(vaso).getByText('400,00 €')).toBeInTheDocument();
    expect(screen.getByText('Le fatture non si caricano ora.')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Da spostare' })).toBeInTheDocument();
  });

  it('+ Incasso apre la nuova fattura già pagata, con Incasso diretto', async () => {
    apri();
    fireEvent.click(await screen.findByRole('button', { name: '+ Incasso' }));
    const foglio = await screen.findByRole('dialog', { name: 'Nuovo incasso' });
    expect(within(foglio).getByRole('checkbox', { name: 'Pagata adesso' })).toBeChecked();
    expect(within(foglio).getByLabelText('Chi')).toHaveValue('Incasso diretto');
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
  });

  it('Pagata adesso chiama creaFattura con incassaSu e apre il prompt della quota', async () => {
    apri();
    fireEvent.click(await screen.findByRole('button', { name: '+ Incasso' }));
    const foglio = await screen.findByRole('dialog', { name: 'Nuovo incasso' });
    // dopo il salvataggio l'entrata nuova è fra gli incassi riletti
    vi.mocked(getTransactions).mockResolvedValue([
      incasso('i-nuovo', '2026-11-17', 1000), incasso('i2', '2026-11-10', 600), incasso('i1', '2026-03-10', 5000),
    ]);
    vi.mocked(creaFattura).mockResolvedValue('f-nuova');
    vi.mocked(getFatture).mockResolvedValue([
      { id: 'f-nuova', cliente: 'Incasso diretto', importo: 1000, dataEmissione: '2026-11-17', dataIncasso: '2026-11-17', transactionId: 'i-nuovo', nota: null },
    ]);
    fireEvent.change(within(foglio).getByLabelText('Importo (€)'), { target: { value: '1000' } });
    fireEvent.click(within(foglio).getByRole('button', { name: 'Salva' }));
    await waitFor(() =>
      expect(creaFattura).toHaveBeenCalledWith(expect.anything(), {
        cliente: 'Incasso diretto', importo: 1000, dataEmissione: '2026-11-17', nota: null,
        incassaSu: { accountId: 'a1', categoriaId: 'cat-fatt' },
      })
    );
    expect(await screen.findByText('Di 1.000 € metti da parte 137 € sul conto tasse')).toBeInTheDocument();
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
    expect(screen.queryByText(/sul conto tasse$/)).not.toBeInTheDocument();
  });

  it('dopo Pagata si apre il prompt della quota con l importo della fattura', async () => {
    apri();
    const sezione = await screen.findByRole('region', { name: 'Fatture in attesa' });
    vi.mocked(getTransactions).mockResolvedValue([
      incasso('i-nuovo', '2026-11-17', 900), incasso('i2', '2026-11-10', 600), incasso('i1', '2026-03-10', 5000),
    ]);
    fireEvent.click(within(within(sezione).getByText('Rossi').closest('li') as HTMLElement).getByRole('button', { name: 'Pagata' }));
    fireEvent.click(screen.getByRole('button', { name: 'Segna incassata' }));
    await waitFor(() =>
      expect(incassaFattura).toHaveBeenCalledWith(expect.anything(), 'f1', { data: '2026-11-17', accountId: 'a1', categoriaId: 'cat-fatt' })
    );
    expect(await screen.findByText('Di 900 € metti da parte 123 € sul conto tasse')).toBeInTheDocument();
  });

  it('Modifica i parametri e Disattiva stanno sotto Impostazioni', async () => {
    const { onModifica, onDisattiva } = apri();
    await screen.findByText(/13,7% di ogni incasso/);
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
    await screen.findByText(/13,7% di ogni incasso/);
    assertNessunaParolaVietata(document.body);
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
      expect(await screen.findByText('Ti propongo 300 € al mese.')).toBeInTheDocument();
      expect(screen.getByText('Il resto, 560 € al mese, riempie il cuscinetto.')).toBeInTheDocument();
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
      expect(await screen.findByText('Stipendio di questo mese 800 € (te ne restano 600 €)')).toBeInTheDocument();
      expect(screen.getByText('Cuscinetto 300 € copre 0,4 mesi')).toBeInTheDocument();
    });

    it('se la casa non si legge non propone uno stipendio sbagliato', async () => {
      vi.mocked(getTransactions).mockResolvedValue(STORICO);
      vi.mocked(leggiCasaPerStipendio).mockRejectedValue(new Error('rete'));
      apri();
      expect(await screen.findByText('Lo stipendio non si calcola ora. Riprova tra poco.')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Va bene' })).not.toBeInTheDocument();
      expect(screen.getByText(/13,7% di ogni incasso/)).toBeInTheDocument();
    });
  });

  it('se la ricarica dopo un incasso fallisce non resta una quota aperta che salta fuori dopo', async () => {
    apri();
    const sezione = await screen.findByRole('region', { name: 'Fatture in attesa' });
    vi.mocked(getTransactions).mockRejectedValue(new Error('rete'));
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
    expect(screen.queryByText(/metti da parte .* sul conto tasse/)).not.toBeInTheDocument();
  });
});
