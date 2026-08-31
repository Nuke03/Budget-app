import { describe, it, expect } from 'vitest';
import { computeAccantonatoFinora, nextOccurrence } from '@/lib/calculations/accantonato';
import type { GoalForCalc } from '@/lib/calculations/types';

describe('computeAccantonatoFinora', () => {
  it('riserva subito l\'intero importo per un obiettivo bloccato', () => {
    const goal: GoalForCalc = {
      importoTarget: 130,
      modalita: 'bloccato',
      stato: 'aperto',
      scadenza: null,
      createdAt: '2026-01-01',
      ricorrente: false,
      frequenzaMesi: null,
    };

    expect(computeAccantonatoFinora(goal, new Date(2026, 0, 2))).toBe(130);
  });

  it('accantona in modo lineare un obiettivo dilazionato non ricorrente', () => {
    const goal: GoalForCalc = {
      importoTarget: 300,
      modalita: 'dilazionato',
      stato: 'aperto',
      scadenza: '2026-11-27',
      createdAt: '2026-01-27',
      ricorrente: false,
      frequenzaMesi: null,
    };

    // 10 mesi totali (gen->nov), 5 mesi trascorsi (gen->giu) => metà dell'importo
    expect(computeAccantonatoFinora(goal, new Date(2026, 5, 27))).toBeCloseTo(150, 5);
  });

  it('non supera mai l\'importo target anche a scadenza passata', () => {
    const goal: GoalForCalc = {
      importoTarget: 300,
      modalita: 'dilazionato',
      scadenza: '2026-11-27',
      stato: 'aperto',
      createdAt: '2026-01-27',
      ricorrente: false,
      frequenzaMesi: null,
    };

    expect(computeAccantonatoFinora(goal, new Date(2027, 5, 27))).toBeCloseTo(300, 5);
  });

  it('per un obiettivo ricorrente ricalcola la finestra sul ciclo corrente', () => {
    const goal: GoalForCalc = {
      importoTarget: 160,
      modalita: 'dilazionato',
      scadenza: '2025-07-01',
      stato: 'aperto',
      createdAt: '2024-07-01',
      ricorrente: true,
      frequenzaMesi: 12,
    };

    // prossima occorrenza: 2026-07-01, finestra 2025-07-01 -> 2026-07-01 (12 mesi)
    // oggi 2026-06-01: 11 mesi trascorsi su 12 => 160 * 11/12
    expect(computeAccantonatoFinora(goal, new Date(2026, 5, 1))).toBeCloseTo((160 * 11) / 12, 5);
  });

  it('lancia un errore se un obiettivo dilazionato non ha scadenza', () => {
    const goal: GoalForCalc = {
      importoTarget: 100,
      modalita: 'dilazionato',
      scadenza: null,
      stato: 'aperto',
      createdAt: '2026-01-01',
      ricorrente: false,
      frequenzaMesi: null,
    };

    expect(() => computeAccantonatoFinora(goal, new Date(2026, 5, 1))).toThrow();
  });

  it('lancia un errore se un obiettivo ricorrente ha frequenzaMesi pari a 0', () => {
    const goal: GoalForCalc = {
      importoTarget: 160,
      modalita: 'dilazionato',
      scadenza: '2025-07-01',
      stato: 'aperto',
      createdAt: '2024-07-01',
      ricorrente: true,
      frequenzaMesi: 0,
    };

    expect(() => computeAccantonatoFinora(goal, new Date(2026, 5, 1))).toThrow();
  });

  it('lancia un errore (senza andare in loop infinito) se frequenzaMesi è negativa', () => {
    const goal: GoalForCalc = {
      importoTarget: 160,
      modalita: 'dilazionato',
      scadenza: '2025-07-01',
      stato: 'aperto',
      createdAt: '2024-07-01',
      ricorrente: true,
      frequenzaMesi: -1,
    };

    expect(() => computeAccantonatoFinora(goal, new Date(2026, 5, 1))).toThrow();
  });

  it('il calcolo per un obiettivo ricorrente è indipendente dal timezone del processo (regressione TZ)', () => {
    const goal: GoalForCalc = {
      importoTarget: 160,
      modalita: 'dilazionato',
      scadenza: '2025-07-01',
      stato: 'aperto',
      createdAt: '2024-07-01',
      ricorrente: true,
      frequenzaMesi: 12,
    };

    const originalTz = process.env.TZ;
    try {
      // In un fuso orario dietro UTC (es. America/Los_Angeles, UTC-7/-8),
      // 'new Date("2025-07-01")' (mezzanotte UTC) renderizzerebbe come
      // il giorno locale precedente, spostando il mese di calendario.
      // parseISO deve invece interpretare la stringa come mezzanotte locale.
      process.env.TZ = 'America/Los_Angeles';
      expect(computeAccantonatoFinora(goal, new Date(2026, 5, 1))).toBeCloseTo(
        (160 * 11) / 12,
        5
      );
    } finally {
      if (originalTz === undefined) {
        delete process.env.TZ;
      } else {
        process.env.TZ = originalTz;
      }
    }
  });
});

describe('nextOccurrence', () => {
  it('non muove la data se è già nel futuro', () => {
    const result = nextOccurrence(new Date(2027, 0, 1), 1, new Date(2026, 5, 1));
    expect(result).toEqual(new Date(2027, 0, 1));
  });

  it('avanza di frequenzaMesi finché la data non è nel futuro', () => {
    const result = nextOccurrence(new Date(2024, 6, 1), 12, new Date(2026, 5, 1));
    expect(result).toEqual(new Date(2026, 6, 1));
  });
});
