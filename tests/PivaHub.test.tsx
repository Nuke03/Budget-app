import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { PivaHub } from '@/app/piva/PivaHub';
import { assertNessunaParolaVietata } from './helpers/paroleVietate';
import type { Category, PivaSettings, Transaction } from '@/lib/types';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }));
vi.mock('@/lib/data/transactions', () => ({ getTransactions: vi.fn() }));
vi.mock('@/lib/data/accounts', () => ({ getAccounts: vi.fn() }));
vi.mock('@/lib/data/piva', () => ({ getAccantonamenti: vi.fn(), accantonaTasse: vi.fn() }));

import { getTransactions } from '@/lib/data/transactions';
import { getAccounts } from '@/lib/data/accounts';
import { getAccantonamenti, accantonaTasse } from '@/lib/data/piva';

const categorie: Category[] = [{ id: 'cat-fatt', nome: 'Compensi', tipo: 'income', colore: null, archiviata: false }];

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

function apri(over: { onModifica?: () => void; onDisattiva?: () => Promise<void> } = {}) {
  const props = { onModifica: vi.fn(), onDisattiva: vi.fn().mockResolvedValue(undefined), ...over };
  render(<PivaHub settings={settings} categories={categorie} {...props} />);
  return props;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-17T12:00:00Z') });
  vi.mocked(getAccounts).mockResolvedValue(conti);
  vi.mocked(getTransactions).mockResolvedValue([incasso('i2', '2026-11-10', 600), incasso('i1', '2026-03-10', 5000)]);
  vi.mocked(getAccantonamenti).mockReset();
  vi.mocked(getAccantonamenti).mockResolvedValue([
    { id: 'pa1', transactionId: 'i0', importo: 400, data: '2026-11-12', daAccountId: 'a1', aAccountId: 'tasse' },
  ]);
  vi.mocked(accantonaTasse).mockReset();
  vi.mocked(accantonaTasse).mockResolvedValue('pa-nuovo');
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
    const fatto = within(lista).getByRole('button', { name: 'Fatto' });
    fireEvent.click(fatto);
    fireEvent.click(fatto);
    expect(accantonaTasse).toHaveBeenCalledTimes(1);
    expect(fatto).toBeDisabled();
    finisci('x');
  });

  it('senza quote in sospeso dice che non c è niente da spostare', async () => {
    vi.mocked(getAccantonamenti).mockResolvedValue([
      { id: 'pa1', transactionId: 'i2', importo: 82, data: '2026-11-12', daAccountId: 'a1', aAccountId: 'tasse' },
    ]);
    apri();
    expect(await screen.findByText('Niente da spostare: sei in pari con gli incassi.')).toBeInTheDocument();
  });

  it('+ Incasso apre il modulo con entrata e categoria del fatturato', async () => {
    apri();
    fireEvent.click(await screen.findByRole('button', { name: '+ Incasso' }));
    const foglio = await screen.findByRole('dialog', { name: 'Nuova transazione' });
    expect(within(foglio).getByRole('button', { name: 'Entrata' })).toBeInTheDocument();
    expect(within(foglio).getByRole('button', { name: 'Compensi' })).toBeInTheDocument();
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
});
