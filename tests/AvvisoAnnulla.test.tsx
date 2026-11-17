import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { AnnullaProvider, useEliminaConAnnulla } from '@/app/AnnullaProvider';

function Prova({ id = 'a', esegui, nascondi, ripristina }: { id?: string; esegui: () => Promise<void>; nascondi: () => void; ripristina: () => void }) {
  const elimina = useEliminaConAnnulla();
  return (
    <button onClick={() => elimina({ id, testo: `Spesa ${id} eliminata.`, esegui, nascondi, ripristina })}>elimina {id}</button>
  );
}

function monta(over: Partial<{ esegui: () => Promise<void> }> = {}) {
  const esegui = over.esegui ?? vi.fn(async () => {});
  const nascondi = vi.fn();
  const ripristina = vi.fn();
  const utente = render(
    <AnnullaProvider>
      <Prova esegui={esegui} nascondi={nascondi} ripristina={ripristina} />
    </AnnullaProvider>,
  );
  return { esegui, nascondi, ripristina, ...utente };
}

describe('AvvisoAnnulla', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('mostra testo e Annulla in una regione polite, nasconde la riga', () => {
    const { nascondi } = monta();
    fireEvent.click(screen.getByText('elimina a'));
    expect(nascondi).toHaveBeenCalledTimes(1);
    const regione = screen.getByRole('status');
    expect(regione).toHaveAttribute('aria-live', 'polite');
    expect(regione).toHaveTextContent('Spesa a eliminata.');
    expect(screen.getByRole('button', { name: 'Annulla' })).toBeInTheDocument();
  });

  it('il clic su Annulla ripristina e non scrive mai', async () => {
    const { esegui, ripristina } = monta();
    fireEvent.click(screen.getByText('elimina a'));
    fireEvent.click(screen.getByRole('button', { name: 'Annulla' }));
    expect(ripristina).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });
    expect(esegui).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Annulla' })).toBeNull();
  });

  it('dopo 5 secondi esegue una volta e l avviso sparisce', async () => {
    const { esegui, ripristina } = monta();
    fireEvent.click(screen.getByText('elimina a'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(esegui).toHaveBeenCalledTimes(1);
    expect(ripristina).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Annulla' })).toBeNull();
  });

  it('un errore ripristina la riga e lo dice', async () => {
    const { ripristina } = monta({ esegui: vi.fn(async () => { throw new Error('no'); }) });
    fireEvent.click(screen.getByText('elimina a'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(ripristina).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('status')).toHaveTextContent('Non sono riuscito a eliminarla: riprova.');
    expect(screen.queryByRole('button', { name: 'Annulla' })).toBeNull();
  });

  it('pagehide esegue subito, una volta sola, anche con timer e smontaggio dopo', async () => {
    const { esegui, unmount } = monta();
    fireEvent.click(screen.getByText('elimina a'));
    await act(async () => {
      window.dispatchEvent(new Event('pagehide'));
    });
    expect(esegui).toHaveBeenCalledTimes(1);
    unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });
    expect(esegui).toHaveBeenCalledTimes(1);
  });

  it('visibilitychange su hidden esegue', async () => {
    const { esegui } = monta();
    fireEvent.click(screen.getByText('elimina a'));
    const orig = Object.getOwnPropertyDescriptor(Document.prototype, 'visibilityState');
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    delete (document as unknown as Record<string, unknown>).visibilityState;
    void orig;
    expect(esegui).toHaveBeenCalledTimes(1);
  });

  it('lo smontaggio esegue la pendente una volta sola', async () => {
    const { esegui, unmount } = monta();
    fireEvent.click(screen.getByText('elimina a'));
    unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });
    expect(esegui).toHaveBeenCalledTimes(1);
  });

  it('la seconda eliminazione esegue la prima e mostra la sua', async () => {
    const e1 = vi.fn(async () => {});
    const e2 = vi.fn(async () => {});
    render(
      <AnnullaProvider>
        <Prova id="a" esegui={e1} nascondi={() => {}} ripristina={() => {}} />
        <Prova id="b" esegui={e2} nascondi={() => {}} ripristina={() => {}} />
      </AnnullaProvider>,
    );
    fireEvent.click(screen.getByText('elimina a'));
    fireEvent.click(screen.getByText('elimina b'));
    expect(e1).toHaveBeenCalledTimes(1);
    expect(e2).not.toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent('Spesa b eliminata.');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(e1).toHaveBeenCalledTimes(1);
    expect(e2).toHaveBeenCalledTimes(1);
  });

  it('chiudere l avviso non annulla: scrive subito', async () => {
    const { esegui, ripristina } = monta();
    fireEvent.click(screen.getByText('elimina a'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Chiudi avviso' }));
    });
    expect(esegui).toHaveBeenCalledTimes(1);
    expect(ripristina).not.toHaveBeenCalled();
  });
});
