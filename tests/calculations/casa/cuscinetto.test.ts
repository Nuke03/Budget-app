import { describe, it, expect } from 'vitest';
import { cuscinettoDefault, mesiAlPieno } from '@/lib/calculations/casa/cuscinetto';

describe('cuscinetto', () => {
  it('default: 5% di 1321 arrotondato fa 66 e obiettivo 1321', () => {
    expect(cuscinettoDefault(1321)).toEqual({ obiettivo: 1321, quotaMensile: 66 });
  });
  it("con 2 mesi l'obiettivo è 2642", () => {
    expect(cuscinettoDefault(1321, 2).obiettivo).toBe(2642);
  });
  it('mesiAlPieno(1321, 59) fa 23', () => {
    expect(mesiAlPieno(1321, 59)).toBe(23);
  });
  it('mesiAlPieno con quota 0 è null', () => {
    expect(mesiAlPieno(1321, 0)).toBeNull();
  });
});
