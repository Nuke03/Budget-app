import { describe, it, expect, vi, afterEach } from 'vitest';
import * as transactions from '@/lib/data/transactions';
import { loadHomeData } from '@/lib/loadHomeData';
import { createFakeDb } from './helpers/fakeDb';

const TODAY = new Date('2026-11-15T12:00:00Z');

afterEach(() => vi.restoreAllMocks());

describe('loadHomeData: libretto', () => {
  it('legge le transazioni una volta sola', async () => {
    const spia = vi.spyOn(transactions, 'getTransactions');
    const db = createFakeDb({ accounts: [], budget_goals: [], transactions: [], categories: [] }, { userId: 'A', membri: {} });
    await loadHomeData(db.client, TODAY, null);
    expect(spia).toHaveBeenCalledTimes(1);
  });

  it('senza movimenti: righe vuote, solito null, nessun prossimo, notifiche sconosciute', async () => {
    const db = createFakeDb({ accounts: [], budget_goals: [], transactions: [], categories: [] }, { userId: 'A', membri: {} });
    const d = await loadHomeData(db.client, TODAY, null);
    expect(d.righe).toEqual([]);
    expect(d.andamento.solito).toBeNull();
    expect(d.prossimo).toBeNull();
    expect(d.notificheAttive).toBeNull();
    expect(d.consiglio.testo).toBeTruthy();
  });

  it('con una spesa vecchia di giorni propone "in pari" e legge le scelte', async () => {
    const db = createFakeDb(
      {
        accounts: [], budget_goals: [], categories: [],
        transactions: [{
          id: 't1', user_id: 'A', household_id: null, tipo: 'expense', importo: 12, data: '2026-11-10',
          categoria_id: null, account_id: null, goal_id: null, descrizione: 'Pizza', nota: null,
          created_at: '2026-11-10T10:00:00Z', stima: false,
        }],
        promemoria_utente: [{ user_id: 'A', notifiche_attive: true, nessuna_spesa_fino_al: null }],
      },
      { userId: 'A', membri: {} }
    );
    const d = await loadHomeData(db.client, TODAY, null);
    expect(d.righe[0]).toMatchObject({ id: 't1', nelMese: 12 });
    expect(d.prossimo?.tipo).toBe('in_pari');
    expect(d.notificheAttive).toBe(true);
  });
});
