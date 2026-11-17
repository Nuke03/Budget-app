import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

const nav = vi.hoisted(() => ({ percorso: '/a', refresh: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: nav.refresh, push: vi.fn() }),
  usePathname: () => nav.percorso,
}));
import { AnnullaProvider, useEliminaConAnnulla } from '@/app/AnnullaProvider';

function Prova({ esegui, nascondi = vi.fn(), ripristina = vi.fn() }: { esegui: () => Promise<void>; nascondi?: () => void; ripristina?: () => void }) {
  const elimina = useEliminaConAnnulla();
  return <button onClick={() => elimina({ id: 'a', testo: 'Spesa eliminata.', esegui, nascondi, ripristina })}>elimina</button>;
}
const albero = (esegui: () => Promise<void>) => (
  <AnnullaProvider>
    <Prova esegui={esegui} />
  </AnnullaProvider>
);

describe('AnnullaProvider: pagina e aggiornamento', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    nav.percorso = '/a';
    nav.refresh.mockClear();
  });
  afterEach(() => vi.useRealTimers());

  it('cambio pagina con una eliminazione in attesa: esegue una volta e nasconde l avviso', async () => {
    const esegui = vi.fn(async () => {});
    const { rerender } = render(albero(esegui));
    fireEvent.click(screen.getByText('elimina'));
    expect(screen.getByRole('status')).toHaveTextContent('Spesa eliminata.');
    nav.percorso = '/b';
    await act(async () => {
      rerender(albero(esegui));
    });
    expect(esegui).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });
    expect(esegui).toHaveBeenCalledTimes(1);
  });

  it('dopo la scrittura riuscita aggiorna le pagine del server', async () => {
    render(albero(vi.fn(async () => {})));
    fireEvent.click(screen.getByText('elimina'));
    expect(nav.refresh).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(nav.refresh).toHaveBeenCalledTimes(1);
  });

  it('se la scrittura fallisce non aggiorna e ripristina', async () => {
    const ripristina = vi.fn();
    render(
      <AnnullaProvider>
        <Prova esegui={async () => { throw new Error('rete'); }} ripristina={ripristina} />
      </AnnullaProvider>,
    );
    fireEvent.click(screen.getByText('elimina'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(nav.refresh).not.toHaveBeenCalled();
    expect(ripristina).toHaveBeenCalledTimes(1);
  });

  it('il fuoco passa ad Annulla dopo l eliminazione', () => {
    render(albero(vi.fn(async () => {})));
    fireEvent.click(screen.getByText('elimina'));
    expect(screen.getByRole('button', { name: 'Annulla' })).toHaveFocus();
  });

  it('mouse sull avviso: il timer si ferma; via il mouse riparte', async () => {
    const esegui = vi.fn(async () => {});
    render(albero(esegui));
    fireEvent.click(screen.getByText('elimina'));
    const avviso = screen.getByText('Spesa eliminata.').parentElement!;
    fireEvent.mouseEnter(avviso);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20000);
    });
    expect(esegui).not.toHaveBeenCalled();
    fireEvent.mouseLeave(avviso);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(esegui).toHaveBeenCalledTimes(1);
  });

  it('fuoco sull avviso: il timer si ferma; via il fuoco riparte', async () => {
    const esegui = vi.fn(async () => {});
    render(albero(esegui));
    fireEvent.click(screen.getByText('elimina'));
    const chiudi = screen.getByRole('button', { name: "Chiudi l'avviso" });
    act(() => chiudi.focus());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20000);
    });
    expect(esegui).not.toHaveBeenCalled();
    act(() => chiudi.blur());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(esegui).toHaveBeenCalledTimes(1);
  });
});
