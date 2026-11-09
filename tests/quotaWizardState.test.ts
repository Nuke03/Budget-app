import { describe, it, expect } from 'vitest';
import { uscentiDaPiani } from '@/app/casa/quota/quotaWizardState';
import type { PlanBundle } from '@/lib/data/householdPlans';
import type { PlanShare } from '@/lib/types';

const share = (over: Partial<PlanShare>): PlanShare => ({
  planId: 'p1',
  slot: 1,
  userId: 'u1',
  displayName: 'Fabio',
  redditoNettoMensile: 1800,
  redditoIrregolare: false,
  percentuale: null,
  inCasaDal: null,
  esceDal: null,
  quotaMensile: 777,
  ...over,
});
const piano = (validoDal: string, shares: PlanShare[]) =>
  ({ plan: { validoDal }, shares }) as unknown as PlanBundle;

describe('uscentiDaPiani', () => {
  it('ignora chi ha esceDal nullo e usa la riga più recente', () => {
    const r = uscentiDaPiani([
      piano('2026-12-01', [share({}), share({ slot: 2, displayName: 'Giulia', quotaMensile: 603, esceDal: '2027-02-01' })]),
      piano('2027-02-01', [share({}), share({ slot: 2, displayName: 'Giulia', quotaMensile: 0, esceDal: '2027-02-01' })]),
      piano('2027-03-01', [share({ slot: 3, displayName: 'Marco', esceDal: '2027-04-01' }), share({ slot: 3, displayName: 'Marco', esceDal: null })]),
    ]);
    expect(r).toHaveLength(1);
    // la quota è l'ultima di una versione precedente all'uscita, non lo 0 della riga più recente
    expect(r[0]).toMatchObject({ slot: 2, displayName: 'Giulia', esceDal: '2027-02-01', quotaMensile: 603 });
  });
});
