import { describe, it, expect } from 'vitest';
import { riservaPersonale } from '@/lib/calculations/casa/riservoVersamento';
import { righeVersamento } from '@/lib/calculations/casa/versamenti';
import { debitiMembri } from '@/lib/calculations/casa/debitiMembri';
import { computeDisponibileLibero } from '@/lib/calculations/disponibile';
import type { PlanBundle } from '@/lib/data/householdPlans';
import type { PlanShare, Transfer } from '@/lib/types';
import type { AccountBalance } from '@/lib/calculations/types';

const OGGI = '2026-11-15';
const TODAY = new Date('2026-11-15T12:00:00Z');

const quota = (slot: number, userId: string, quotaMensile: number): PlanShare => ({
  planId: 'p',
  slot,
  userId,
  displayName: userId,
  redditoNettoMensile: 1000,
  redditoIrregolare: false,
  percentuale: null,
  inCasaDal: null,
  esceDal: null,
  quotaMensile,
});

const piani: PlanBundle[] = [
  {
    plan: {
      id: 'p1',
      householdId: 'h1',
      validoDal: '2026-11-01',
      giornoVersamento: 5,
      regola: 'proporzionale',
      cuscinettoObiettivo: 0,
      cuscinettoQuotaMensile: 0,
      arrotondamento: 10,
      totaleMensile: 1380,
      createdAt: '2026-10-01T00:00:00Z',
    },
    items: [],
    shares: [quota(1, 'anna', 603), quota(2, 'bruno', 777)],
  },
];
const membri = [
  { userId: 'anna', joinedAt: '2026-09-10T10:00:00Z' },
  { userId: 'bruno', joinedAt: '2026-09-12T10:00:00Z' },
];

const vers = (extra: Partial<Transfer>): Transfer => ({
  id: `t${Math.random()}`,
  householdId: 'h1',
  userId: 'bruno',
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

const conto = (saldo: number): AccountBalance[] => [{ saldoAttuale: saldo, contaInDisponibile: true }];

function disponibile(userId: string, saldo: number, transfers: Transfer[]): number {
  const righe = righeVersamento({ userId, oggi: OGGI, piani, membri, transfers });
  const { riservaVersamento, riservaDebiti } = riservaPersonale({ righe, userId, debiti: debitiMembri(transfers) });
  return computeDisponibileLibero(conto(saldo), [], TODAY, riservaVersamento, riservaDebiti);
}

describe('riservaPersonale', () => {
  it('nessun doppio conteggio: registrare il versamento di 777 abbassa il saldo di 777 e la riserva di 777, il disponibile resta 223', () => {
    expect(disponibile('bruno', 1000, [])).toBe(223);
    expect(disponibile('bruno', 1000 - 777, [vers({ importo: 777 })])).toBe(223);
  });

  it('registrare un versamento per conto di Anna lascia invariato il disponibile di Anna (riserva -603, debito +603)', () => {
    const prima = riservaPersonale({
      righe: righeVersamento({ userId: 'anna', oggi: OGGI, piani, membri, transfers: [] }),
      userId: 'anna',
      debiti: [],
    });
    const t = [vers({ importo: 603, perContoDiUserId: 'anna' })];
    const dopo = riservaPersonale({
      righe: righeVersamento({ userId: 'anna', oggi: OGGI, piani, membri, transfers: t }),
      userId: 'anna',
      debiti: debitiMembri(t),
    });
    expect(prima).toEqual({ riservaVersamento: 603, riservaDebiti: 0 });
    expect(dopo).toEqual({ riservaVersamento: 0, riservaDebiti: 603 });
    expect(disponibile('anna', 2000, [])).toBe(disponibile('anna', 2000, t));
  });

  it('restituire 200 abbassa conto e debito di 200: disponibile invariato', () => {
    const prestito = vers({ importo: 603, perContoDiUserId: 'anna' });
    const resto = vers({ causale: 'restituzione', importo: 200, userId: 'anna', beneficiarioUserId: 'bruno', meseCompetenza: null });
    expect(disponibile('anna', 2000, [prestito])).toBe(disponibile('anna', 1800, [prestito, resto]));
  });

  it('il debito conta solo per il debitore, non per il creditore', () => {
    const t = [vers({ importo: 603, perContoDiUserId: 'anna' })];
    expect(riservaPersonale({ righe: [], userId: 'bruno', debiti: debitiMembri(t) }).riservaDebiti).toBe(0);
  });
});
