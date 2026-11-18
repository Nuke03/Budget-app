import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { FattureInAttesa } from '@/app/piva/FattureInAttesa';
import type { PivaFattura } from '@/lib/types';

vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }));
vi.mock('@/lib/data/piva', () => ({
  incassaFattura: vi.fn(),
  updateFattura: vi.fn(),
  deleteFattura: vi.fn(),
}));
const elimina = vi.fn();
vi.mock('@/app/AnnullaProvider', () => ({ useEliminaConAnnulla: () => elimina }));

import { incassaFattura, updateFattura, deleteFattura } from '@/lib/data/piva';

const fattura = (id: string, dataEmissione: string, importo: number, dataIncasso: string | null = null): PivaFattura => ({
  id, cliente: `Cliente ${id}`, importo, dataEmissione, dataIncasso, transactionId: dataIncasso ? `t-${id}` : null, nota: null,
});

const conti = [
  { id: 'a1', nome: 'Corrente' },
  { id: 'a2', nome: 'Risparmi' },
];

const tre = [
  fattura('a', '2026-08-18', 1000),
  fattura('b', '2026-10-20', 300),
  fattura('c', '2026-11-01', 100),
];

function apri(fatture: PivaFattura[] = tre, over: Partial<React.ComponentProps<typeof FattureInAttesa>> = {}) {
  const props = {
    fatture,
    oggi: '2026-11-17',
    conti,
    contoIniziale: 'a1',
    categoriaId: 'cat',
    onIncassata: vi.fn().mockResolvedValue(undefined),
    onCambiato: vi.fn().mockResolvedValue(undefined),
    onTolta: vi.fn(),
    ...over,
  };
  const r = render(<FattureInAttesa {...props} />);
  return { props, ...r };
}

beforeEach(() => {
  vi.mocked(incassaFattura).mockReset().mockResolvedValue('tx-nuova');
  vi.mocked(updateFattura).mockReset().mockResolvedValue(undefined);
  vi.mocked(deleteFattura).mockReset().mockResolvedValue(1);
  elimina.mockReset();
});

describe('FattureInAttesa', () => {
  it('mostra il totale e il riassunto con la fattura vecchia', () => {
    apri();
    expect(screen.getByText('Ti devono 1.400 €')).toBeInTheDocument();
    expect(screen.getByText('3 fatture, 1 da 91 giorni')).toBeInTheDocument();
  });

  it('ordina dalla più vecchia', () => {
    apri();
    const righe = screen.getAllByRole('listitem');
    expect(within(righe[0]).getByText('Cliente a')).toBeInTheDocument();
    expect(within(righe[2]).getByText('Cliente c')).toBeInTheDocument();
  });

  it('il Perché della lista ha il testo della spec', () => {
    apri();
    fireEvent.click(screen.getByRole('button', { name: 'Perché?' }));
    expect(
      screen.getByText(
        'Nel forfettario le tasse si pagano su quello che incassi, non su quello che fatturi. Questa fattura non è ancora soldi tuoi, ma neanche tasse da pagare.'
      )
    ).toBeInTheDocument();
  });

  it('senza fatture in attesa lo dice con calma', () => {
    apri([]);
    expect(screen.getByText('Nessuna fattura in attesa.')).toBeInTheDocument();
  });

  it('Pagata chiede data e conto, poi incassa e passa l entrata creata', async () => {
    const { props } = apri();
    const prima = screen.getAllByRole('listitem')[1];
    fireEvent.click(within(prima).getByRole('button', { name: 'Pagata' }));
    expect(screen.getByLabelText('Data')).toHaveValue('2026-11-17');
    expect(screen.getByLabelText('Conto')).toHaveValue('a1');
    fireEvent.change(screen.getByLabelText('Conto'), { target: { value: 'a2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Segna incassata' }));
    await waitFor(() =>
      expect(incassaFattura).toHaveBeenCalledWith(expect.anything(), 'b', { data: '2026-11-17', accountId: 'a2', categoriaId: 'cat' })
    );
    await waitFor(() => expect(props.onIncassata).toHaveBeenCalledWith('tx-nuova'));
  });

  it('Pagata non si ripete mentre è in corso', () => {
    let finisci: (v: string) => void = () => {};
    vi.mocked(incassaFattura).mockReturnValue(new Promise<string>((r) => (finisci = r)));
    apri();
    fireEvent.click(within(screen.getAllByRole('listitem')[0]).getByRole('button', { name: 'Pagata' }));
    const conferma = screen.getByRole('button', { name: 'Segna incassata' });
    fireEvent.click(conferma);
    fireEvent.click(conferma);
    expect(incassaFattura).toHaveBeenCalledTimes(1);
    expect(conferma).toBeDisabled();
    finisci('x');
  });

  it('se incassare fallisce lo dice e non apre nulla', async () => {
    vi.mocked(incassaFattura).mockRejectedValue(new Error('x'));
    const { props } = apri();
    fireEvent.click(within(screen.getAllByRole('listitem')[0]).getByRole('button', { name: 'Pagata' }));
    fireEvent.click(screen.getByRole('button', { name: 'Segna incassata' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Non è riuscito. Riprova.');
    expect(props.onIncassata).not.toHaveBeenCalled();
  });

  it('una fattura incassata non si modifica: dice quando e rimanda allo Storico', () => {
    apri([fattura('z', '2026-10-01', 250, '2026-10-20'), fattura('b', '2026-10-20', 300)]);
    expect(screen.getByText('Ti devono 300 €')).toBeInTheDocument();
    const riga = screen.getByText('Cliente z').closest('li') as HTMLElement;
    expect(within(riga).getByText(/incassata il 20\/10\/2026/)).toBeInTheDocument();
    expect(within(riga).getByRole('link', { name: /Storico/ })).toHaveAttribute('href', '/history');
    expect(within(riga).queryByRole('button')).not.toBeInTheDocument();
  });

  it('eliminare l entrata nello storico riporta la fattura in attesa', () => {
    const { rerender, props } = apri([fattura('z', '2026-11-10', 250, '2026-11-12')]);
    expect(screen.getByText('Nessuna fattura in attesa.')).toBeInTheDocument();
    // il trigger del database riapre la fattura: il dato riletto ha dataIncasso null
    rerender(<FattureInAttesa {...props} fatture={[fattura('z', '2026-11-10', 250, null)]} />);
    expect(screen.getByText('Ti devono 250 €')).toBeInTheDocument();
    expect(within(screen.getByText('Cliente z').closest('li') as HTMLElement).getByRole('button', { name: 'Pagata' })).toBeInTheDocument();
  });

  it('Elimina passa da annulla e toglie la fattura solo dopo l attesa', async () => {
    const { props } = apri();
    fireEvent.click(within(screen.getAllByRole('listitem')[0]).getByRole('button', { name: 'Elimina' }));
    expect(elimina).toHaveBeenCalledTimes(1);
    const richiesta = elimina.mock.calls[0][0];
    expect(richiesta.id).toBe('a');
    expect(deleteFattura).not.toHaveBeenCalled();
    richiesta.nascondi();
    await waitFor(() => expect(screen.queryByText('Cliente a')).not.toBeInTheDocument());
    expect(screen.getByText('Ti devono 400 €')).toBeInTheDocument();
    richiesta.ripristina();
    await waitFor(() => expect(screen.getByText('Cliente a')).toBeInTheDocument());
    await richiesta.esegui();
    expect(deleteFattura).toHaveBeenCalledWith(expect.anything(), 'a');
    expect(props.onTolta).toHaveBeenCalledWith('a');
  });

  it('Modifica cambia chi, quanto e data della fattura in attesa', async () => {
    const { props } = apri();
    fireEvent.click(within(screen.getAllByRole('listitem')[1]).getByRole('button', { name: 'Modifica' }));
    fireEvent.change(screen.getByLabelText('Importo (€)'), { target: { value: '350' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salva' }));
    await waitFor(() =>
      expect(updateFattura).toHaveBeenCalledWith(expect.anything(), 'b', {
        cliente: 'Cliente b', importo: 350, dataEmissione: '2026-10-20', nota: null,
      })
    );
    await waitFor(() => expect(props.onCambiato).toHaveBeenCalled());
  });
});
