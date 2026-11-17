import { describe, it, expect } from 'vitest';
import { formatEuro, formatDateIt, formatDataLunga, formatNumero } from '@/lib/format';

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

describe('formatDataLunga', () => {
  it('scrive giorno, mese in lettere e anno', () => {
    expect(formatDataLunga('2027-04-16')).toBe('16 aprile 2027');
    expect(formatDataLunga(new Date(2026, 0, 5))).toBe('5 gennaio 2026');
  });
});

describe('formatNumero', () => {
  it('formatNumero(1321) è "1.321"', () => {
    expect(formatNumero(1321)).toBe('1.321');
  });
  it('formatNumero(1380.5) è "1.380,5"', () => {
    expect(formatNumero(1380.5)).toBe('1.380,5');
  });
  it('formatNumero(59) è "59"', () => {
    expect(formatNumero(59)).toBe('59');
  });
});
