import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { assertNessunaParolaVietata } from './helpers/paroleVietate';

const refresh = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh, push: vi.fn() }) }));
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }));
vi.mock('@/lib/data/transactions', () => ({ createTransaction: vi.fn() }));
vi.mock('@/lib/data/accounts', () => ({ adjustAccountBalance: vi.fn() }));
vi.mock('@/lib/data/notifiche', () => ({ segnaNessunaSpesa: vi.fn() }));

import { InPari } from '@/app/in-pari/InPari';
import { createTransaction } from '@/lib/data/transactions';
import { adjustAccountBalance } from '@/lib/data/accounts';
import { segnaNessunaSpesa } from '@/lib/data/notifiche';
import type { Andamento } from '@/lib/calculations/supporto/andamento';
import type { Consiglio } from '@/lib/calculations/supporto/consiglio';

const andamento: Andamento = { spesoFinora: 100, solito: 120, mesiConfronto: 3, curva: [], perCategoria: [] };
const consiglio: Consiglio = { tipo: 'in_linea', testo: 'Un consiglio di prova', perche: 'Perché sì' };
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

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  vi.mocked(createTransaction).mockResolvedValue({ id: 't' } as never);
  vi.mocked(adjustAccountBalance).mockResolvedValue(undefined);
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

  it('Fatto con carta 80 e contanti 20: 2 spese stimate, 2 saldi aggiornati sui conti scelti', async () => {
    mostra();
    fireEvent.change(screen.getByLabelText('Con la carta'), { target: { value: '80' } });
    fireEvent.click(screen.getByRole('button', { name: '20 €' }));
    fireEvent.click(screen.getByRole('button', { name: 'Fatto' }));
    await screen.findByText('Fatto: sei in pari.');

    const chiamate = vi.mocked(createTransaction).mock.calls.map((c) => c[1]);
    expect(chiamate).toHaveLength(2);
    expect(chiamate[0]).toMatchObject({
      tipo: 'expense', importo: 80, accountId: 'c', categoriaId: null, descrizione: '', stima: true,
    });
    expect(chiamate[1]).toMatchObject({ importo: 20, accountId: 'k', stima: true });
    expect(adjustAccountBalance).toHaveBeenCalledWith(expect.anything(), 'c', -80);
    expect(adjustAccountBalance).toHaveBeenCalledWith(expect.anything(), 'k', -20);
    expect(refresh).toHaveBeenCalled();
    expect(screen.getByText('Un consiglio di prova')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Torna alla Home' })).toBeTruthy();
  });

  it('un solo conto non contanti: aggiorna 1 conto', async () => {
    mostra({ conti: [{ id: 'c', nome: 'Carta' }] });
    fireEvent.change(screen.getByLabelText('Con la carta'), { target: { value: '80' } });
    fireEvent.click(screen.getByRole('button', { name: '20 €' }));
    fireEvent.click(screen.getByRole('button', { name: 'Fatto' }));
    await screen.findByText('Fatto: sei in pari.');
    expect(createTransaction).toHaveBeenCalledTimes(2);
    expect(adjustAccountBalance).toHaveBeenCalledTimes(1);
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
    expect(createTransaction).not.toHaveBeenCalled();
  });

  it('in Casa la spesa è anticipata da te con il conto personale', async () => {
    window.localStorage.setItem('aggiungiModo', 'casa');
    mostra({ casa: { householdId: 'h1', meUserId: 'u1' } });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Di casa' }).getAttribute('aria-pressed')).toBe('true'));
    fireEvent.change(screen.getByLabelText('Con la carta'), { target: { value: '30' } });
    fireEvent.click(screen.getByRole('button', { name: 'Fatto' }));
    await screen.findByText('Fatto: sei in pari.');
    const [, input, scope] = vi.mocked(createTransaction).mock.calls[0];
    expect(input).toMatchObject({ importo: 30, accountId: 'c', pagataDaUserId: 'u1', stima: true });
    expect(scope).toBeDefined();
  });

  it('senza casa non c è il selettore dello spazio', () => {
    mostra();
    expect(screen.queryByRole('button', { name: 'Di casa' })).toBeNull();
  });

  it('se il saldo fallisce, riprovare non crea doppioni', async () => {
    vi.mocked(adjustAccountBalance).mockRejectedValueOnce(new Error('rete'));
    mostra();
    fireEvent.change(screen.getByLabelText('Con la carta'), { target: { value: '80' } });
    fireEvent.click(screen.getByRole('button', { name: 'Fatto' }));
    await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: 'Riprova' }));
    await screen.findByText('Fatto: sei in pari.');
    expect(createTransaction).toHaveBeenCalledTimes(1);
    expect(adjustAccountBalance).toHaveBeenCalledTimes(2);
  });

  it('se la seconda riga fallisce nella creazione, la prima non si rifà', async () => {
    vi.mocked(createTransaction)
      .mockResolvedValueOnce({ id: 't1' } as never)
      .mockRejectedValueOnce(new Error('rete'));
    mostra();
    fireEvent.change(screen.getByLabelText('Con la carta'), { target: { value: '80' } });
    fireEvent.click(screen.getByRole('button', { name: '50 €' }));
    fireEvent.click(screen.getByRole('button', { name: 'Fatto' }));
    await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: 'Riprova' }));
    await screen.findByText('Fatto: sei in pari.');
    expect(createTransaction).toHaveBeenCalledTimes(3);
    expect(adjustAccountBalance).toHaveBeenCalledTimes(2);
    expect(vi.mocked(adjustAccountBalance).mock.calls.filter((c) => c[1] === 'c')).toHaveLength(1);
  });

  it('Altro apre un campo per i contanti', async () => {
    mostra();
    fireEvent.click(screen.getByRole('button', { name: 'Altro' }));
    fireEvent.change(screen.getByLabelText('Contanti, altro importo'), { target: { value: '35' } });
    fireEvent.click(screen.getByRole('button', { name: 'Fatto' }));
    await screen.findByText('Fatto: sei in pari.');
    expect(vi.mocked(createTransaction).mock.calls[0][1]).toMatchObject({ importo: 35, accountId: 'k' });
  });
});
