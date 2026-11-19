import { describe, it, expect } from 'vitest';
import { anniScadenzeHome } from '@/lib/pivaHome';

describe('P2: anni di scadenze letti dalla Home', () => {
  it('fino al 15 dicembre solo l anno corrente', () => {
    expect(anniScadenzeHome('2026-11-19')).toEqual([2026]);
    expect(anniScadenzeHome('2026-12-15')).toEqual([2026]);
  });
  it('dopo il 15 dicembre anche l anno dopo', () => {
    expect(anniScadenzeHome('2026-12-16')).toEqual([2026, 2027]);
    expect(anniScadenzeHome('2026-12-31')).toEqual([2026, 2027]);
  });
  it('a gennaio di nuovo uno solo', () => {
    expect(anniScadenzeHome('2027-01-03')).toEqual([2027]);
  });
});
