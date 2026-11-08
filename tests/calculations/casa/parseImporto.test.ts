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
  it('zero è valido', () => {
    expect(parseImporto('0')).toBe(0);
    expect(parseImporto(' 0,0 ')).toBe(0);
  });
});
