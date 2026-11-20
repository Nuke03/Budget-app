import { describe, it, expect, vi, beforeEach } from 'vitest';

const getOpenGoals = vi.fn();
const getConfermePerObiettivi = vi.fn();
const computeQuotaMensile = vi.fn();
const getMyHousehold = vi.fn();
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({}) }));
vi.mock('@/lib/utenteOLogin', () => ({ utenteOLogin: async () => ({ id: 'u1' }) }));
vi.mock('@/lib/data/goals', () => ({ getOpenGoals: (...a: unknown[]) => getOpenGoals(...a) }));
vi.mock('@/lib/data/goalVersamenti', () => ({
  getConfermePerObiettivi: (...a: unknown[]) => getConfermePerObiettivi(...a),
}));
vi.mock('@/lib/calculations/accantonato', () => ({
  computeQuotaMensile: (...a: unknown[]) => computeQuotaMensile(...a),
}));
vi.mock('@/lib/data/households', () => ({ getMyHousehold: (...a: unknown[]) => getMyHousehold(...a) }));

import { leggiVociMenu } from '@/app/menu/actions';

const bloccato = { id: 'b', nome: 'Vacanza', modalita: 'bloccato' };
const rate = { id: 'd', nome: 'Assicurazione', modalita: 'dilazionato' };

beforeEach(() => {
  vi.resetAllMocks();
  getOpenGoals.mockResolvedValue([]);
  getConfermePerObiettivi.mockResolvedValue({});
  computeQuotaMensile.mockReturnValue(50);
  getMyHousehold.mockResolvedValue(null);
});

describe('leggiVociMenu', () => {
  it('un bloccato e un dilazionato: solo il dilazionato', async () => {
    getOpenGoals.mockResolvedValue([bloccato, rate]);
    getConfermePerObiettivi.mockResolvedValue({ d: { versato: 10, mese: 25 } });
    computeQuotaMensile.mockReturnValue(33.3333);
    const r = await leggiVociMenu();
    expect(r.cassettiARate).toEqual([{ id: 'd', nome: 'Assicurazione', quota: 33.33, confermatoMese: 25 }]);
  });

  it('dilazionato senza scadenza (il calcolo lancia): escluso', async () => {
    getOpenGoals.mockResolvedValue([rate]);
    computeQuotaMensile.mockImplementation(() => {
      throw new Error('Scadenza mancante');
    });
    expect((await leggiVociMenu()).cassettiARate).toEqual([]);
  });

  it('quota null o 0: escluso', async () => {
    getOpenGoals.mockResolvedValue([rate]);
    computeQuotaMensile.mockReturnValue(null);
    expect((await leggiVociMenu()).cassettiARate).toEqual([]);
    computeQuotaMensile.mockReturnValue(0);
    expect((await leggiVociMenu()).cassettiARate).toEqual([]);
  });

  it('conferme che falliscono: confermatoMese 0', async () => {
    getOpenGoals.mockResolvedValue([rate]);
    getConfermePerObiettivi.mockRejectedValue(new Error('boom'));
    expect((await leggiVociMenu()).cassettiARate[0].confermatoMese).toBe(0);
  });

  it('casa presente: haCasa true', async () => {
    getMyHousehold.mockResolvedValue({ id: 'h' });
    expect((await leggiVociMenu()).haCasa).toBe(true);
    expect(getMyHousehold).toHaveBeenCalledWith({}, 'u1');
  });

  it('getMyHousehold che lancia: haCasa false', async () => {
    getMyHousehold.mockRejectedValue(new Error('boom'));
    expect((await leggiVociMenu()).haCasa).toBe(false);
  });

  it('nessun obiettivo: cassettiARate vuoto', async () => {
    expect(await leggiVociMenu()).toEqual({ cassettiARate: [], haCasa: false });
  });
});
