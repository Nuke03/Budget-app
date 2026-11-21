import { describe, it, expect, vi, afterEach } from 'vitest';
import * as rientriData from '@/lib/data/rientri';
import * as goalSpending from '@/lib/data/goalSpending';
import { conSpesoDaRientrare } from '@/lib/loadHomeData';
import type { CasaAggiunta } from '@/lib/loadCasaData';
import type { SupabaseClient } from '@supabase/supabase-js';

const NOW = new Date('2026-11-15T12:00:00Z');
const supabase = {} as SupabaseClient;
afterEach(() => vi.restoreAllMocks());

const aggiunta = {
  householdId: 'H1',
  meUserId: 'A',
  nomi: [],
  conti: [],
  categorie: [],
  obiettivi: [{ id: 'g1' }],
} as unknown as CasaAggiunta;

const rientro = {
  id: 'r1', userId: 'A', householdId: 'H1', goalId: 'g1', accountId: null, importo: 300, mesi: 3,
  creatoIl: '2026-11-01', stato: 'aperto', fermatoIl: null,
};

describe('conSpesoDaRientrare', () => {
  it('speso meno il maturato, mai sotto zero, con lo scope della casa', async () => {
    const speso = vi.spyOn(goalSpending, 'getSpecoCollegatoPerObiettivi').mockResolvedValue({ g1: 250 });
    const rientri = vi.spyOn(rientriData, 'getRientri').mockResolvedValue([rientro] as never);
    const r = await conSpesoDaRientrare(supabase, aggiunta, NOW);
    // maturato a novembre: una rata da 100
    expect(r.spesoDaRientrare).toEqual({ g1: 150 });
    expect(speso).toHaveBeenCalledWith(supabase, aggiunta.obiettivi, NOW, { kind: 'casa', householdId: 'H1' });
    expect(rientri).toHaveBeenCalledWith(supabase, { kind: 'casa', householdId: 'H1' });
    speso.mockResolvedValue({ g1: 40 });
    expect((await conSpesoDaRientrare(supabase, aggiunta, NOW)).spesoDaRientrare).toEqual({ g1: 0 });
  });

  it('se i rientri non si leggono la cifra non si propone', async () => {
    vi.spyOn(goalSpending, 'getSpecoCollegatoPerObiettivi').mockResolvedValue({ g1: 250 });
    vi.spyOn(rientriData, 'getRientri').mockRejectedValue(new Error('giù'));
    const r = await conSpesoDaRientrare(supabase, aggiunta, NOW);
    expect(r.spesoDaRientrare).toBeUndefined();
    expect(r.householdId).toBe('H1');
  });
});
