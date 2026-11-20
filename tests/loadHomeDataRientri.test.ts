import { describe, it, expect, vi, afterEach } from 'vitest';
import * as rientriData from '@/lib/data/rientri';
import { loadHomeData } from '@/lib/loadHomeData';
import { createFakeDb } from './helpers/fakeDb';

const TODAY = new Date('2026-11-15T12:00:00Z');
afterEach(() => vi.restoreAllMocks());

const corrente = { id: 'cor', user_id: 'A', household_id: null, nome: 'Corrente', saldo_attuale: 1000, conta_in_disponibile: true, target_saldo: null };
const risparmio = { id: 'ris', user_id: 'A', household_id: null, nome: 'Risparmio', saldo_attuale: 500, conta_in_disponibile: false, target_saldo: null };
const spesa = {
  id: 't1', user_id: 'A', household_id: null, tipo: 'expense', importo: 5, data: '2026-11-14', categoria_id: null,
  account_id: null, goal_id: null, descrizione: 'Caffè', nota: null, created_at: '2026-11-14T10:00:00Z', stima: false,
};
const bloccato = {
  id: 'g1', user_id: 'A', household_id: null, nome: 'Vacanza', importo_target: 600, modalita: 'bloccato',
  scadenza: null, categoria_id: null, ricorrente: false, frequenza_mesi: null, stato: 'aperto',
  created_at: '2026-06-01T00:00:00Z', accantona_da: null,
};
const rientro = (extra: Record<string, unknown>) => ({
  id: 'r1', user_id: 'A', household_id: null, goal_id: null, account_id: null, importo: 300, mesi: 3,
  creato_il: '2026-11-01', stato: 'aperto', fermato_il: null, ...extra,
});

function db(rientri: Record<string, unknown>[], spostamenti: Record<string, unknown>[] = []) {
  return createFakeDb(
    { accounts: [corrente, risparmio], budget_goals: [], transactions: [spesa], categories: [], rientri, spostamenti },
    { userId: 'A', membri: {} }
  );
}

describe('loadHomeData: rientri', () => {
  it('un rientro verso il conto risparmio toglie la rata dal disponibile e propone di spostare', async () => {
    const senza = await loadHomeData(db([]).client, TODAY, null);
    const d = await loadHomeData(db([rientro({ account_id: 'ris' })]).client, TODAY, null);
    expect(d.disponibileReale).toBe(senza.disponibileReale - 100);
    expect(d.riservaRientri).toBe(100);
    expect(d.rientriConti).toHaveLength(1);
    expect(d.prossimo).toMatchObject({ tipo: 'sposta', href: '/?sposta=r1' });
    expect(d.prossimo?.testo).toBe('Sposta 100 € sul Risparmio.');
  });

  it('con uno spostamento già fatto il disponibile è quello di prima e nessun Sposta', async () => {
    const sp = { id: 's1', da_account_id: 'cor', a_account_id: 'ris', importo: 100, data: '2026-11-10', created_at: '2026-11-10T10:00:00Z' };
    const senza = await loadHomeData(db([]).client, TODAY, null);
    const d = await loadHomeData(db([rientro({ account_id: 'ris' })], [sp]).client, TODAY, null);
    expect(d.disponibileReale).toBe(senza.disponibileReale);
    expect(d.riservaRientri).toBe(0);
    expect(d.prossimo).toBeNull();
  });

  it('un rientro verso un cassetto bloccato speso alza il riservato del cassetto', async () => {
    // Cassetto bloccato da 600, speso 200: riservato 400; il rientro maturato (100) lo rialza a 500.
    const speso = { ...spesa, id: 't2', goal_id: 'g1', importo: 200, data: '2026-11-10' };
    const mk = (rientri: Record<string, unknown>[]) =>
      createFakeDb(
        { accounts: [corrente], budget_goals: [bloccato], transactions: [spesa, speso], categories: [], rientri, spostamenti: [] },
        { userId: 'A', membri: {} }
      );
    const senza = await loadHomeData(mk([]).client, TODAY, null);
    const d = await loadHomeData(mk([rientro({ goal_id: 'g1' })]).client, TODAY, null);
    expect(senza.riservati.obiettivi).toBe(400);
    expect(d.riservati.obiettivi).toBe(500);
    expect(d.goals[0].accantonato).toBe(500);
  });

  it('se la lettura dei rientri lancia, i numeri sono quelli senza rientri', async () => {
    const senza = await loadHomeData(db([]).client, TODAY, null);
    vi.spyOn(rientriData, 'getRientri').mockRejectedValue(new Error('giù'));
    const d = await loadHomeData(db([rientro({ account_id: 'ris' })]).client, TODAY, null);
    expect(d.disponibileReale).toBe(senza.disponibileReale);
    expect(d.riservaRientri).toBe(0);
    expect(d.rientriConti).toEqual([]);
    expect(d.prossimo).toBeNull();
  });
});
