import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const segnaLezione = vi.fn(async () => {});
const revalidatePath = vi.fn();
const utenteOLogin = vi.fn(async () => ({ id: 'u1' }));
vi.mock('next/cache', () => ({ revalidatePath: (...a: unknown[]) => revalidatePath(...a) }));
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({}) }));
vi.mock('@/lib/utenteOLogin', () => ({ utenteOLogin: () => utenteOLogin() }));
vi.mock('@/lib/data/percorso', async (orig) => ({
  ...(await orig<typeof import('@/lib/data/percorso')>()),
  segnaLezione: (...a: unknown[]) => segnaLezione(...(a as [])),
}));

import { apriLezione, rimandaLezione, lezioneFatta } from '@/app/impara/actions';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-19T10:00:00Z'));
  segnaLezione.mockClear();
  revalidatePath.mockClear();
  utenteOLogin.mockClear();
});
afterEach(() => vi.useRealTimers());

describe('azioni Impara', () => {
  it('rimandaLezione scrive rimandataAl = oggi + 14', async () => {
    await rimandaLezione('piano');
    expect(segnaLezione).toHaveBeenCalledWith({}, 'piano', { rimandataAl: '2026-12-03' });
    expect(utenteOLogin).toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith('/impara');
  });
  it('apriLezione scrive vistaIl = oggi', async () => {
    await apriLezione('piano');
    expect(segnaLezione).toHaveBeenCalledWith({}, 'piano', { vistaIl: '2026-11-19' });
  });
  it('lezioneFatta scrive azioneIl = oggi', async () => {
    await lezioneFatta('piano');
    expect(segnaLezione).toHaveBeenCalledWith({}, 'piano', { azioneIl: '2026-11-19' });
  });
  it('un id sconosciuto lancia e non scrive', async () => {
    await expect(apriLezione('boh' as never)).rejects.toThrow();
    expect(segnaLezione).not.toHaveBeenCalled();
  });
});
