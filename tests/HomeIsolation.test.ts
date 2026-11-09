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

async function home(user: string, seed: Record<string, Record<string, unknown>[]>, conUserId = false) {
  const db = createFakeDb(seed, { userId: user, membri: MEMBRI });
  return loadHomeData(db.client, TODAY, conUserId ? user : null);
}

const STRUTTURA_CASA = {
  households: [{ id: 'H1', nome: 'Casa', created_at: '2026-01-01T00:00:00Z', archiviata_il: null }],
  household_members: [
    { household_id: 'H1', user_id: 'A', display_name: 'Anna', joined_at: '2026-01-01T00:00:00Z', slot: 1, attivo: true },
    { household_id: 'H1', user_id: 'B', display_name: 'Bruno', joined_at: '2026-01-01T00:00:00Z', slot: 2, attivo: true },
  ],
  household_invites: [],
};

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

  it('con userId e una casa, disponibile, dettaglio, margine e data target restano quelli personali e casa contiene solo righe di casa', async () => {
    const baseline = await home('A', righePersonali('A'));
    const conCasa = await home('A', { ...unisci(righePersonali('A'), righeDiCasa()), ...STRUTTURA_CASA }, true);
    const { casa, ...personali } = conCasa;
    const { casa: nessuna, ...baselinePersonali } = baseline;
    expect(nessuna).toBeNull();
    expect(personali).toEqual(baselinePersonali);
    expect(personali.disponibileLibero).toBe(870);
    expect(casa?.aggiunta.householdId).toBe('H1');
    expect(casa?.aggiunta.conti.map((c) => c.id)).toEqual(['acc-B-H1']);
    expect(casa?.aggiunta.obiettivi.map((g) => g.id)).toEqual(['goal-B-H1']);
    expect(casa?.stato.riservaVersamento).toBe(0);
  });

  it('un membro con piano attivo ha disponibile = base meno riserva e un non membro resta alla base', async () => {
    const piano = {
      household_plans: [
        { id: 'p1', household_id: 'H1', valido_dal: '2026-11-01', giorno_versamento: 5, regola: 'parti_uguali',
          cuscinetto_obiettivo: 0, cuscinetto_quota_mensile: 0, arrotondamento: 10, totale_mensile: 1000, created_at: '2026-01-01T00:00:00Z' },
      ],
      household_plan_items: [],
      household_plan_shares: [
        { plan_id: 'p1', slot: 1, user_id: 'A', display_name: 'Anna', reddito_netto_mensile: 1000, reddito_irregolare: false,
          percentuale: null, in_casa_dal: null, esce_dal: null, quota_mensile: 500 },
        { plan_id: 'p1', slot: 2, user_id: 'B', display_name: 'Bruno', reddito_netto_mensile: 1000, reddito_irregolare: false,
          percentuale: null, in_casa_dal: null, esce_dal: null, quota_mensile: 500 },
      ],
    };
    const seed = { ...unisci(righePersonali('A'), righeDiCasa()), ...STRUTTURA_CASA, ...piano };
    const membro = await home('A', seed, true);
    expect(membro.disponibileLibero).toBe(870 - 500);
    expect(membro.casa?.stato.riservaVersamento).toBe(500);
    const nonMembro = await home('D', { ...unisci(righePersonali('D'), righeDiCasa()), ...STRUTTURA_CASA, ...piano }, true);
    expect(nonMembro.disponibileLibero).toBe(870);
    expect(nonMembro.casa).toBeNull();
  });

  it('senza userId o senza casa attiva casa è null', async () => {
    expect((await home('A', righePersonali('A'))).casa).toBeNull();
    const senzaCasa = { ...righePersonali('A'), households: [], household_members: [], household_invites: [] };
    expect((await home('A', senzaCasa, true)).casa).toBeNull();
  });

  it('se la lettura della casa fallisce la home personale si apre e casa è null', async () => {
    const seed = { ...righePersonali('A'), ...STRUTTURA_CASA };
    const db = createFakeDb(seed, { userId: 'A', membri: MEMBRI });
    const from = db.client.from;
    db.client.from = (nome: string) => {
      if (nome === 'households' || nome === 'household_members') throw new Error('giù');
      return from(nome);
    };
    const dati = await loadHomeData(db.client, TODAY, 'A');
    expect(dati.casa).toBeNull();
    expect(dati.disponibileLibero).toBe(870);
  });

  it('se solo il caricamento dei conti di casa fallisce casa è null', async () => {
    const seed = { ...unisci(righePersonali('A'), righeDiCasa()), ...STRUTTURA_CASA };
    const db = createFakeDb(seed, { userId: 'A', membri: MEMBRI });
    const from = db.client.from;
    db.client.from = (nome: string) => {
      const b = from(nome);
      if (nome === 'accounts') {
        const eq = b.eq;
        b.eq = (c: string, v: unknown) => {
          if (c === 'household_id') throw new Error('giù');
          return eq(c, v);
        };
      }
      return b;
    };
    const dati = await loadHomeData(db.client, TODAY, 'A');
    expect(dati.casa).toBeNull();
    expect(dati.disponibileLibero).toBe(870);
  });
});
