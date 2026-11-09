import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CostiIngresso } from '@/app/casa/da-parte/CostiIngresso';
import { AVVISO_COSTI } from '@/lib/calculations/casa/costiIngresso';
import { assertNessunaParolaVietata } from './helpers/paroleVietate';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh, push: vi.fn() }) }));
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }));
vi.mock('@/lib/data/fondiCasa', () => ({ creaFondiIngresso: vi.fn() }));
import { creaFondiIngresso } from '@/lib/data/fondiCasa';

beforeEach(() => {
  refresh.mockReset();
  vi.mocked(creaFondiIngresso).mockReset();
  vi.mocked(creaFondiIngresso).mockResolvedValue([]);
});

const scrivi = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const monta = (canone = 750, esistenti: string[] = []) =>
  render(<CostiIngresso householdId="h1" oggi="2026-11-09" canonePiano={canone} esistenti={esistenti} />);

describe('CostiIngresso', () => {
  it('avviso in testa, canone dal piano, deposito 1.500 con nota indicativa', () => {
    const { container } = monta();
    expect(screen.getByText(AVVISO_COSTI)).toBeInTheDocument();
    expect(screen.getByLabelText('Canone al mese (€)')).toHaveValue('750');
    expect(screen.getByText('1.500 €')).toBeInTheDocument();
    expect(screen.getByText('Importo indicativo, controllate il contratto.')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Come si calcola?' }).length).toBeGreaterThan(1);
    assertNessunaParolaVietata(container);
  });

  it('canone modificabile', () => {
    monta();
    scrivi('Canone al mese (€)', '800');
    expect(screen.getByText('1.600 €')).toBeInTheDocument();
  });

  it('un solo totale con i valori di partenza; cedolare secca lo porta a 1.800', () => {
    monta();
    expect(screen.getByText('Totale: 1.922 €')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Modifica' }));
    fireEvent.click(screen.getByLabelText('Cedolare secca'));
    expect(screen.getByText('Totale: 1.800 €')).toBeInTheDocument();
    expect(screen.queryByText('Imposta di registro')).not.toBeInTheDocument();
  });

  it('data passata: messaggio e pulsante disabilitato; data valida: anteprima del deposito', () => {
    monta();
    const b = screen.getByRole('button', { name: 'Metti da parte tutto' });
    expect(b).toBeDisabled();
    scrivi('Data di ingresso', '2026-11-01');
    expect(screen.getByText('La data di ingresso è già passata.')).toBeInTheDocument();
    expect(b).toBeDisabled();
    scrivi('Data di ingresso', '2027-03-09');
    expect(screen.getByText('Mettete da parte 1.500 € in 4 mesi: 375 € al mese')).toBeInTheDocument();
    expect(b).toBeEnabled();
  });

  it('Metti da parte tutto: una chiamata anche con doppio click, la data è la scadenza', async () => {
    monta();
    scrivi('Data di ingresso', '2027-03-09');
    const b = screen.getByRole('button', { name: 'Metti da parte tutto' });
    fireEvent.click(b);
    fireEvent.click(b);
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(creaFondiIngresso).toHaveBeenCalledTimes(1);
    const arg = vi.mocked(creaFondiIngresso).mock.calls[0][1];
    expect(arg).toMatchObject({ householdId: 'h1', scadenza: '2027-03-09', oggi: '2026-11-09' });
    expect(arg.voci.map((v) => v.nome)).toEqual([
      'Deposito cauzionale', 'Imposta di registro', 'Imposta di bollo', 'Allacci delle utenze',
    ]);
  });

  it('errore a metà: messaggio neutro; al secondo tentativo i nomi creati sono in esistenti', async () => {
    vi.mocked(creaFondiIngresso).mockImplementationOnce(async (_s, input) => {
      input.onCreato?.('Deposito cauzionale');
      throw new Error('no');
    });
    const { container } = monta(750, ['Altro']);
    scrivi('Data di ingresso', '2027-03-09');
    fireEvent.click(screen.getByRole('button', { name: 'Metti da parte tutto' }));
    expect(await screen.findByText('Salvataggio fallito, controlla la connessione e riprova.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Metti da parte tutto' }));
    await waitFor(() => expect(creaFondiIngresso).toHaveBeenCalledTimes(2));
    expect(vi.mocked(creaFondiIngresso).mock.calls[1][1].esistenti).toEqual(['Altro', 'Deposito cauzionale']);
    assertNessunaParolaVietata(container);
  });

  it('arredo scritto a mano: 2000,5 vale 2000,5; abc, negativo disabilitano; vuoto vale 0', () => {
    monta();
    scrivi('Data di ingresso', '2027-03-09');
    fireEvent.click(screen.getByRole('button', { name: 'Modifica' }));
    const b = screen.getByRole('button', { name: 'Metti da parte tutto' });
    scrivi('Arredo (€)', '2000,5');
    expect(screen.getByText('2.000,5 €')).toBeInTheDocument();
    expect(b).toBeEnabled();
    scrivi('Arredo (€)', 'abc');
    expect(b).toBeDisabled();
    scrivi('Arredo (€)', '-3');
    expect(b).toBeDisabled();
    scrivi('Arredo (€)', '');
    expect(b).toBeEnabled();
  });
});
