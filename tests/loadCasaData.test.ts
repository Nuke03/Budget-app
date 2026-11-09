import { describe, it, expect } from 'vitest';
import { loadCasaData } from '@/lib/loadCasaData';
import type { CasaCorrente } from '@/lib/data/households';
import { createFakeDb } from './helpers/fakeDb';

const TODAY = new Date('2026-11-15T12:00:00Z');
const MEMBRI = { H1: ['A', 'B'] };
const T0 = '2026-01-01T00:00:00Z';

const casaA: CasaCorrente = {
  household: { id: 'H1', nome: 'Casa', createdAt: T0, archiviataIl: null },
  members: [
    { householdId: 'H1', userId: 'A', displayName: 'Anna', joinedAt: T0, slot: 1, attivo: true },
    { householdId: 'H1', userId: 'B', displayName: 'Bruno', joinedAt: T0, slot: 2, attivo: true },
  ],
  invite: null,
  me: { householdId: 'H1', userId: 'A', displayName: 'Anna', joinedAt: T0, slot: 1, attivo: true },
};

function obiettivo(id: string, user: string, household: string | null, importo: number) {
  return {
    id,
    user_id: user,
    household_id: household,
    nome: id,
    importo_target: importo,
    modalita: 'bloccato',
    scadenza: null,
    categoria_id: null,
    ricorrente: false,
    frequenza_mesi: null,
    stato: 'aperto',
    created_at: T0,
    accantona_da: null,
  };
}

function seed() {
  return {
    accounts: [
      { id: 'ac-casa', user_id: 'B', household_id: 'H1', nome: 'Conto comune', saldo_attuale: 1000, conta_in_disponibile: true, target_saldo: null },
      { id: 'ac-A', user_id: 'A', household_id: null, nome: 'Conto A', saldo_attuale: 7777, conta_in_disponibile: true, target_saldo: null },
      { id: 'ac-C', user_id: 'C', household_id: 'H2', nome: 'Conto C', saldo_attuale: 5555, conta_in_disponibile: true, target_saldo: null },
    ],
    categories: [
      { id: 'ca-casa', user_id: 'B', household_id: 'H1', nome: 'Luce', tipo: 'expense', colore: null, archiviata: false },
      { id: 'ca-A', user_id: 'A', household_id: null, nome: 'Personale', tipo: 'expense', colore: null, archiviata: false },
    ],
    budget_goals: [obiettivo('g-casa', 'B', 'H1', 130), obiettivo('g-A', 'A', null, 999)],
    transactions: [
      { id: 't-casa', user_id: 'B', household_id: 'H1', tipo: 'expense', importo: 20, data: '2026-11-10', categoria_id: 'ca-casa', account_id: 'ac-casa', goal_id: null, descrizione: 'Bolletta', nota: null, created_at: '2026-11-10T10:00:00Z' },
      { id: 't-A', user_id: 'A', household_id: null, tipo: 'expense', importo: 5, data: '2026-11-11', categoria_id: null, account_id: 'ac-A', goal_id: null, descrizione: 'Cappuccino', nota: null, created_at: '2026-11-11T10:00:00Z' },
    ],
  };
}

function carica() {
  const db = createFakeDb(seed(), { userId: 'A', membri: MEMBRI });
  return loadCasaData(db.client, casaA, TODAY);
}

describe('loadCasaData crediti', () => {
  it('il disponibile casa sottrae i crediti: conto 1000, spesa anticipata 45, il valore è 955', async () => {
    const s = seed();
    s.budget_goals = [];
    s.transactions.push({
      id: 't-anticipo', user_id: 'B', household_id: 'H1', tipo: 'expense', importo: 45, data: '2026-11-12',
      categoria_id: 'ca-casa', account_id: 'ac-B', goal_id: null, descrizione: 'Spesa con carta', nota: null,
      created_at: '2026-11-12T10:00:00Z', pagata_da_user_id: 'B',
    } as never);
    const db = createFakeDb(s, { userId: 'A', membri: MEMBRI });
    const d = await loadCasaData(db.client, casaA, TODAY);
    expect(d.crediti).toEqual({ A: 0, B: 45 });
    expect(d.disponibile.valore).toBe(955);
    expect(d.trasferimenti).toEqual([]);
  });
});

describe('loadCasaData', () => {
  it('carica solo conti, categorie e obiettivi di casa', async () => {
    const d = await carica();
    expect(d.aggiunta.conti.map((c) => c.id)).toEqual(['ac-casa']);
    expect(d.aggiunta.categorie.map((c) => c.id)).toEqual(['ca-casa']);
    expect(d.aggiunta.obiettivi.map((g) => g.id)).toEqual(['g-casa']);
    expect(d.aggiunta.householdId).toBe('H1');
    expect(d.aggiunta.meUserId).toBe('A');
    expect(d.aggiunta.nomi).toEqual([
      { userId: 'A', nome: 'Anna' },
      { userId: 'B', nome: 'Bruno' },
    ]);
  });

  it('il disponibile è 870 con un conto di casa da 1000 e un obiettivo di casa da 130', async () => {
    const d = await carica();
    expect(d.disponibile.valore).toBe(870);
    expect(d.obiettiviConAccantonato).toEqual([expect.objectContaining({ id: 'g-casa', accantonato: 130 })]);
  });

  it('non include mai le righe personali di A', async () => {
    const d = await carica();
    expect(d.transazioni.map((t) => t.id)).toEqual(['t-casa']);
    expect(d.transazioni[0].userId).toBe('B');
    expect(JSON.stringify(d)).not.toContain('7777');
    expect(JSON.stringify(d)).not.toContain('Conto A');
  });
});
