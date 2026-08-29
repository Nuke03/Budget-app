import { describe, it, expect } from 'vitest';
import { formatEuro, formatDateIt } from '@/lib/format';

describe('formatEuro', () => {
  it('formats a positive amount as Italian euros', () => {
    expect(formatEuro(1234.5)).toBe('1.234,50 €');
  });

  it('formats zero', () => {
    expect(formatEuro(0)).toBe('0,00 €');
  });

  it('formats negative amounts with a leading minus', () => {
    expect(formatEuro(-42)).toBe('-42,00 €');
  });
});

describe('formatDateIt', () => {
  it('formats a Date as gg/mm/aaaa', () => {
    expect(formatDateIt(new Date(2026, 10, 27))).toBe('27/11/2026');
  });

  it('formats an ISO date string', () => {
    expect(formatDateIt('2026-01-05')).toBe('05/01/2026');
  });
});
