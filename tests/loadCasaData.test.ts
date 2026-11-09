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

describe('loadCasaData speso collegato', () => {
  it('legge lo speso collegato con una sola query', async () => {
    const db = createFakeDb(seed(), { userId: 'A', membri: MEMBRI });
    const letture: string[] = [];
    const from = db.client.from.bind(db.client);
    db.client.from = (t: string) => {
      letture.push(t);
      return from(t);
    };
    await loadCasaData(db.client, casaA, TODAY);
    // transazioni: una per i registri e una sola per lo speso collegato
    expect(letture.filter((t) => t === 'transactions')).toHaveLength(2);
  });
});

describe('loadCasaData registri', () => {
  it('righe e debiti rispecchiano i registri con tre membri', async () => {
    const casa3: CasaCorrente = {
      ...casaA,
      members: [
        ...casaA.members,
        { householdId: 'H1', userId: 'C', displayName: 'Carla', joinedAt: T0, slot: 3, attivo: true },
      ],
    };
    const quota = (slot: number, user: string, nome: string, q: number) => ({
      plan_id: 'p1', slot, user_id: user, display_name: nome, reddito_netto_mensile: 1000,
      reddito_irregolare: false, percentuale: null, in_casa_dal: null, esce_dal: null, quota_mensile: q,
    });
    const versamento = (id: string, user: string, importo: number, mese: string, extra: object = {}) => ({
      id, household_id: 'H1', user_id: user, da_account_id: null, a_account_id: 'ac-casa', importo,
      data: '2026-11-05', causale: 'versamento', beneficiario_user_id: null, per_conto_di_user_id: null,
      mese_competenza: mese, solo_registrazione: false, nota: null, created_at: '2026-11-05T10:00:00Z', ...extra,
    });
    const s = {
      ...seed(),
      household_plans: [
        { id: 'p1', household_id: 'H1', valido_dal: '2026-10-01', giorno_versamento: 5, regola: 'parti_uguali',
          cuscinetto_obiettivo: 0, cuscinetto_quota_mensile: 0, arrotondamento: 10, totale_mensile: 1000, created_at: T0 },
      ],
      household_plan_items: [],
      household_plan_shares: [quota(1, 'A', 'Anna', 500), quota(2, 'B', 'Bruno', 300), quota(3, 'C', 'Carla', 200)],
      transfers: [
        versamento('v1', 'A', 200, '2026-10-01', { per_conto_di_user_id: 'C' }),
        versamento('v2', 'B', 100, '2026-11-01'),
      ],
    };
    const db = createFakeDb(s as never, { userId: 'A', membri: { H1: ['A', 'B', 'C'] } });
    const d = await loadCasaData(db.client, casa3, TODAY);
    expect(d.piani).toHaveLength(1);
    expect(d.righe.C.find((r) => r.mese === '2026-10-01')).toMatchObject({ atteso: 200, versato: 200, mancano: 0 });
    expect(d.righe.B.find((r) => r.mese === '2026-11-01')).toMatchObject({ atteso: 300, versato: 100, mancano: 200 });
    expect(d.righe.A.find((r) => r.mese === '2026-10-01')).toMatchObject({ versato: 0, mancano: 500 });
    expect(d.debiti).toEqual([
      { debitoreId: 'C', creditoreId: 'A', importo: 200, mesi: [{ mese: '2026-10-01', importo: 200, versato: 200 }] },
    ]);
  });
});

describe('loadCasaData disponibile completo', () => {
  const pianoDal = (validoDal: string) => ({
    household_plans: [
      { id: 'p1', household_id: 'H1', valido_dal: validoDal, giorno_versamento: 5, regola: 'parti_uguali',
        cuscinetto_obiettivo: 100, cuscinetto_quota_mensile: 10, arrotondamento: 10, totale_mensile: 310, created_at: T0 },
    ],
    household_plan_items: [
      { id: 'i1', plan_id: 'p1', nome: 'Luce', categoria_id: 'ca-casa', frequenza_mesi: 1, importo_ricorrenza: 300,
        importo_mensile: 300, origine_stima: 'manuale', goal_id: null, stima_ignorata_con_n: null, ordine: 1 },
    ],
    household_plan_shares: [],
  });
  const carica2 = (validoDal: string, adesso: Date = TODAY, extra: object[] = []) => {
    const s = { ...seed(), ...pianoDal(validoDal) };
    s.transactions = [...s.transactions, ...extra] as never;
    const db = createFakeDb(s as never, { userId: 'A', membri: MEMBRI });
    return loadCasaData(db.client, casaA, adesso);
  };

  it('disponibile con D e cuscinetto', async () => {
    const d = await carica2('2026-10-01');
    expect(d.disponibile).toMatchObject({ a: 1000, b: 130, c: 0, d: 280, e: 590, cuscinetto: 100, valore: 490 });
    expect(d.cuscinetto).toEqual({ attuale: 100, obiettivo: 100, quotaMensile: 10 });
  });

  it('piano che parte nel futuro: D e cuscinetto a zero', async () => {
    const d = await carica2('2026-12-01');
    expect(d.disponibile.valore).toBe(870);
    expect(d.disponibile.d).toBe(0);
    expect(d.cuscinetto).toBeNull();
  });

  it('mezzanotte italiana', async () => {
    const spesa = {
      id: 't-nov', user_id: 'B', household_id: 'H1', tipo: 'expense', importo: 50, data: '2026-11-01',
      categoria_id: 'ca-casa', account_id: 'ac-casa', goal_id: null, descrizione: 'Luce', nota: null,
      created_at: '2026-11-01T00:10:00Z',
    };
    const d = await carica2('2026-10-01', new Date('2026-10-31T23:30:00Z'), [spesa]);
    // a Roma è già il 1 novembre: D = 300 - (20 + 50), non il mese di ottobre
    expect(d.disponibile.d).toBe(230);
  });
});
