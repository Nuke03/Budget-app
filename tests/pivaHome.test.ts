import { describe, it, expect } from 'vitest';
import { casaDelMese, finestraIncassi, inizioLetturaIncassi, speseUltimiMesi } from '@/lib/pivaHome';
import type { Transaction } from '@/lib/types';

const tx = (over: Partial<Transaction>): Transaction => ({
  id: 'x', tipo: 'expense', importo: 10, data: '2026-10-05', categoriaId: null, accountId: 'a1', goalId: null,
  descrizione: 'x', nota: null, createdAt: '2026-10-05T10:00:00Z', stima: false, ...over,
});

describe('pivaHome', () => {
  it('finestraIncassi toglie i mesi vuoti iniziali', () => {
    const incassi = [
      tx({ id: 'a', tipo: 'income', categoriaId: 'f', importo: 1000, data: '2026-08-10' }),
      tx({ id: 'b', tipo: 'income', categoriaId: 'f', importo: 500, data: '2026-10-10' }),
    ];
    // finestra di 6 mesi: mag giu lug, poi ago set ott: parte da agosto
    expect(finestraIncassi(incassi, 'f', '2026-11-17')).toEqual({ incassiMensili: [1000, 0, 500], mesiConIncassi: 3 });
  });

  it('finestraIncassi senza incassi: finestra vuota', () => {
    expect(finestraIncassi([], 'f', '2026-11-17')).toEqual({ incassiMensili: [], mesiConIncassi: 0 });
  });

  it('inizioLetturaIncassi prende il più vecchio fra guida e 6 mesi fa', () => {
    expect(inizioLetturaIncassi('2026-08-01', '2026-11-17')).toBe('2026-05-01');
    expect(inizioLetturaIncassi('2026-03-01', '2026-11-17')).toBe('2026-03-01');
  });

  it('speseUltimiMesi: 3 mesi interi, solo conti del disponibile, senza obiettivi', () => {
    const t = [
      tx({ importo: 100, data: '2026-09-02' }),
      tx({ importo: 300, data: '2026-10-02' }),
      tx({ importo: 50, data: '2026-10-03', goalId: 'g' }),
      tx({ importo: 70, data: '2026-10-03', accountId: 'altro' }),
      tx({ importo: 999, data: '2026-11-03' }),
    ];
    expect(speseUltimiMesi(t, new Set(['a1']), '2026-11-17')).toEqual([100, 300]);
  });

  it('casaDelMese legge la riga del mese in corso, 0 senza casa', () => {
    const righe = [
      { mese: '2026-10-01', atteso: 500, versato: 500, mancano: 0 },
      { mese: '2026-11-01', atteso: 500, versato: 200, mancano: 300 },
    ];
    expect(casaDelMese(righe, '2026-11-17')).toEqual({ quotaCasaMensile: 500, versatoCasaMese: 200 });
    expect(casaDelMese(null, '2026-11-17')).toEqual({ quotaCasaMensile: 0, versatoCasaMese: 0 });
    expect(casaDelMese([], '2026-11-17')).toEqual({ quotaCasaMensile: 0, versatoCasaMese: 0 });
  });
});
