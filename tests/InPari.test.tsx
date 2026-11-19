import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { assertNessunaParolaVietata } from './helpers/paroleVietate';

const refresh = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh, push: vi.fn() }) }));
const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ rpc }) }));
vi.mock('@/lib/data/notifiche', () => ({ segnaNessunaSpesa: vi.fn() }));

import { InPari } from '@/app/in-pari/InPari';
import { segnaNessunaSpesa } from '@/lib/data/notifiche';
import type { Andamento } from '@/lib/calculations/supporto/andamento';
import type { Consiglio } from '@/lib/calculations/supporto/consiglio';

const andamento: Andamento = { spesoFinora: 100, solito: 120, mesiConfronto: 3, curva: [], perCategoria: [] };
const consiglio: Consiglio = { tipo: 'in_linea', testo: 'Un consiglio di prova', perche: 'Perché sì', lezione: 'dove-vanno' };
const conti = [
  { id: 'k', nome: 'Contanti' },
  { id: 'c', nome: 'Carta' },
];

function mostra(extra: Partial<Parameters<typeof InPari>[0]> = {}) {
  return render(
    <InPari
      periodo={{ dal: '2026-11-08', al: '2026-11-11' }}
      conti={conti}
      casa={null}
      andamento={andamento}
      consiglio={consiglio}
      oggi="2026-11-11"
      {...extra}
    />
  );
}

// I parametri della n-esima chiamata a crea_movimento.
const par = (n: number) => rpc.mock.calls[n][1] as Record<string, unknown>;

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  rpc.mockResolvedValue({ data: 't', error: null });
  vi.mocked(segnaNessunaSpesa).mockResolvedValue(undefined);
});

describe('InPari', () => {
  it('senza periodo dice che sei in pari e torna alla Home, senza moduli', () => {
    mostra({ periodo: null });
    expect(screen.getByRole('heading', { name: 'Sei in pari.' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Torna alla Home' }).getAttribute('href')).toBe('/');
    expect(screen.queryByRole('button', { name: 'Fatto' })).toBeNull();
  });

  it('mostra il periodo da recuperare', () => {
    mostra();
    expect(screen.getByText(/Dal 8 novembre al 11 novembre non hai segnato niente/)).toBeTruthy();
    assertNessunaParolaVietata(document.body);
  });

  it('Fatto con carta 80 e contanti 20: 2 spese stimate, una rpc ciascuna sui conti scelti', async () => {
    mostra();
    fireEvent.change(screen.getByLabelText('Con la carta'), { target: { value: '80' } });
    fireEvent.click(screen.getByRole('button', { name: '20 €' }));
    fireEvent.click(screen.getByRole('button', { name: 'Fatto' }));
    await screen.findByText('Fatto: sei in pari.');

    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc.mock.calls.every((c) => c[0] === 'crea_movimento')).toBe(true);
    expect(par(0)).toMatchObject({
      p_tipo: 'expense', p_importo: 80, p_account: 'c', p_categoria: null, p_descrizione: '', p_stima: true,
    });
    expect(par(1)).toMatchObject({ p_importo: 20, p_account: 'k', p_stima: true });
    expect(refresh).toHaveBeenCalled();
    expect(screen.getByText('Un consiglio di prova')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Torna alla Home' })).toBeTruthy();
  });

  it('un solo conto non contanti: 2 chiamate, nessun saldo a parte', async () => {
    mostra({ conti: [{ id: 'c', nome: 'Carta' }] });
    fireEvent.change(screen.getByLabelText('Con la carta'), { target: { value: '80' } });
    fireEvent.click(screen.getByRole('button', { name: '20 €' }));
    fireEvent.click(screen.getByRole('button', { name: 'Fatto' }));
    await screen.findByText('Fatto: sei in pari.');
    expect(rpc).toHaveBeenCalledTimes(2);
  });

  it('Fatto è spento senza importi', () => {
    mostra();
    expect((screen.getByRole('button', { name: 'Fatto' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('"Non ho speso niente" segna fino a oggi', async () => {
    mostra();
    fireEvent.click(screen.getByRole('button', { name: 'Non ho speso niente' }));
    await waitFor(() => expect(segnaNessunaSpesa).toHaveBeenCalledWith(expect.anything(), '2026-11-11'));
    await screen.findByText('Fatto: sei in pari.');
    expect(rpc).not.toHaveBeenCalled();
  });

  it('in Casa la spesa è anticipata da te con il conto personale', async () => {
    window.localStorage.setItem('aggiungiModo', 'casa');
    mostra({ casa: { householdId: 'h1', meUserId: 'u1' } });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Di casa' }).getAttribute('aria-pressed')).toBe('true'));
    fireEvent.change(screen.getByLabelText('Con la carta'), { target: { value: '30' } });
    fireEvent.click(screen.getByRole('button', { name: 'Fatto' }));
    await screen.findByText('Fatto: sei in pari.');
    expect(par(0)).toMatchObject({ p_importo: 30, p_account: 'c', p_pagata_da: 'u1', p_stima: true, p_household: 'h1' });
  });

  it('senza casa non c è il selettore dello spazio', () => {
    mostra();
    expect(screen.queryByRole('button', { name: 'Di casa' })).toBeNull();
  });

  it('se la rpc fallisce, riprovare non crea doppioni', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: new Error('rete') });
    mostra();
    fireEvent.change(screen.getByLabelText('Con la carta'), { target: { value: '80' } });
    fireEvent.click(screen.getByRole('button', { name: 'Fatto' }));
    await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: 'Fatto' }));
    await screen.findByText('Fatto: sei in pari.');
    expect(rpc).toHaveBeenCalledTimes(2);
  });

  it('se la seconda riga fallisce, la prima non si rifà', async () => {
    rpc
      .mockResolvedValueOnce({ data: 't1', error: null })
      .mockResolvedValueOnce({ data: null, error: new Error('rete') });
    mostra();
    fireEvent.change(screen.getByLabelText('Con la carta'), { target: { value: '80' } });
    fireEvent.click(screen.getByRole('button', { name: '50 €' }));
    fireEvent.click(screen.getByRole('button', { name: 'Fatto' }));
    expect((await screen.findByRole('alert')).textContent).toBe("Una spesa è registrata, l'altra no: riprova.");
    fireEvent.click(screen.getByRole('button', { name: 'Riprova' }));
    await screen.findByText('Fatto: sei in pari.');
    expect(rpc).toHaveBeenCalledTimes(3);
    expect(par(2)).toMatchObject({ p_importo: 50 });
    expect(rpc.mock.calls.filter((c) => (c[1] as { p_account: string }).p_account === 'c')).toHaveLength(1);
  });

  it('Altro apre un campo per i contanti', async () => {
    mostra();
    fireEvent.click(screen.getByRole('button', { name: 'Altro' }));
    fireEvent.change(screen.getByLabelText('Contanti, altro importo'), { target: { value: '35' } });
    fireEvent.click(screen.getByRole('button', { name: 'Fatto' }));
    await screen.findByText('Fatto: sei in pari.');
    expect(par(0)).toMatchObject({ p_importo: 35, p_account: 'k' });
  });

  it('in Casa i contanti senza conto contanti sono anticipati da te, senza toccare nessun saldo', async () => {
    window.localStorage.setItem('aggiungiModo', 'casa');
    mostra({ casa: { householdId: 'h1', meUserId: 'u1' }, conti: [{ id: 'c', nome: 'Carta' }] });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Di casa' }).getAttribute('aria-pressed')).toBe('true'));
    fireEvent.click(screen.getByRole('button', { name: '20 €' }));
    fireEvent.click(screen.getByRole('button', { name: 'Fatto' }));
    await screen.findByText('Fatto: sei in pari.');
    expect(par(0)).toMatchObject({ p_importo: 20, p_account: null, p_pagata_da: 'u1' });
  });

  it('in Casa la riga con la carta resta sul conto carta, anticipata da te', async () => {
    window.localStorage.setItem('aggiungiModo', 'casa');
    mostra({ casa: { householdId: 'h1', meUserId: 'u1' }, conti: [{ id: 'c', nome: 'Carta' }] });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Di casa' }).getAttribute('aria-pressed')).toBe('true'));
    fireEvent.change(screen.getByLabelText('Con la carta'), { target: { value: '40' } });
    fireEvent.click(screen.getByRole('button', { name: 'Fatto' }));
    await screen.findByText('Fatto: sei in pari.');
    expect(par(0)).toMatchObject({ p_importo: 40, p_account: 'c', p_pagata_da: 'u1' });
  });

  it('se la prima creazione fallisce, le modifiche successive valgono', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: new Error('rete') });
    mostra();
    fireEvent.change(screen.getByLabelText('Con la carta'), { target: { value: '80' } });
    fireEvent.click(screen.getByRole('button', { name: 'Fatto' }));
    const avviso = await screen.findByRole('alert');
    expect(avviso.textContent).toBe('Non sono riuscito a salvare: riprova.');
    fireEvent.change(screen.getByLabelText('Con la carta'), { target: { value: '55' } });
    fireEvent.click(screen.getByRole('button', { name: 'Fatto' }));
    await screen.findByText('Fatto: sei in pari.');
    expect(par(1)).toMatchObject({ p_importo: 55 });
  });
});
