import { describe, it, expect } from 'vitest';
import { fraseRata, fraseRientro } from '@/lib/calculations/rientriTesti';
import type { Rientro } from '@/lib/calculations/rientri';
import { PAROLE_VIETATE } from '../helpers/paroleVietate';

const rientro = (over: Partial<Rientro> = {}): Rientro => ({
  id: 'r1', userId: 'u', householdId: null, goalId: 'g1', accountId: null,
  importo: 300, mesi: 3, creatoIl: '2026-11-20', stato: 'aperto', fermatoIl: null, ...over,
});

describe('fraseRata', () => {
  it("mette l'anno quando il rientro attraversa il capodanno", () => {
    expect(fraseRata(300, 3, '2026-11-20')).toBe('100 € al mese, da novembre 2026 a gennaio 2027.');
  });
  it('senza anno nello stesso anno, con "ad" davanti ad aprile', () => {
    expect(fraseRata(100, 2, '2027-03-01')).toBe('50 € al mese, da marzo ad aprile.');
  });
  it('"a" davanti alle consonanti', () => {
    expect(fraseRata(300, 3, '2027-01-10')).toBe('100 € al mese, da gennaio a marzo.');
  });
});

describe('fraseRientro', () => {
  it('rata e ultimo mese', () => {
    expect(fraseRientro(rientro())).toBe('Rientro: 100 € al mese fino a gennaio');
  });
  it('un rientro fermato non promette niente', () => {
    expect(fraseRientro(rientro({ stato: 'fermato', fermatoIl: '2026-12-01' }))).toBe('Rientro fermato');
  });
  it('niente parole vietate', () => {
    const testo = [fraseRata(300, 3, '2026-11-20'), fraseRientro(rientro())].join(' ').toLowerCase();
    for (const p of [...PAROLE_VIETATE, 'autorata', 'debito', 'rimborso', 'devi', 'dovresti']) expect(testo).not.toContain(p);
  });
});
