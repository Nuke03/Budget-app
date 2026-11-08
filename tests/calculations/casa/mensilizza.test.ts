import { describe, it, expect } from 'vitest';
import { mensilizza, totaleVociMensili, isVoceDaParte } from '@/lib/calculations/casa/mensilizza';

describe('mensilizza', () => {
  it('TARI 300 su 12 fa 25', () => {
    expect(mensilizza(300, 12)).toBe(25);
  });
  it('luce 110 su 2 fa 55', () => {
    expect(mensilizza(110, 2)).toBe(55);
  });
  it('equivalenza: importoMensile per frequenza dà la ricorrenza', () => {
    expect(mensilizza(96, 12) * 12).toBeCloseTo(96, 10);
    expect(mensilizza(60, 3) * 3).toBeCloseTo(60, 10);
  });
  it('lancia con frequenza 0', () => {
    expect(() => mensilizza(100, 0)).toThrow();
  });
  it('isVoceDaParte è vera solo oltre 1', () => {
    expect(isVoceDaParte(1)).toBe(false);
    expect(isVoceDaParte(2)).toBe(true);
    expect(isVoceDaParte(12)).toBe(true);
  });
  it('totaleVociMensili somma i mensili', () => {
    expect(
      totaleVociMensili([
        { importoRicorrenza: 750, frequenzaMesi: 1 },
        { importoRicorrenza: 110, frequenzaMesi: 2 },
        { importoRicorrenza: 300, frequenzaMesi: 12 },
      ]),
    ).toBe(830);
  });
});
