import { describe, it, expect } from 'vitest';
import { computeMargineGiornaliero } from '@/lib/calculations/margine';

describe('computeMargineGiornaliero', () => {
  it('divide il disponibile per i giorni rimanenti', () => {
    const result = computeMargineGiornaliero(1000, new Date(2026, 5, 11), new Date(2026, 5, 1));
    expect(result).toBe(100);
  });

  it('usa almeno 1 giorno quando la data target è oggi o nel passato', () => {
    const today = new Date(2026, 5, 1);
    expect(computeMargineGiornaliero(500, today, today)).toBe(500);
    expect(computeMargineGiornaliero(500, new Date(2026, 4, 20), today)).toBe(500);
  });
});
