import { describe, it, expect } from 'vitest';
import { loadHomeData } from '@/lib/loadHomeData';
import { createFakeDb } from './helpers/fakeDb';

const MEMBRI = { H1: ['A', 'B', 'C'] };
const TODAY = new Date('2026-11-15T12:00:00Z');

function conto(user: string, saldo: number, household: string | null = null) {
  return {
    id: `acc-${user}-${household ?? 'p'}`,
    user_id: user,
    household_id: household,
    nome: `Conto ${user}`,
    saldo_attuale: saldo,
    conta_in_disponibile: true,
    target_saldo: null,
  };
}

function obiettivo(user: string, importo: number, household: string | null = null) {
  return {
    id: `goal-${user}-${household ?? 'p'}`,
    user_id: user,
    household_id: household,
    nome: `Obiettivo ${user}`,
    importo_target: importo,
    modalita: 'bloccato',
    scadenza: null,
    categoria_id: null,
    ricorrente: false,
    frequenza_mesi: null,
    stato: 'aperto',
    created_at: '2026-01-01T00:00:00Z',
    accantona_da: null,
  };
}

function entrata(user: string, data: string, household: string | null = null) {
  return {
    id: `tx-${user}-${household ?? 'p'}`,
    user_id: user,
    household_id: household,
    tipo: 'income',
    importo: 100,
    data,
    categoria_id: null,
    account_id: null,
    goal_id: null,
    descrizione: 'Entrata',
    nota: null,
    created_at: `${data}T10:00:00Z`,
  };
}

function righePersonali(user: string) {
  return {
    accounts: [conto(user, 1000)],
    budget_goals: [obiettivo(user, 130)],
    transactions: [entrata(user, '2026-11-05')],
    categories: [],
  };
}

function righeDiCasa() {
  return {
    accounts: [conto('B', 5000, 'H1')],
    budget_goals: [obiettivo('B', 999, 'H1')],
    transactions: [entrata('B', '2026-11-12', 'H1')],
    categories: [],
  };
}

function unisci(...parti: Record<string, unknown[]>[]) {
  const out: Record<string, unknown[]> = {};
  for (const p of parti) for (const [k, v] of Object.entries(p)) out[k] = [...(out[k] ?? []), ...v];
  return out as Record<string, Record<string, unknown>[]>;
}

async function home(user: string, seed: Record<string, Record<string, unknown>[]>) {
  const db = createFakeDb(seed, { userId: user, membri: MEMBRI });
  return loadHomeData(db.client, TODAY);
}

describe('isolamento della home', () => {
  it('la home di A ignora conti, obiettivi ed entrate di casa', async () => {
    const conCasa = await home('A', unisci(righePersonali('A'), righeDiCasa()));
    const baseline = await home('A', righePersonali('A'));
    expect(conCasa.disponibileLibero).toBe(870);
    expect(conCasa).toEqual(baseline);
  });

  it("la data target non è spostata da un'entrata di casa", async () => {
    const conCasa = await home('A', unisci(righePersonali('A'), righeDiCasa()));
    const baseline = await home('A', righePersonali('A'));
    expect(conCasa.dataTarget).toEqual(baseline.dataTarget);
  });

  it.each(['A', 'B', 'C', 'D'])('vale per ciascuno dei tre membri e per D (%s)', async (user) => {
    const personali = righePersonali(user);
    const conCasa = await home(user, unisci(personali, righeDiCasa()));
    const baseline = await home(user, personali);
    expect(conCasa).toEqual(baseline);
    expect(conCasa.disponibileLibero).toBe(870);
  });
});
