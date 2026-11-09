import { describe, it, expect } from 'vitest';
import { parseImporto } from '@/lib/calculations/casa/parseImporto';

describe('parseImporto', () => {
  it('accetta la virgola', () => {
    expect(parseImporto('1800,5')).toBe(1800.5);
  });
  it('accetta il punto', () => {
    expect(parseImporto('1800.5')).toBe(1800.5);
    expect(parseImporto('750')).toBe(750);
  });
  it('vuoto, spazi e testo danno null', () => {
    expect(parseImporto('')).toBeNull();
    expect(parseImporto('   ')).toBeNull();
    expect(parseImporto('abc')).toBeNull();
    expect(parseImporto('12abc')).toBeNull();
    expect(parseImporto('1,2,3')).toBeNull();
  });
  it('i negativi danno null', () => {
    expect(parseImporto('-5')).toBeNull();
    expect(parseImporto('-0,5')).toBeNull();
  });
  it('le migliaia all italiana', () => {
    expect(parseImporto('1.020')).toBe(1020);
    expect(parseImporto('1.020,50')).toBe(1020.5);
    expect(parseImporto('12.500')).toBe(12500);
    expect(parseImporto('1,5')).toBe(1.5);
    expect(parseImporto('1.5')).toBe(1.5);
    expect(parseImporto('10.25')).toBe(10.25);
    expect(parseImporto('1.02,5.3')).toBeNull();
  });
  it('zero è valido', () => {
    expect(parseImporto('0')).toBe(0);
    expect(parseImporto(' 0,0 ')).toBe(0);
  });
});
