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
const piano = (shares: PlanShare[]) => ({ shares }) as unknown as PlanBundle;

describe('uscentiDaPiani', () => {
  it('ignora chi ha esceDal nullo e usa la riga più recente', () => {
    const r = uscentiDaPiani([
      piano([share({}), share({ slot: 2, displayName: 'Giulia', quotaMensile: 603, esceDal: '2026-12-01' })]),
      piano([share({}), share({ slot: 2, displayName: 'Giulia', quotaMensile: 0, esceDal: '2026-12-01' })]),
      piano([share({ slot: 3, displayName: 'Marco', esceDal: '2027-01-01' }), share({ slot: 3, displayName: 'Marco', esceDal: null })]),
    ]);
    expect(r).toEqual([
      {
        slot: 2,
        displayName: 'Giulia',
        redditoNettoMensile: 1800,
        redditoIrregolare: false,
        inCasaDal: null,
        esceDal: '2026-12-01',
        quotaMensile: 0,
      },
    ]);
  });
});
