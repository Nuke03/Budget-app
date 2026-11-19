import { describe, it, expect } from 'vitest';
import { accantonatoAllaPrimaScadenza, fineDelMese } from '@/lib/calculations/percorso/primiPassiFondi';

describe('accantonatoAllaPrimaScadenza', () => {
  it('fondo creato a metà ciclo: alla prima scadenza ci sono solo i mesi già passati', () => {
    // 600 € ogni 12 mesi, scadenza 31/03/2027, si parte il 19/11/2026: 4 mesi su 12.
    expect(
      accantonatoAllaPrimaScadenza({ importo: 600, frequenzaMesi: 12, scadenza: '2027-03-31', oggi: '2026-11-19' })
    ).toBeCloseTo(200, 2);
  });

  it('con un ciclo intero davanti il fondo è completo', () => {
    expect(
      accantonatoAllaPrimaScadenza({ importo: 600, frequenzaMesi: 12, scadenza: fineDelMese('2027-11'), oggi: '2026-11-19' })
    ).toBeCloseTo(600, 2);
  });

  it('frequenza di 6 mesi, scadenza fra 2 mesi: un terzo', () => {
    expect(
      accantonatoAllaPrimaScadenza({ importo: 300, frequenzaMesi: 6, scadenza: '2027-01-31', oggi: '2026-11-19' })
    ).toBeCloseTo(100, 2);
  });

  it('scadenza nel mese in corso: ancora niente', () => {
    expect(
      accantonatoAllaPrimaScadenza({ importo: 600, frequenzaMesi: 12, scadenza: '2026-11-30', oggi: '2026-11-19' })
    ).toBe(0);
  });
});
