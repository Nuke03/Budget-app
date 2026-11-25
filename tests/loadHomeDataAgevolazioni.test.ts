import { describe, it, expect, vi, afterEach } from 'vitest';
import * as agev from '@/lib/data/agevolazioni';
import { loadHomeData } from '@/lib/loadHomeData';
import { createFakeDb } from './helpers/fakeDb';

afterEach(() => vi.restoreAllMocks());

const conto = { id: 'acc', user_id: 'A', household_id: null, nome: 'Conto', saldo_attuale: 3000, conta_in_disponibile: true, target_saldo: null };
const spesa = {
  id: 't1', user_id: 'A', household_id: null, tipo: 'expense', importo: 5, data: '2027-01-01', categoria_id: null,
  account_id: null, goal_id: null, descrizione: 'Caffè', nota: null, created_at: '2027-01-01T10:00:00Z', stima: false,
};
const situazione = (extra: Record<string, unknown>) => ({
  user_id: 'A', isee: null, dsu_data: null, comune: null, in_affitto: null, studente: null, sezione_aperta_il: null, ...extra,
});
function db(sit: Record<string, unknown>[]) {
  return createFakeDb(
    { accounts: [conto], budget_goals: [], transactions: [spesa, { ...spesa, id: 't2', data: '2027-02-09', created_at: '2027-02-09T10:00:00Z' }], categories: [], agevolazioni_situazione: sit, agevolazioni_stati: [] },
    { userId: 'A', membri: {} }
  );
}
const GEN = new Date('2027-01-02T12:00:00Z');
const FEB = new Date('2027-02-10T12:00:00Z');

describe('loadHomeData: promemoria agevolazioni', () => {
  it('2 gennaio con DSU 2026: ISEE scaduto', async () => {
    const d = await loadHomeData(db([situazione({ isee: 12000, dsu_data: '2026-03-10' })]).client, GEN, null);
    expect(d.prossimo).toMatchObject({ tipo: 'agevolazione', testo: "L'ISEE è scaduto il 31 dicembre: rifai la DSU." });
    expect(d.prossimoDati.agevolazione?.href).toBe('/agevolazioni#isee-dsu');
  });
  it('DSU 2027: niente', async () => {
    const d = await loadHomeData(db([situazione({ isee: 12000, dsu_data: '2027-01-02' })]).client, GEN, null);
    expect(d.prossimo?.tipo).not.toBe('agevolazione');
  });
  it('febbraio con affitto: contributo affitto', async () => {
    const d = await loadHomeData(db([situazione({ in_affitto: true })]).client, FEB, null);
    expect(d.prossimo?.tipo).toBe('agevolazione');
    expect(d.prossimo?.href).toBe('/agevolazioni#contributo-affitto');
  });
  it('letture fallite: niente promemoria e Home intatta', async () => {
    const base = await loadHomeData(db([]).client, GEN, null);
    vi.spyOn(agev, 'getSituazione').mockRejectedValue(new Error('x'));
    vi.spyOn(agev, 'getStatiVoci').mockRejectedValue(new Error('x'));
    const d = await loadHomeData(db([situazione({ isee: 12000, dsu_data: '2026-03-10' })]).client, GEN, null);
    expect(d.prossimoDati.agevolazione ?? null).toBeNull();
    expect(d.disponibileReale).toBe(base.disponibileReale);
  });
  it('un promemoria Casa ha la precedenza', async () => {
    const d = await loadHomeData(db([situazione({ isee: 12000, dsu_data: '2026-03-10' })]).client, GEN, null);
    const conCasa = { ...d.prossimoDati, promemoriaCasa: [{ testo: 'Versa la quota' }] };
    const { prossimaCosa } = await import('@/lib/calculations/supporto/home');
    expect(prossimaCosa(conCasa)?.tipo).toBe('casa');
  });
});
