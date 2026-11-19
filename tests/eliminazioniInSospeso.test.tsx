import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

const nav = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: nav.refresh, push: vi.fn() }),
  usePathname: () => '/a',
}));
const rpc = vi.hoisted(() => vi.fn());
// Sessione controllabile: il token ha come sub l'utente corrente; onAuthStateChange permette di simulare un accesso.
const sessione = vi.hoisted(() => ({
  utente: 'u1' as string | null,
  callback: null as null | ((e: string, s: { user: { id: string } } | null) => void),
}));
const client = vi.hoisted(() => ({
  rpc: (...a: unknown[]) => (rpc as (...x: unknown[]) => unknown)(...a),
  auth: {
    getSession: async () => ({
      data: {
        session: sessione.utente ? { access_token: `x.${btoa(JSON.stringify({ sub: sessione.utente }))}.y` } : null,
      },
    }),
    onAuthStateChange: (cb: (e: string, s: { user: { id: string } } | null) => void) => {
      sessione.callback = cb;
      return { data: { subscription: { unsubscribe: () => {} } } };
    },
  },
}));
vi.mock('@/lib/supabase/client', () => ({ createClient: () => client }));

import { AnnullaProvider, useEliminaConAnnulla } from '@/app/AnnullaProvider';
import { riprendiEliminazioniInSospeso, salvaInSospeso } from '@/lib/eliminazioniInSospeso';

const ID = '11111111-1111-4111-8111-111111111111';
const ID2 = '22222222-2222-4222-8222-222222222222';
const CHIAVE = (id: string, u = 'u1') => `eliminazione-in-sospeso:${u}:${id}`;
const vecchia = () => Date.now() - 10_000; // oltre la finestra di Annulla di un'altra scheda
const client2 = () => ({ rpc }) as never;

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

async function monta(el: React.ReactElement) {
  const r = render(el);
  await act(async () => {}); // la sessione si legge
  return r;
}

beforeEach(() => {
  vi.useFakeTimers();
  window.localStorage.clear();
  rpc.mockReset();
  rpc.mockResolvedValue({ data: null, error: null });
  sessione.utente = 'u1';
  sessione.callback = null;
  nav.refresh.mockClear();
});
afterEach(() => vi.useRealTimers());

describe('eliminazione in sospeso: scrittura e pulizia della chiave', () => {
  it('la chiave (con l utente) si scrive prima del timer e si toglie a scrittura riuscita', async () => {
    const esegui = vi.fn(async () => {});
    await monta(
      <AnnullaProvider>
        <Prova esegui={esegui} />
      </AnnullaProvider>
    );
    fireEvent.click(screen.getByText('elimina'));
    const voce = JSON.parse(window.localStorage.getItem(CHIAVE(ID)) as string);
    expect(voce).toMatchObject({ id: ID, utenteId: 'u1' });
    expect(typeof voce.salvataIl).toBe('number');
    expect(esegui).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(esegui).toHaveBeenCalledTimes(1);
    expect(window.localStorage.getItem(CHIAVE(ID))).toBeNull();
  });

  it('Annulla toglie la chiave e non scrive mai', async () => {
    const esegui = vi.fn(async () => {});
    await monta(
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
    await monta(
      <AnnullaProvider>
        <Prova
          esegui={async () => {
            throw new Error('rete');
          }}
        />
      </AnnullaProvider>
    );
    fireEvent.click(screen.getByText('elimina'));
    expect(window.localStorage.getItem(CHIAVE(ID))).not.toBeNull();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(window.localStorage.getItem(CHIAVE(ID))).toBeNull();
  });

  it('una eliminazione non riprendibile (es. un obiettivo) non scrive nessuna chiave', async () => {
    await monta(
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
    await monta(
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
  it('all avvio le chiavi dell utente rimaste si ripetono con elimina_movimento e si tolgono', async () => {
    salvaInSospeso(ID, 'u1', vecchia());
    salvaInSospeso(ID2, 'u1', vecchia());
    await monta(
      <AnnullaProvider>
        <div />
      </AnnullaProvider>
    );
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc).toHaveBeenCalledWith('elimina_movimento', { p_id: ID });
    expect(rpc).toHaveBeenCalledWith('elimina_movimento', { p_id: ID2 });
    expect(window.localStorage.getItem(CHIAVE(ID))).toBeNull();
    expect(window.localStorage.getItem(CHIAVE(ID2))).toBeNull();
    expect(nav.refresh).toHaveBeenCalled();
  });

  it('senza chiavi non chiama niente', async () => {
    await monta(
      <AnnullaProvider>
        <div />
      </AnnullaProvider>
    );
    expect(rpc).not.toHaveBeenCalled();
    expect(nav.refresh).not.toHaveBeenCalled();
  });

  it('un altro utente sullo stesso telefono: le chiavi di u1 restano intatte e non si chiama niente', async () => {
    salvaInSospeso(ID, 'u1', vecchia());
    sessione.utente = 'u2';
    await monta(
      <AnnullaProvider>
        <div />
      </AnnullaProvider>
    );
    expect(rpc).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(CHIAVE(ID, 'u1'))).not.toBeNull();
  });

  it('senza sessione la chiave resta; dopo l accesso la ripresa parte', async () => {
    salvaInSospeso(ID, 'u1', vecchia());
    sessione.utente = null;
    await monta(
      <AnnullaProvider>
        <div />
      </AnnullaProvider>
    );
    expect(rpc).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(CHIAVE(ID))).not.toBeNull();
    await act(async () => {
      sessione.callback?.('SIGNED_IN', { user: { id: 'u1' } });
    });
    expect(rpc).toHaveBeenCalledWith('elimina_movimento', { p_id: ID });
    expect(window.localStorage.getItem(CHIAVE(ID))).toBeNull();
  });

  it('una chiave giovane (finestra di Annulla di un altra scheda) si salta', async () => {
    salvaInSospeso(ID, 'u1', Date.now() - 2000);
    const fatte = await riprendiEliminazioniInSospeso(client2, 'u1');
    expect(fatte).toBe(0);
    expect(rpc).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(CHIAVE(ID))).not.toBeNull();
  });

  it('una chiave più vecchia di 7 giorni scade: si toglie senza chiamare la rpc', async () => {
    salvaInSospeso(ID, 'u1', Date.now() - 8 * 24 * 3600 * 1000);
    await riprendiEliminazioniInSospeso(client2, 'u1');
    expect(rpc).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(CHIAVE(ID))).toBeNull();
  });

  it('errore di rete: la chiave resta per la volta dopo', async () => {
    salvaInSospeso(ID, 'u1', vecchia());
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'Failed to fetch' } });
    const fatte = await riprendiEliminazioniInSospeso(client2, 'u1');
    expect(fatte).toBe(0);
    expect(window.localStorage.getItem(CHIAVE(ID))).not.toBeNull();
  });

  it('movimento non modificabile da chi è qui: la chiave si toglie, non si riprova mai', async () => {
    salvaInSospeso(ID, 'u1', vecchia());
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'movimento non modificabile' } });
    await riprendiEliminazioniInSospeso(client2, 'u1');
    expect(window.localStorage.getItem(CHIAVE(ID))).toBeNull();
  });

  it('una chiave che non è un id valido si toglie senza chiamare la rpc', async () => {
    salvaInSospeso('non-un-uuid', 'u1', vecchia());
    await riprendiEliminazioniInSospeso(client2, 'u1');
    expect(rpc).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(CHIAVE('non-un-uuid'))).toBeNull();
  });

  it('a scrittura riuscita la chiave sparisce: una seconda ripresa non richiama la rpc', async () => {
    salvaInSospeso(ID, 'u1', vecchia());
    await riprendiEliminazioniInSospeso(client2, 'u1');
    await riprendiEliminazioniInSospeso(client2, 'u1');
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it('localStorage che lancia: nessuna eccezione', async () => {
    const spia = vi.spyOn(Storage.prototype, 'key').mockImplementation(() => {
      throw new Error('negato');
    });
    await expect(riprendiEliminazioniInSospeso(client2, 'u1')).resolves.toBe(0);
    spia.mockRestore();
  });
});
