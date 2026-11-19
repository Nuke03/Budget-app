import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const aggiungiAttesa = vi.fn(async () => ({}));
const decidiAttesa = vi.fn(async () => {});
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({}) }));
vi.mock('@/lib/utenteOLogin', () => ({ utenteOLogin: async () => ({ id: 'u1' }) }));
vi.mock('@/lib/data/percorso', () => ({
  aggiungiAttesa: (...a: unknown[]) => aggiungiAttesa(...(a as [])),
  decidiAttesa: (...a: unknown[]) => decidiAttesa(...(a as [])),
}));

import { aggiungiVoce, decidiVoce } from '@/app/impara/attesa/actions';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-19T10:00:00Z'));
  vi.resetAllMocks();
  aggiungiAttesa.mockResolvedValue({});
  decidiAttesa.mockResolvedValue(undefined);
});
afterEach(() => vi.useRealTimers());

describe('aggiungiVoce', () => {
  it('arrotonda l importo ai centesimi', async () => {
    await aggiungiVoce('Cuffie', 89.999);
    expect(aggiungiAttesa).toHaveBeenCalledWith({}, 'Cuffie', 90, '2026-11-19');
    await aggiungiVoce('Cuffie', 10.234);
    expect(aggiungiAttesa).toHaveBeenLastCalledWith({}, 'Cuffie', 10.23, '2026-11-19');
  });

  it('un importo che arrotondato fa 0 si rifiuta', async () => {
    await expect(aggiungiVoce('Cuffie', 0.004)).rejects.toThrow('Importo non valido');
    expect(aggiungiAttesa).not.toHaveBeenCalled();
  });

  it('importo non valido o nome vuoto: rifiuta', async () => {
    await expect(aggiungiVoce('Cuffie', 0)).rejects.toThrow();
    await expect(aggiungiVoce('Cuffie', NaN)).rejects.toThrow();
    await expect(aggiungiVoce('  ', 5)).rejects.toThrow();
    expect(aggiungiAttesa).not.toHaveBeenCalled();
  });
});

describe('decidiVoce', () => {
  it('passa la data di oggi, così una voce non ancora scaduta non si decide', async () => {
    await decidiVoce('11111111-2222', 'voluto');
    expect(decidiAttesa).toHaveBeenCalledWith({}, '11111111-2222', 'voluto', '2026-11-19');
  });

  it('un errore della scrittura arriva a chi chiama', async () => {
    decidiAttesa.mockRejectedValueOnce(new Error('Voce non valida'));
    await expect(decidiVoce('11111111-2222', 'non_piu')).rejects.toThrow('Voce non valida');
  });
});
