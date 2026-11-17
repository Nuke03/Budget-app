import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { creaCodaRimandata } from '@/lib/eliminazioneRimandata';

const r = (id: string) => ({ id, testo: `Eliminata ${id}.`, esegui: vi.fn(async () => {}) });

describe('creaCodaRimandata', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('esegue dopo 5 secondi, non prima', async () => {
    const coda = creaCodaRimandata({ attesaMs: 5000 });
    const a = r('a');
    coda.aggiungi(a);
    expect(coda.inAttesa()?.id).toBe('a');
    await vi.advanceTimersByTimeAsync(4999);
    expect(a.esegui).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(a.esegui).toHaveBeenCalledTimes(1);
    expect(coda.inAttesa()).toBeNull();
  });

  it('annulla prima dei 5 secondi non esegue', async () => {
    const coda = creaCodaRimandata({ attesaMs: 5000 });
    const a = r('a');
    coda.aggiungi(a);
    expect(coda.annulla('a')).toBe(true);
    await vi.advanceTimersByTimeAsync(10000);
    expect(a.esegui).not.toHaveBeenCalled();
    expect(coda.annulla('a')).toBe(false);
  });

  it('annulla con un id diverso non fa nulla', async () => {
    const coda = creaCodaRimandata({ attesaMs: 5000 });
    const a = r('a');
    coda.aggiungi(a);
    expect(coda.annulla('b')).toBe(false);
    await vi.advanceTimersByTimeAsync(5000);
    expect(a.esegui).toHaveBeenCalledTimes(1);
  });

  it('una seconda aggiungi esegue subito la prima', async () => {
    const coda = creaCodaRimandata({ attesaMs: 5000 });
    const a = r('a');
    const b = r('b');
    coda.aggiungi(a);
    coda.aggiungi(b);
    expect(a.esegui).toHaveBeenCalledTimes(1);
    expect(b.esegui).not.toHaveBeenCalled();
    expect(coda.inAttesa()?.id).toBe('b');
    await vi.advanceTimersByTimeAsync(5000);
    expect(a.esegui).toHaveBeenCalledTimes(1);
    expect(b.esegui).toHaveBeenCalledTimes(1);
  });

  it('eseguiTutte esegue quella in attesa una sola volta, anche con il timer dopo', async () => {
    const coda = creaCodaRimandata({ attesaMs: 5000 });
    const a = r('a');
    coda.aggiungi(a);
    await coda.eseguiTutte();
    await coda.eseguiTutte();
    await vi.advanceTimersByTimeAsync(10000);
    expect(a.esegui).toHaveBeenCalledTimes(1);
    expect(coda.inAttesa()).toBeNull();
  });

  it('eseguiTutte senza nulla in attesa non fa nulla', async () => {
    const coda = creaCodaRimandata({ attesaMs: 5000 });
    await expect(coda.eseguiTutte()).resolves.toBeUndefined();
  });

  it('lo stesso id aggiunto due volte non gira due volte', async () => {
    const coda = creaCodaRimandata({ attesaMs: 5000 });
    const a = r('a');
    coda.aggiungi(a);
    coda.aggiungi(a);
    await vi.advanceTimersByTimeAsync(10000);
    expect(a.esegui).toHaveBeenCalledTimes(1);
  });

  it('un errore in esegui non rompe la coda', async () => {
    const coda = creaCodaRimandata({ attesaMs: 5000 });
    const a = { id: 'a', testo: 'x', esegui: vi.fn(async () => { throw new Error('no'); }) };
    coda.aggiungi(a);
    await expect(coda.eseguiTutte()).resolves.toBeUndefined();
    const b = r('b');
    coda.aggiungi(b);
    await vi.advanceTimersByTimeAsync(5000);
    expect(b.esegui).toHaveBeenCalledTimes(1);
  });
});
