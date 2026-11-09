import { describe, it, expect } from 'vitest';
import { format } from 'date-fns';
import { oggiRomaISO, meseRomaISO, oggiRomaData } from '@/lib/calculations/casa/oggi';

describe('oggi', () => {
  it('31 ottobre 23:30 UTC è già 1 novembre in Italia', () => {
    const d = new Date('2026-10-31T23:30:00Z');
    expect(oggiRomaISO(d)).toBe('2026-11-01');
    expect(meseRomaISO(d)).toBe('2026-11-01');
  });
  it("in estate l'offset è +2", () => {
    expect(oggiRomaISO(new Date('2026-06-30T22:30:00Z'))).toBe('2026-07-01');
  });
  it('a metà giornata resta lo stesso giorno', () => {
    expect(oggiRomaISO(new Date('2026-11-08T10:00:00Z'))).toBe('2026-11-08');
    expect(meseRomaISO(new Date('2026-11-08T10:00:00Z'))).toBe('2026-11-01');
  });
  it('oggiRomaData a cavallo della mezzanotte italiana', () => {
    expect(format(oggiRomaData(new Date('2026-10-31T23:30:00Z')), 'yyyy-MM-dd')).toBe('2026-11-01');
  });
});
