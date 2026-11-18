import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ScadenzePiva } from '@/app/piva/ScadenzePiva';
import type { PivaScadenza } from '@/lib/types';

vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }));
vi.mock('@/lib/data/piva', () => ({
  updateScadenza: vi.fn(),
  pagaScadenza: vi.fn(),
  nascondiScadenza: vi.fn(),
}));
const elimina = vi.fn();
vi.mock('@/app/AnnullaProvider', () => ({ useEliminaConAnnulla: () => elimina }));

import { updateScadenza, pagaScadenza, nascondiScadenza } from '@/lib/data/piva';

const nov = (over: Partial<PivaScadenza> = {}): PivaScadenza => ({
  id: 's1',
  anno: 2026,
  chiave: 'f24_novembre',
  tipo: 'f24',
  descrizione: 'F24 di novembre: secondo acconto',
  data: '2026-11-30',
  importo: null,
  pagataIl: null,
  transactionId: null,
  nascosta: false,
  ...over,
});

function apri(scadenze: PivaScadenza[], over: { saldoVaso?: number; guidataDal?: string; anno?: number } = {}) {
  const onCambiato = vi.fn();
  const r = render(
    <ScadenzePiva
      scadenze={scadenze}
      saldoVaso={over.saldoVaso ?? 3100}
      contoTasseId="tasse"
      guidataDal={over.guidataDal ?? '2026-11-17'}
      anno={over.anno ?? 2026}
      oggi="2026-11-17"
      onCambiato={onCambiato}
    />
  );
  return { onCambiato, ...r };
}

beforeEach(() => {
  vi.mocked(updateScadenza).mockReset().mockResolvedValue(undefined);
  vi.mocked(pagaScadenza).mockReset().mockResolvedValue('tx1');
  vi.mocked(nascondiScadenza).mockReset().mockResolvedValue(undefined);
  elimina.mockReset();
});

describe('ScadenzePiva', () => {
  it('una scadenza senza importo mostra "cifra in arrivo dal commercialista" e nessuna cifra', () => {
    apri([nov()]);
    expect(screen.getByText('F24 di novembre: secondo acconto')).toBeInTheDocument();
    expect(screen.getByText('cifra in arrivo dal commercialista')).toBeInTheDocument();
    expect(screen.queryByText(/Nel vaso ci sono/)).not.toBeInTheDocument();
    expect(screen.queryByText(/€/)).not.toBeInTheDocument();
  });

  it('Inserisci la cifra salva importo e data', async () => {
    const { onCambiato } = apri([nov()]);
    fireEvent.click(screen.getByRole('button', { name: 'Inserisci la cifra' }));
    fireEvent.change(screen.getByLabelText('Importo (€)'), { target: { value: '3400' } });
    fireEvent.change(screen.getByLabelText('Data'), { target: { value: '2026-11-28' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salva' }));
    await waitFor(() =>
      expect(updateScadenza).toHaveBeenCalledWith(expect.anything(), 's1', { importo: 3400, data: '2026-11-28' })
    );
    await waitFor(() => expect(onCambiato).toHaveBeenCalled());
  });

  it('con la cifra: confronto col vaso, 3100 su 3400 mancano 300', () => {
    apri([nov({ importo: 3400 })]);
    expect(screen.getByText(/Nel vaso ci sono 3\.100 €, servono 3\.400 €/)).toBeInTheDocument();
    expect(screen.getByText(/mancano 300 €: alziamo la percentuale/)).toBeInTheDocument();
  });

  it('con la cifra e il vaso pieno: niente mancante', () => {
    apri([nov({ importo: 3000 })]);
    expect(screen.getByText(/Nel vaso ci sono 3\.100 €, servono 3\.000 €/)).toBeInTheDocument();
    expect(screen.queryByText(/mancano/)).not.toBeInTheDocument();
  });

  it('Pagata paga dal conto tasse con la cifra della scadenza', async () => {
    const { onCambiato } = apri([nov({ importo: 3400 })]);
    fireEvent.click(screen.getByRole('button', { name: 'Pagata' }));
    await waitFor(() =>
      expect(pagaScadenza).toHaveBeenCalledWith(expect.anything(), 's1', {
        importo: 3400,
        data: '2026-11-17',
        accountId: 'tasse',
      })
    );
    await waitFor(() => expect(onCambiato).toHaveBeenCalled());
  });

  it('Pagata due volte non registra due uscite', () => {
    let finisci: (v: string) => void = () => {};
    vi.mocked(pagaScadenza).mockReturnValue(new Promise<string>((r) => (finisci = r)));
    apri([nov({ importo: 3400 })]);
    const pagata = screen.getByRole('button', { name: 'Pagata' });
    fireEvent.click(pagata);
    fireEvent.click(pagata);
    expect(pagaScadenza).toHaveBeenCalledTimes(1);
    expect(pagata).toBeDisabled();
    finisci('tx1');
  });

  it('Pagata senza cifra chiede prima la cifra', async () => {
    apri([nov()]);
    fireEvent.click(screen.getByRole('button', { name: 'Pagata' }));
    expect(pagaScadenza).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Importo (€)'), { target: { value: '2500' } });
    fireEvent.click(screen.getByRole('button', { name: 'Pagata, registra' }));
    await waitFor(() =>
      expect(pagaScadenza).toHaveBeenCalledWith(expect.anything(), 's1', {
        importo: 2500,
        data: '2026-11-17',
        accountId: 'tasse',
      })
    );
  });

  it('una scadenza pagata non ha più i pulsanti', () => {
    apri([nov({ importo: 3400, pagataIl: '2026-11-18' })]);
    expect(screen.getByText(/Pagata il 18\/11\/2026/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pagata' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Nel vaso ci sono/)).not.toBeInTheDocument();
  });

  it('Togli nasconde con annullamento e scrive nascosta', async () => {
    apri([nov()]);
    fireEvent.click(screen.getByRole('button', { name: 'Togli' }));
    expect(elimina).toHaveBeenCalledTimes(1);
    const r = elimina.mock.calls[0][0];
    expect(r.id).toBe('s1');
    r.nascondi();
    await waitFor(() => expect(screen.queryByText('F24 di novembre: secondo acconto')).not.toBeInTheDocument());
    await r.esegui();
    expect(nascondiScadenza).toHaveBeenCalledWith(expect.anything(), 's1', true);
    r.ripristina();
    await waitFor(() => expect(screen.getByText('F24 di novembre: secondo acconto')).toBeInTheDocument());
  });

  it('Pagata riuscita ma ricarica fallita: nessun errore dell azione', async () => {
    const { onCambiato } = apri([nov({ importo: 3400 })]);
    onCambiato.mockRejectedValue(new Error('rete'));
    fireEvent.click(screen.getByRole('button', { name: 'Pagata' }));
    await waitFor(() => expect(onCambiato).toHaveBeenCalled());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('Togli confermato avvisa il hub', async () => {
    const onNascosta = vi.fn();
    render(
      <ScadenzePiva
        scadenze={[nov()]}
        saldoVaso={0}
        contoTasseId="tasse"
        guidataDal="2026-11-17"
        anno={2026}
        oggi="2026-11-17"
        onCambiato={vi.fn()}
        onNascosta={onNascosta}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Togli' }));
    await elimina.mock.calls[0][0].esegui();
    expect(onNascosta).toHaveBeenCalledWith('s1');
  });

  it("la nota del primo anno compare solo nell'anno di guidataDal", () => {
    const nota =
      "Gli acconti si calcolano sulle tasse dell'anno prima: quest'anno le cifre possono non coincidere con quanto hai messo da parte.";
    const { unmount } = apri([nov()]);
    expect(screen.getAllByText(nota)).toHaveLength(1);
    unmount();
    apri([nov({ anno: 2027, data: '2027-11-30' })], { anno: 2027 });
    expect(screen.queryByText(nota)).not.toBeInTheDocument();
  });

  it('spiega acconto e saldo una volta sola', () => {
    apri([
      nov(),
      nov({ id: 's2', chiave: 'cassa_acconto', tipo: 'cassa', descrizione: 'ENPAP: acconto', data: '2026-12-01' }),
    ]);
    expect(screen.getAllByText(/Un acconto è una parte delle tasse pagata in anticipo/)).toHaveLength(1);
    expect(screen.getAllByText(/il saldo è quello che resta/)).toHaveLength(1);
  });
});
