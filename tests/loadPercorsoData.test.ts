import { describe, it, expect } from 'vitest';
import { loadHomeData } from '@/lib/loadHomeData';
import { loadPercorsoData } from '@/lib/loadPercorsoData';
import { createFakeDb } from './helpers/fakeDb';

const TODAY = new Date('2026-11-15T12:00:00Z');

function nuovoDb() {
  const db = createFakeDb(
    {
      accounts: [{ id: 'a1', user_id: 'A', household_id: null, nome: 'Corrente', saldo_attuale: 500, conta_in_disponibile: true, target_saldo: null }],
      budget_goals: [],
      categories: [{ id: 'c1', user_id: 'A', household_id: null, nome: 'Spesa', icona: null, ruolo: null }],
      transactions: [
        {
          id: 't1', user_id: 'A', household_id: null, tipo: 'expense', importo: 12, data: '2026-11-10',
          categoria_id: 'c1', account_id: 'a1', goal_id: null, descrizione: 'Pizza', nota: null,
          created_at: '2026-11-10T10:00:00Z', stima: false,
        },
        {
          id: 't2', user_id: 'A', household_id: null, tipo: 'income', importo: 900, data: '2026-11-01',
          categoria_id: null, account_id: 'a1', goal_id: null, descrizione: 'Stipendio', nota: null,
          created_at: '2026-11-01T10:00:00Z', stima: false,
        },
      ],
    },
    { userId: 'A', membri: {} }
  );
  // Ogni lettura di tabella si conta, per nome.
  const tabelle: string[] = [];
  const from = db.client.from;
  db.client.from = (nome: string) => {
    tabelle.push(nome);
    return from(nome);
  };
  return { db, tabelle };
}

const conta = (tabelle: string[]): Record<string, number> =>
  tabelle.reduce<Record<string, number>>((m, t) => ({ ...m, [t]: (m[t] ?? 0) + 1 }), {});

describe('loadPercorsoData: nessuna lettura in più della Home', () => {
  it('stesse letture, tabella per tabella, di loadHomeData', async () => {
    const a = nuovoDb();
    await loadHomeData(a.db.client, TODAY, 'A');
    const b = nuovoDb();
    await loadPercorsoData(b.db.client, TODAY, 'A');
    expect(conta(b.tabelle)).toEqual(conta(a.tabelle));
  });

  it('percorso, impostazioni P.IVA e transazioni si leggono una volta sola', async () => {
    const { db, tabelle } = nuovoDb();
    await loadPercorsoData(db.client, TODAY, 'A');
    const n = conta(tabelle);
    expect(n['percorso_utente']).toBeLessThanOrEqual(1);
    expect(n['piva_settings']).toBeLessThanOrEqual(1);
    // Una lettura per le transazioni dei 3 mesi, una per l'ultima entrata, una per l'ultima creazione.
    expect(n['transactions']).toBe(3);
  });

  it('dà gli stessi dati di prima: transazioni dei 3 mesi, ultima entrata, primi passi', async () => {
    const { db } = nuovoDb();
    const d = await loadPercorsoData(db.client, TODAY, 'A');
    expect(d.oggi).toBe('2026-11-15');
    expect(d.transazioni.map((t) => t.id).sort()).toEqual(['t1', 't2']);
    expect(d.ultimaEntrataIl).toBe('2026-11-01');
    expect(d.categorie.map((c) => c.id)).toEqual(['c1']);
    expect(d.conti.map((c) => c.id)).toEqual(['a1']);
    expect(typeof d.primiPassiVisibili).toBe('boolean');
    expect(d.primiPassi.visibile).toBe(d.primiPassiVisibili);
  });
});
