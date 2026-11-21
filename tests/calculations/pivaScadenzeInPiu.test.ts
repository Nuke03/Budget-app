import { describe, it, expect } from 'vitest';
import { pezzoInPiuScadenza } from '@/lib/calculations/pivaScadenze';
import type { PivaScadenza } from '@/lib/types';

const riga = (over: Partial<PivaScadenza>): PivaScadenza => ({
  id: 'x',
  anno: 2027,
  chiave: 'cassa_acconto',
  tipo: 'f24',
  descrizione: 'd',
  data: '2027-01-16',
  importo: 1000,
  pagataIl: null,
  transactionId: null,
  nascosta: false,
  ...over,
});

const OGGI = '2026-11-21';
const base = {
  saldoVaso: 450,
  inSospeso: 0,
  quotaBase: 250,
  importo: 1000,
  incassiMensili: [1000, 1000, 1000],
  oggi: OGGI,
};

describe('pezzoInPiuScadenza', () => {
  const sc = riga({ id: 'a' });

  it('caso base: mancano 300 in 3 mesi -> 100', () => {
    expect(pezzoInPiuScadenza({ ...base, scadenze: [sc] })).toEqual({ importo: 100, scadenza: sc });
  });

  it('tetto: metà incasso meno quota', () => {
    const s = riga({ id: 'a', importo: 3450 });
    const r = pezzoInPiuScadenza({ ...base, scadenze: [riga({ id: 'a', data: '2026-11-30', importo: 3450 })] });
    expect(r?.importo).toBe(250);
    expect(s).toBeTruthy();
  });

  it('senza media: tutto fino al tetto', () => {
    expect(pezzoInPiuScadenza({ ...base, incassiMensili: [], scadenze: [sc] })?.importo).toBe(250);
    const s100 = riga({ id: 'b', importo: 800 });
    expect(pezzoInPiuScadenza({ ...base, incassiMensili: [], scadenze: [s100] })?.importo).toBe(100);
  });

  it('vaso sufficiente o quota base alta -> null', () => {
    expect(pezzoInPiuScadenza({ ...base, saldoVaso: 800, scadenze: [sc] })).toBeNull();
    expect(pezzoInPiuScadenza({ ...base, quotaBase: 600, scadenze: [sc] })).toBeNull();
  });

  it('ignora pagate, nascoste, senza cifra, passate', () => {
    const r = pezzoInPiuScadenza({
      ...base,
      scadenze: [
        riga({ id: 'p', pagataIl: '2026-11-01' }),
        riga({ id: 'n', nascosta: true }),
        riga({ id: 'c', importo: null }),
        riga({ id: 'o', data: '2026-11-01' }),
      ],
    });
    expect(r).toBeNull();
  });

  it('due scadenze: restituisce quella di gennaio', () => {
    const dic = riga({ id: 'd', data: '2026-12-10', importo: 500 });
    const gen = riga({ id: 'g', data: '2027-01-16', importo: 1000 });
    const r = pezzoInPiuScadenza({ ...base, saldoVaso: 1000, inSospeso: 0, quotaBase: 250, scadenze: [gen, dic] });
    expect(r?.scadenza.id).toBe('g');
  });
});
