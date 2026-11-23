import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const salvaSituazioneDati = vi.fn(async () => {});
const segnaVoceDati = vi.fn(async () => {});
const segnaSezioneApertaDati = vi.fn(async () => {});
const revalidatePath = vi.fn();
vi.mock('next/cache', () => ({ revalidatePath: (...a: unknown[]) => revalidatePath(...a) }));
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({}) }));
vi.mock('@/lib/utenteOLogin', () => ({ utenteOLogin: async () => ({ id: 'u1' }) }));
vi.mock('@/lib/data/agevolazioni', () => ({
  salvaSituazioneDati: (...a: unknown[]) => salvaSituazioneDati(...(a as [])),
  segnaVoceDati: (...a: unknown[]) => segnaVoceDati(...(a as [])),
  segnaSezioneApertaDati: (...a: unknown[]) => segnaSezioneApertaDati(...(a as [])),
}));

import { salvaSituazione, segnaVoce, segnaSezioneAperta } from '@/app/agevolazioni/actions';

const ok = { isee: 12000, dsuData: '2026-02-10', comune: 'Roma', inAffitto: true, studente: false };

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-23T10:00:00Z'));
  vi.resetAllMocks();
});
afterEach(() => vi.useRealTimers());

describe('salvaSituazione', () => {
  it('salva, ripulisce il comune, arrotonda l ISEE e ricarica', async () => {
    await salvaSituazione({ ...ok, isee: 12000.456, comune: '  Roma  ' });
    const [, dati, adesso] = salvaSituazioneDati.mock.calls[0] as unknown as [unknown, unknown, string];
    expect(dati).toEqual({ ...ok, isee: 12000.46, comune: 'Roma' });
    expect(adesso).toBe('2026-11-23T10:00:00.000Z');
    expect(revalidatePath).toHaveBeenCalledWith('/agevolazioni');
    expect(revalidatePath).toHaveBeenCalledWith('/');
  });
  it('campi vuoti restano null; comune vuoto diventa null', async () => {
    await salvaSituazione({ isee: null, dsuData: null, comune: '   ', inAffitto: null, studente: null });
    const [, dati] = salvaSituazioneDati.mock.calls[0] as unknown as [unknown, unknown];
    expect(dati).toEqual({ isee: null, dsuData: null, comune: null, inAffitto: null, studente: null });
  });
  it('ISEE 0 e 999999.99 valgono', async () => {
    await salvaSituazione({ ...ok, isee: 0 });
    await salvaSituazione({ ...ok, isee: 999999.99 });
    expect(salvaSituazioneDati).toHaveBeenCalledTimes(2);
  });
  it.each([-1, -0.01, 1_000_000, 1e9, NaN, Infinity, 999999.996])('ISEE %s rifiutato', async (isee) => {
    await expect(salvaSituazione({ ...ok, isee })).rejects.toThrow();
    expect(salvaSituazioneDati).not.toHaveBeenCalled();
  });
  it('data DSU: oggi vale (Roma), domani no, inesistente no', async () => {
    await salvaSituazione({ ...ok, dsuData: '2026-11-23' });
    expect(salvaSituazioneDati).toHaveBeenCalledTimes(1);
    for (const d of ['2026-11-24', '2026-02-30', '2026-13-01', '10/02/2026', 'ieri']) {
      await expect(salvaSituazione({ ...ok, dsuData: d })).rejects.toThrow('Data non valida');
    }
    expect(salvaSituazioneDati).toHaveBeenCalledTimes(1);
  });
  it('Roma, non UTC: alle 23:30 UTC e gia il giorno dopo', async () => {
    vi.setSystemTime(new Date('2026-11-23T23:30:00Z'));
    await salvaSituazione({ ...ok, dsuData: '2026-11-24' });
    expect(salvaSituazioneDati).toHaveBeenCalledTimes(1);
  });
  it('comune oltre 80 caratteri rifiutato, 80 va bene', async () => {
    await salvaSituazione({ ...ok, comune: 'a'.repeat(80) });
    await expect(salvaSituazione({ ...ok, comune: 'a'.repeat(81) })).rejects.toThrow('Comune non valido');
    await expect(salvaSituazione({ ...ok, comune: `  ${'a'.repeat(81)}  ` })).rejects.toThrow();
  });
  it('tipi sbagliati rifiutati', async () => {
    await expect(salvaSituazione({ ...ok, inAffitto: 'si' as never })).rejects.toThrow();
    await expect(salvaSituazione({ ...ok, comune: 5 as never })).rejects.toThrow();
  });
  it('un errore della scrittura arriva a chi chiama, senza revalidate', async () => {
    salvaSituazioneDati.mockRejectedValueOnce(new Error('boom'));
    await expect(salvaSituazione(ok)).rejects.toThrow('boom');
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe('segnaVoce', () => {
  it('passa data di Roma e ricarica', async () => {
    await segnaVoce('trasporto', 'fatto');
    expect(segnaVoceDati).toHaveBeenCalledWith({}, 'trasporto', 'fatto', '2026-11-23');
    expect(revalidatePath).toHaveBeenCalledWith('/agevolazioni');
    expect(revalidatePath).toHaveBeenCalledWith('/');
  });
  it('null toglie lo stato', async () => {
    await segnaVoce('isee-dsu', null);
    expect(segnaVoceDati).toHaveBeenCalledWith({}, 'isee-dsu', null, '2026-11-23');
  });
  it('voce o stato non validi rifiutati', async () => {
    await expect(segnaVoce('boh' as never, 'fatto')).rejects.toThrow('Voce non valida');
    await expect(segnaVoce('trasporto', 'forse' as never)).rejects.toThrow('Scelta non valida');
    await expect(segnaVoce('trasporto', undefined as never)).rejects.toThrow();
    expect(segnaVoceDati).not.toHaveBeenCalled();
  });
  it('errore rilanciato', async () => {
    segnaVoceDati.mockRejectedValueOnce(new Error('boom'));
    await expect(segnaVoce('trasporto', 'fatto')).rejects.toThrow('boom');
  });
});

describe('segnaSezioneAperta', () => {
  it('scrive la data di Roma', async () => {
    await segnaSezioneAperta();
    expect(segnaSezioneApertaDati).toHaveBeenCalledWith({}, '2026-11-23');
    expect(revalidatePath).toHaveBeenCalledWith('/');
  });
  it('errore rilanciato', async () => {
    segnaSezioneApertaDati.mockRejectedValueOnce(new Error('boom'));
    await expect(segnaSezioneAperta()).rejects.toThrow('boom');
  });
});
