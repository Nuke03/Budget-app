import { describe, it, expect } from 'vitest';
import { righeVersamento, riservaDaRighe } from '@/lib/calculations/casa/versamenti';
import type { PlanBundle } from '@/lib/data/householdPlans';
import type { PlanShare, Transfer } from '@/lib/types';

const OGGI = '2026-11-15';

const quota = (slot: number, userId: string | null, quotaMensile: number, extra: Partial<PlanShare> = {}): PlanShare => ({
  planId: 'p',
  slot,
  userId,
  displayName: `U${slot}`,
  redditoNettoMensile: 1000,
  redditoIrregolare: false,
  percentuale: null,
  inCasaDal: null,
  esceDal: null,
  quotaMensile,
  ...extra,
});

const piano = (validoDal: string, shares: PlanShare[]): PlanBundle => ({
  plan: {
    id: `p-${validoDal}`,
    householdId: 'h1',
    validoDal,
    giornoVersamento: 5,
    regola: 'proporzionale',
    cuscinettoObiettivo: 0,
    cuscinettoQuotaMensile: 0,
    arrotondamento: 10,
    totaleMensile: 0,
    createdAt: '2026-10-01T00:00:00Z',
  },
  items: [],
  shares,
});

const membri = [
  { userId: 'u1', joinedAt: '2026-09-10T10:00:00Z' },
  { userId: 'u2', joinedAt: '2026-09-12T10:00:00Z' },
];

const vers = (extra: Partial<Transfer>): Transfer => ({
  id: 't',
  householdId: 'h1',
  userId: 'u2',
  daAccountId: null,
  aAccountId: null,
  importo: 0,
  data: '2026-11-05',
  causale: 'versamento',
  beneficiarioUserId: null,
  perContoDiUserId: null,
  meseCompetenza: '2026-11-01',
  soloRegistrazione: false,
  nota: null,
  createdAt: '2026-11-05T00:00:00Z',
  ...extra,
});

const base = [piano('2026-10-01', [quota(1, 'u1', 777), quota(2, 'u2', 603)])];
const run = (userId: string, transfers: Transfer[] = [], piani = base, m = membri) =>
  righeVersamento({ userId, oggi: OGGI, piani, membri: m, transfers });

describe('righeVersamento', () => {
  it('u2 con un versamento proprio di 300 per novembre', () => {
    const r = run('u2', [vers({ importo: 300 })]);
    expect(r).toEqual([
      { mese: '2026-10-01', atteso: 603, versato: 0, mancano: 603 },
      { mese: '2026-11-01', atteso: 603, versato: 300, mancano: 303 },
    ]);
    expect(riservaDaRighe(r)).toBe(906);
  });

  it('u1 con 777 per ottobre e per novembre non ha arretrati', () => {
    const r = run('u1', [
      vers({ userId: 'u1', importo: 777, meseCompetenza: '2026-10-01' }),
      vers({ userId: 'u1', importo: 777 }),
    ]);
    expect(riservaDaRighe(r)).toBe(0);
  });

  it('un versamento per conto di chiude l arretrato di u2', () => {
    const t = vers({ userId: 'u1', perContoDiUserId: 'u2', importo: 603, meseCompetenza: '2026-10-01' });
    expect(run('u2', [t])[0]).toMatchObject({ mese: '2026-10-01', versato: 603, mancano: 0 });
    expect(run('u1', [t])[0]).toMatchObject({ mese: '2026-10-01', versato: 0, mancano: 777 });
  });

  it('un versamento di restituzione non conta come quota', () => {
    const t = vers({ userId: 'u2', beneficiarioUserId: 'u1', importo: 603, meseCompetenza: '2026-10-01' });
    expect(run('u2', [t])[0]).toMatchObject({ versato: 0, mancano: 603 });
  });

  it('un segnaposto senza utente rende il piano non attivo: nessuna riga', () => {
    const p = [piano('2026-10-01', [quota(1, 'u1', 777), quota(2, null, 603)])];
    expect(run('u1', [], p)).toEqual([]);
  });

  it('una posizione a 0% ha righe con atteso 0', () => {
    const p = [piano('2026-10-01', [quota(1, 'u1', 777), quota(2, 'u2', 603), quota(3, 'u3', 0)])];
    const m = [...membri, { userId: 'u3', joinedAt: '2026-09-15T10:00:00Z' }];
    expect(run('u3', [], p, m).map((x) => [x.mese, x.atteso, x.mancano])).toEqual([
      ['2026-10-01', 0, 0],
      ['2026-11-01', 0, 0],
    ]);
  });

  it('inCasaDal nel mese successivo toglie le righe prima', () => {
    const p = [piano('2026-10-01', [quota(1, 'u1', 777), quota(2, 'u2', 603, { inCasaDal: '2026-11-01' })])];
    expect(run('u2', [], p).map((r) => r.mese)).toEqual(['2026-11-01']);
  });

  it('esceDal 2026-11-01 toglie novembre e lascia ottobre', () => {
    const p = [piano('2026-10-01', [quota(1, 'u1', 777), quota(2, 'u2', 603, { esceDal: '2026-11-01' })])];
    expect(run('u2', [], p).map((r) => r.mese)).toEqual(['2026-10-01']);
  });

  it('chi entra a novembre ha solo novembre e l ottobre dell altro non conta', () => {
    const m = [membri[0], { userId: 'u2', joinedAt: '2026-11-03T10:00:00Z' }];
    expect(run('u1', [], base, m).map((r) => r.mese)).toEqual(['2026-11-01']);
    expect(run('u2', [], base, m).map((r) => r.mese)).toEqual(['2026-11-01']);
  });

  it('una versione di piano cambiata a metà storia usa la quota giusta per mese', () => {
    const p = [
      piano('2026-10-01', [quota(1, 'u1', 777), quota(2, 'u2', 603)]),
      piano('2026-11-01', [quota(1, 'u1', 700), quota(2, 'u2', 680)]),
    ];
    expect(run('u2', [], p).map((r) => r.atteso)).toEqual([603, 680]);
  });

  it('solo registrazione chiude la riserva', () => {
    const t = vers({ importo: 603, meseCompetenza: '2026-10-01', soloRegistrazione: true });
    expect(run('u2', [t])[0]).toMatchObject({ versato: 603, mancano: 0 });
  });

  it('senza piani non ci sono righe', () => {
    expect(run('u1', [], [])).toEqual([]);
  });
});
