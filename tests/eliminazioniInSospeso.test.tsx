import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

const nav = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: nav.refresh, push: vi.fn() }),
  usePathname: () => '/a',
}));
const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ rpc }) }));

import { AnnullaProvider, useEliminaConAnnulla } from '@/app/AnnullaProvider';
import { riprendiEliminazioniInSospeso, salvaInSospeso } from '@/lib/eliminazioniInSospeso';

const ID = '11111111-1111-4111-8111-111111111111';
const ID2 = '22222222-2222-4222-8222-222222222222';
const CHIAVE = (id: string) => `eliminazione-in-sospeso:${id}`;

function Prova({ esegui, riprendibile = true }: { esegui: () => Promise<void>; riprendibile?: boolean }) {
  const elimina = useEliminaConAnnulla();
  return (
    <button
      onClick={() =>
        elimina({ id: ID, testo: 'Spesa eliminata.', esegui, riprendibile, nascondi: vi.fn(), ripristina: vi.fn() })
      }
    >
      elimina
    </button>
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  window.localStorage.clear();
  rpc.mockReset();
  rpc.mockResolvedValue({ data: null, error: null });
  nav.refresh.mockClear();
});
afterEach(() => vi.useRealTimers());

describe('eliminazione in sospeso: scrittura e pulizia della chiave', () => {
  it('la chiave si scrive prima del timer e si toglie a scrittura riuscita', async () => {
    const esegui = vi.fn(async () => {});
    render(
      <AnnullaProvider>
        <Prova esegui={esegui} />
      </AnnullaProvider>
    );
    fireEvent.click(screen.getByText('elimina'));
    expect(window.localStorage.getItem(CHIAVE(ID))).not.toBeNull();
    expect(esegui).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(esegui).toHaveBeenCalledTimes(1);
    expect(window.localStorage.getItem(CHIAVE(ID))).toBeNull();
  });

  it('Annulla toglie la chiave e non scrive mai', async () => {
    const esegui = vi.fn(async () => {});
    render(
      <AnnullaProvider>
        <Prova esegui={esegui} />
      </AnnullaProvider>
    );
    fireEvent.click(screen.getByText('elimina'));
    expect(window.localStorage.getItem(CHIAVE(ID))).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Annulla' }));
    expect(window.localStorage.getItem(CHIAVE(ID))).toBeNull();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });
    expect(esegui).not.toHaveBeenCalled();
  });

  it('se la scrittura fallisce la riga torna e la chiave si toglie (niente eliminazione a sorpresa dopo)', async () => {
    render(
      <AnnullaProvider>
        <Prova
          esegui={async () => {
            throw new Error('rete');
          }}
        />
      </AnnullaProvider>
    );
    fireEvent.click(screen.getByText('elimina'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(window.localStorage.getItem(CHIAVE(ID))).toBeNull();
  });

  it('una eliminazione non riprendibile (es. un obiettivo) non scrive nessuna chiave', () => {
    render(
      <AnnullaProvider>
        <Prova esegui={async () => {}} riprendibile={false} />
      </AnnullaProvider>
    );
    fireEvent.click(screen.getByText('elimina'));
    expect(window.localStorage.length).toBe(0);
  });

  it('senza localStorage (eccezione) l eliminazione funziona lo stesso', async () => {
    const spia = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    const esegui = vi.fn(async () => {});
    render(
      <AnnullaProvider>
        <Prova esegui={esegui} />
      </AnnullaProvider>
    );
    fireEvent.click(screen.getByText('elimina'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(esegui).toHaveBeenCalledTimes(1);
    spia.mockRestore();
  });
});

describe('eliminazione in sospeso: ripresa all avvio', () => {
  it('all avvio le chiavi rimaste si ripetono con elimina_movimento e si tolgono', async () => {
    salvaInSospeso(ID);
    salvaInSospeso(ID2);
    await act(async () => {
      render(
        <AnnullaProvider>
          <div />
        </AnnullaProvider>
      );
    });
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc).toHaveBeenCalledWith('elimina_movimento', { p_id: ID });
    expect(rpc).toHaveBeenCalledWith('elimina_movimento', { p_id: ID2 });
    expect(window.localStorage.getItem(CHIAVE(ID))).toBeNull();
    expect(window.localStorage.getItem(CHIAVE(ID2))).toBeNull();
    expect(nav.refresh).toHaveBeenCalled();
  });

  it('senza chiavi non chiama niente', async () => {
    await act(async () => {
      render(
        <AnnullaProvider>
          <div />
        </AnnullaProvider>
      );
    });
    expect(rpc).not.toHaveBeenCalled();
    expect(nav.refresh).not.toHaveBeenCalled();
  });

  it('errore di rete: la chiave resta per la volta dopo', async () => {
    salvaInSospeso(ID);
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'Failed to fetch' } });
    const fatte = await riprendiEliminazioniInSospeso(() => ({ rpc }) as never);
    expect(fatte).toBe(0);
    expect(window.localStorage.getItem(CHIAVE(ID))).not.toBeNull();
  });

  it('movimento non modificabile da chi è qui: la chiave si toglie, non si riprova mai', async () => {
    salvaInSospeso(ID);
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'movimento non modificabile' } });
    await riprendiEliminazioniInSospeso(() => ({ rpc }) as never);
    expect(window.localStorage.getItem(CHIAVE(ID))).toBeNull();
  });

  it('una chiave che non è un id valido si toglie senza chiamare la rpc', async () => {
    salvaInSospeso('non-un-uuid');
    await riprendiEliminazioniInSospeso(() => ({ rpc }) as never);
    expect(rpc).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(CHIAVE('non-un-uuid'))).toBeNull();
  });

  it('una ripetizione dopo una già riuscita non fa danni (idempotente: la rpc su una riga assente è un no-op)', async () => {
    salvaInSospeso(ID);
    await riprendiEliminazioniInSospeso(() => ({ rpc }) as never);
    await riprendiEliminazioniInSospeso(() => ({ rpc }) as never);
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it('localStorage che lancia: nessuna eccezione', async () => {
    const spia = vi.spyOn(Storage.prototype, 'key').mockImplementation(() => {
      throw new Error('negato');
    });
    await expect(riprendiEliminazioniInSospeso(() => ({ rpc }) as never)).resolves.toBe(0);
    spia.mockRestore();
  });
});
