import { describe, it, expect, vi, afterEach } from 'vitest';
import * as rientriData from '@/lib/data/rientri';
import * as spostamentiData from '@/lib/data/spostamenti';
import { leggiRientriESpostamenti } from '@/lib/data/rientriLetti';
import { rientriEffettivi, type Rientro } from '@/lib/calculations/rientri';

afterEach(() => vi.restoreAllMocks());

const base = { userId: 'u', householdId: null, importo: 300, mesi: 3 as const, creatoIl: '2026-11-01', stato: 'aperto' as const, fermatoIl: null };
const conto: Rientro = { ...base, id: 'rc', goalId: null, accountId: 'ris' };
const cassetto: Rientro = { ...base, id: 'rg', goalId: 'g1', accountId: null };
const client = {} as never;

describe('leggiRientriESpostamenti', () => {
  it('rientri che non si leggono: nessun rientro', async () => {
    vi.spyOn(rientriData, 'getRientri').mockRejectedValue(new Error('giù'));
    expect(await leggiRientriESpostamenti(client)).toEqual({ rientri: [], spostamenti: [] });
  });
  it('spostamenti che non si leggono: null', async () => {
    vi.spyOn(rientriData, 'getRientri').mockResolvedValue([conto]);
    vi.spyOn(spostamentiData, 'getSpostamenti').mockRejectedValue(new Error('giù'));
    expect(await leggiRientriESpostamenti(client)).toEqual({ rientri: [conto], spostamenti: null });
  });
  it('senza rientri verso conti non legge gli spostamenti', async () => {
    vi.spyOn(rientriData, 'getRientri').mockResolvedValue([cassetto]);
    const spia = vi.spyOn(spostamentiData, 'getSpostamenti');
    expect(await leggiRientriESpostamenti(client)).toEqual({ rientri: [cassetto], spostamenti: [] });
    expect(spia).not.toHaveBeenCalled();
  });
});

describe('rientriEffettivi', () => {
  it('con spostamenti non letti ignora i rientri verso i conti e tiene quelli verso i cassetti', () => {
    const r = rientriEffettivi([conto, cassetto], null, new Set(['cor']), new Set(['ris']), '2026-11-15');
    expect(r).toEqual({ rientri: [cassetto], rientriConti: [], riservaRientri: 0 });
  });
  it('con spostamenti letti calcola la riserva', () => {
    const r = rientriEffettivi([conto, cassetto], [], new Set(['cor']), new Set(['ris']), '2026-11-15');
    expect(r.riservaRientri).toBe(100);
    expect(r.rientriConti).toHaveLength(1);
  });
  it('ignora i rientri verso un conto che non è più una destinazione valida (niente da spostare)', () => {
    const r = rientriEffettivi([conto, cassetto], [], new Set(['cor']), new Set(['altro']), '2026-11-15');
    expect(r.rientri).toEqual([cassetto]);
    expect(r.rientriConti).toEqual([]);
    expect(r.riservaRientri).toBe(0);
  });
});
