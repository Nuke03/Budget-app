import { describe, it, expect } from 'vitest';
import {
  scadenzeDaCreare,
  prossimaScadenza,
  confrontoScadenza,
  confrontoCumulativo,
  eIlPrimoAnno,
} from '@/lib/calculations/pivaScadenze';
import type { PivaScadenza } from '@/lib/types';

const riga = (over: Partial<PivaScadenza>): PivaScadenza => ({
  id: 'x',
  anno: 2026,
  chiave: 'f24_novembre',
  tipo: 'f24',
  descrizione: 'd',
  data: '2026-11-30',
  importo: null,
  pagataIl: null,
  transactionId: null,
  nascosta: false,
  ...over,
});

describe('scadenzeDaCreare', () => {
  it("attivata il 17 novembre: solo f24_novembre per quest'anno", () => {
    const r = scadenzeDaCreare(2026, '2026-11-17');
    expect(r.map((s) => s.chiave)).toEqual(['f24_novembre']);
    expect(r[0]).toMatchObject({
      anno: 2026,
      tipo: 'f24',
      data: '2026-11-30',
      descrizione: 'F24 di novembre: secondo acconto',
    });
  });

  it('anno successivo: 4 scadenze con date e descrizioni dei vincoli', () => {
    const r = scadenzeDaCreare(2027, '2026-11-17');
    expect(r.map((s) => [s.chiave, s.tipo, s.data])).toEqual([
      ['cassa_acconto', 'cassa', '2027-03-01'],
      ['f24_giugno', 'f24', '2027-06-30'],
      ['cassa_saldo', 'cassa', '2027-10-01'],
      ['f24_novembre', 'f24', '2027-11-30'],
    ]);
    expect(r.map((s) => s.descrizione)).toEqual([
      'ENPAP: acconto',
      "F24 di giugno: saldo dell'anno prima e primo acconto",
      'ENPAP: saldo',
      'F24 di novembre: secondo acconto',
    ]);
  });

  it('anni prima della guida: nessuna scadenza', () => {
    expect(scadenzeDaCreare(2025, '2026-11-17')).toEqual([]);
  });

  it('il giorno stesso della scadenza conta ancora', () => {
    expect(scadenzeDaCreare(2026, '2026-11-30').map((s) => s.chiave)).toEqual(['f24_novembre']);
  });
});

describe('prossimaScadenza', () => {
  it('salta pagate e nascoste e quelle passate', () => {
    const s = [
      riga({ id: 'a', data: '2026-11-10' }),
      riga({ id: 'b', data: '2026-11-20', pagataIl: '2026-11-18' }),
      riga({ id: 'c', data: '2026-11-25', nascosta: true }),
      riga({ id: 'd', data: '2026-11-30' }),
      riga({ id: 'e', data: '2027-03-01' }),
    ];
    expect(prossimaScadenza(s, '2026-11-17')?.id).toBe('d');
  });

  it('nessuna: null', () => {
    expect(prossimaScadenza([], '2026-11-17')).toBeNull();
  });
});

describe('confrontoScadenza', () => {
  it('3100 su 3400: mancano 300', () => {
    expect(confrontoScadenza(3100, 3400)).toEqual({ basta: false, mancano: 300 });
  });
  it('basta: nessun mancante', () => {
    expect(confrontoScadenza(3400, 3400)).toEqual({ basta: true, mancano: 0 });
    expect(confrontoScadenza(4000, 3400)).toEqual({ basta: true, mancano: 0 });
  });
});

describe('eIlPrimoAnno', () => {
  it("solo nell'anno di guidataDal", () => {
    expect(eIlPrimoAnno('2026-11-17', 2026)).toBe(true);
    expect(eIlPrimoAnno('2026-11-17', 2027)).toBe(false);
  });
});

describe('confrontoCumulativo', () => {
  const vaso = 3100;
  const a = riga({ id: 'a', data: '2026-10-01', importo: 480 });
  const b = riga({ id: 'b', data: '2026-11-30', importo: 3400 });

  it('la prima scadenza si confronta da sola', () => {
    expect(confrontoCumulativo(vaso, [b, a], 'a')).toEqual({ basta: true, mancano: 0, totale: 480, conPrecedenti: false });
  });

  it('la seconda somma la prima: 480 poi 3.400 con 3.100 nel vaso, mancano 780', () => {
    expect(confrontoCumulativo(vaso, [b, a], 'b')).toEqual({ basta: false, mancano: 780, totale: 3880, conPrecedenti: true });
  });

  it('ignora le scadenze pagate, tolte o senza cifra', () => {
    const pagata = riga({ id: 'p', data: '2026-03-01', importo: 750, pagataIl: '2026-02-27' });
    const tolta = riga({ id: 't', data: '2026-04-01', importo: 100, nascosta: true });
    const senza = riga({ id: 's', data: '2026-06-30', importo: null });
    expect(confrontoCumulativo(vaso, [pagata, tolta, senza, a, b], 'b')?.totale).toBe(3880);
    expect(confrontoCumulativo(vaso, [pagata, tolta, senza, a, b], 'p')).toBeNull();
  });
});
