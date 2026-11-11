import { describe, it, expect } from 'vitest';
import { loadCasaStato } from '@/lib/loadCasaStato';
import type { CasaCorrente } from '@/lib/data/households';
import type { HouseholdMember } from '@/lib/types';
import { createFakeDb } from './helpers/fakeDb';

const T0 = '2026-01-01T00:00:00Z';
const NOW = new Date('2026-11-15T12:00:00Z');

const membro = (userId: string, nome: string, slot: number): HouseholdMember => ({
  householdId: 'H1', userId, displayName: nome, joinedAt: T0, slot, attivo: true,
});
const A = membro('A', 'Anna', 1);
const B = membro('B', 'Bruno', 2);
const C = membro('C', 'Carla', 3);

const casaDi = (me: HouseholdMember, members: HouseholdMember[]): CasaCorrente => ({
  household: { id: 'H1', nome: 'Casa', createdAt: T0, archiviataIl: null },
  members,
  invite: null,
  me,
});

const piano = (validoDal: string) => ({
  id: 'p1', household_id: 'H1', valido_dal: validoDal, giorno_versamento: 5, regola: 'parti_uguali',
  cuscinetto_obiettivo: 0, cuscinetto_quota_mensile: 0, arrotondamento: 10, totale_mensile: 1380, created_at: T0,
});
const quota = (slot: number, user: string | null, q: number) => ({
  plan_id: 'p1', slot, user_id: user, display_name: `U${slot}`, reddito_netto_mensile: 1000,
  reddito_irregolare: false, percentuale: null, in_casa_dal: null, esce_dal: null, quota_mensile: q,
});
const versamento = (id: string, user: string, importo: number, mese: string, extra: object = {}) => ({
  id, household_id: 'H1', user_id: user, da_account_id: null, a_account_id: null, importo,
  data: '2026-11-05', causale: 'versamento', beneficiario_user_id: null, per_conto_di_user_id: null,
  mese_competenza: mese, solo_registrazione: false, nota: null, created_at: '2026-11-05T10:00:00Z', ...extra,
});

function stato(
  me: HouseholdMember,
  seed: Record<string, Record<string, unknown>[]>,
  opts: { now?: Date; members?: HouseholdMember[]; membri?: string[] } = {}
) {
  const members = opts.members ?? [A, B];
  const db = createFakeDb(
    { household_plan_items: [], transactions: [], transfers: [], ...seed },
    { userId: me.userId, membri: { H1: opts.membri ?? members.map((m) => m.userId) } }
  );
  return loadCasaStato(db.client, casaDi(me, members), opts.now ?? NOW);
}

describe('loadCasaStato', () => {
  it('senza piano la riserva è 0', async () => {
    const s = await stato(B, { household_plans: [], household_plan_shares: [] });
    expect(s.riservaVersamento).toBe(0);
    expect(s.piano).toBeNull();
    expect(s.righe).toEqual([]);
    expect(s.avvisoArretrati).toBe(false);
  });

  it('con piano in bozza (una posizione senza utente) la riserva è 0', async () => {
    const s = await stato(B, {
      household_plans: [piano('2026-10-01')],
      household_plan_shares: [quota(1, 'A', 600), quota(2, null, 777)],
    });
    expect(s.righe).toEqual([]);
    expect(s.riservaVersamento).toBe(0);
    expect(s.piano?.plan.id).toBe('p1');
  });

  it('a mezzanotte italiana: now 2026-10-31T23:30:00Z conta novembre', async () => {
    const seed = {
      household_plans: [piano('2026-10-01')],
      household_plan_shares: [quota(1, 'A', 603), quota(2, 'B', 777)],
    };
    const s = await stato(B, seed, { now: new Date('2026-10-31T23:30:00Z') });
    expect(s.righe.map((r) => r.mese)).toEqual(['2026-10-01', '2026-11-01']);
    expect(s.riservaVersamento).toBe(1554);
    // Le righe di tutta la casa: una per ogni membro e mese.
    expect(s.righeCasa).toHaveLength(4);
    const prima = await stato(B, seed, { now: new Date('2026-10-31T21:30:00Z') });
    expect(prima.riservaVersamento).toBe(777);
  });

  it('avvisoArretrati dopo più di 2 mesi', async () => {
    const seed = (dal: string) => ({
      household_plans: [piano(dal)],
      household_plan_shares: [quota(1, 'A', 100), quota(2, 'B', 100)],
    });
    expect((await stato(B, seed('2026-09-01'))).avvisoArretrati).toBe(true);
    expect((await stato(B, seed('2026-10-01'))).avvisoArretrati).toBe(false);
  });

  it('tre membri: i debiti sono per coppia e il debitore somma tutti i creditori', async () => {
    const seed = {
      household_plans: [piano('2026-11-01')],
      household_plan_shares: [quota(1, 'A', 500), quota(2, 'B', 300), quota(3, 'C', 200)],
      transfers: [
        versamento('v1', 'A', 200, '2026-11-01', { per_conto_di_user_id: 'C' }),
        versamento('v2', 'B', 100, '2026-11-01', { per_conto_di_user_id: 'C' }),
      ],
    };
    const c = await stato(C, seed, { members: [A, B, C] });
    expect(c.debiti.map((d) => [d.creditoreId, d.debitoreId, d.importo]).sort()).toEqual([
      ['A', 'C', 200],
      ['B', 'C', 100],
    ]);
    expect(c.debitoDaRestituire).toBe(300);
    expect(c.riservaVersamento).toBe(0);
    const a = await stato(A, seed, { members: [A, B, C] });
    expect(a.debitoDaRestituire).toBe(0);
  });

  it('un membro fuori dalla casa non vede nulla della riserva di un altro', async () => {
    const seed = {
      household_plans: [piano('2026-11-01')],
      household_plan_shares: [quota(1, 'A', 500), quota(2, 'B', 300)],
      transfers: [versamento('v1', 'A', 200, '2026-11-01', { per_conto_di_user_id: 'B' })],
    };
    const fuori = membro('Z', 'Zeno', 9);
    // Non è tra i membri attivi: nessuna riga sua, nessun debito suo.
    const s = await stato(fuori, seed, { members: [A, B], membri: ['A', 'B'] });
    expect(s.righe).toEqual([]);
    expect(s.riservaVersamento).toBe(0);
    expect(s.debitoDaRestituire).toBe(0);
    // Senza accesso ai registri della casa (RLS) non legge nemmeno i movimenti degli altri.
    const cieco = await stato(fuori, seed, { members: [A, B], membri: [] });
    expect(cieco.debiti).toEqual([]);
    expect(cieco.riservaVersamento).toBe(0);
  });
});

describe('loadCasaStato controlli', () => {
  it('espone controlli e fa una sola lettura per tabella', async () => {
    const db = createFakeDb(
      {
        household_plan_items: [], transactions: [], transfers: [], household_plans: [], household_plan_shares: [],
        balance_checks: [{ id: 'b1', household_id: 'H1', data: '2026-11-05' }],
        household_checkins: [{ id: 'c1', household_id: 'H1', mese: '2026-10-01' }],
      },
      { userId: 'B', membri: { H1: ['A', 'B'] } }
    );
    const letture: string[] = [];
    const from = db.client.from.bind(db.client);
    db.client.from = (nome: string) => {
      letture.push(nome);
      return from(nome);
    };
    const s = await loadCasaStato(db.client, casaDi(B, [A, B]), NOW);
    expect(s.controlli).toEqual({ ultimoControllo: '2026-11-05', ultimoCheckinMese: '2026-10-01' });
    expect(letture.filter((t) => t === 'balance_checks')).toHaveLength(1);
    expect(letture.filter((t) => t === 'household_checkins')).toHaveLength(1);
  });
});
