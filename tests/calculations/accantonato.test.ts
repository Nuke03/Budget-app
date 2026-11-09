import { describe, it, expect, beforeAll } from 'vitest';
import { format } from 'date-fns';
import {
  computeAccantonatoFinora,
  computeQuotaMensile,
  computeFinestraGoal,
  nextOccurrence,
} from '@/lib/calculations/accantonato';
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

  it('sottrae la spesa collegata dal riservato per un obiettivo bloccato (es. gita)', () => {
    const goal: GoalForCalc = {
      importoTarget: 400,
      modalita: 'bloccato',
      stato: 'aperto',
      scadenza: null,
      createdAt: '2026-01-01',
      ricorrente: false,
      frequenzaMesi: null,
    };

    expect(computeAccantonatoFinora(goal, new Date(2026, 5, 1), 50)).toBe(350);
  });

  it('non va mai sotto zero anche se la spesa collegata supera il riservato', () => {
    const goal: GoalForCalc = {
      importoTarget: 400,
      modalita: 'bloccato',
      stato: 'aperto',
      scadenza: null,
      createdAt: '2026-01-01',
      ricorrente: false,
      frequenzaMesi: null,
    };

    expect(computeAccantonatoFinora(goal, new Date(2026, 5, 1), 450)).toBe(0);
  });

  it('sottrae la spesa collegata anche per un obiettivo dilazionato', () => {
    const goal: GoalForCalc = {
      importoTarget: 300,
      modalita: 'dilazionato',
      stato: 'aperto',
      scadenza: '2026-11-27',
      createdAt: '2026-01-27',
      ricorrente: false,
      frequenzaMesi: null,
    };

    // teorico a metà finestra = 150 (vedi test sopra), meno 100 già pagati => 50
    expect(computeAccantonatoFinora(goal, new Date(2026, 5, 27), 100)).toBeCloseTo(50, 5);
  });
});

describe('computeFinestraGoal', () => {
  it('per un bloccato non ricorrente la finestra resta aperta da quando è stato creato', () => {
    const goal: GoalForCalc = {
      importoTarget: 400,
      modalita: 'bloccato',
      stato: 'aperto',
      scadenza: null,
      createdAt: '2026-01-15',
      ricorrente: false,
      frequenzaMesi: null,
    };

    expect(computeFinestraGoal(goal, new Date(2026, 5, 1))).toEqual({
      windowStart: new Date(2026, 0, 15),
      windowEnd: null,
    });
  });

  it('per un bloccato ricorrente con scadenza usa il ciclo corrente', () => {
    const goal: GoalForCalc = {
      importoTarget: 9.99,
      modalita: 'bloccato',
      stato: 'aperto',
      scadenza: '2026-01-01',
      createdAt: '2026-01-01',
      ricorrente: true,
      frequenzaMesi: 1,
    };

    expect(computeFinestraGoal(goal, new Date(2026, 5, 10))).toEqual({
      windowStart: new Date(2026, 5, 1),
      windowEnd: new Date(2026, 6, 1),
    });
  });

  it('per un bloccato ricorrente SENZA scadenza non lancia un errore: resta aperto da sempre', () => {
    const goal: GoalForCalc = {
      importoTarget: 9.99,
      modalita: 'bloccato',
      stato: 'aperto',
      scadenza: null,
      createdAt: '2026-01-01',
      ricorrente: true,
      frequenzaMesi: 1,
    };

    expect(computeFinestraGoal(goal, new Date(2026, 5, 10))).toEqual({
      windowStart: new Date(2026, 0, 1),
      windowEnd: null,
    });
  });

  it('per un dilazionato senza scadenza lancia comunque un errore (non può fare a meno del calcolo temporale)', () => {
    const goal: GoalForCalc = {
      importoTarget: 100,
      modalita: 'dilazionato',
      stato: 'aperto',
      scadenza: null,
      createdAt: '2026-01-01',
      ricorrente: false,
      frequenzaMesi: null,
    };

    expect(() => computeFinestraGoal(goal, new Date(2026, 5, 1))).toThrow();
  });
});

describe('computeQuotaMensile', () => {
  it('per un obiettivo bloccato non ricorrente non c\'è una quota mensile (è un versamento unico)', () => {
    const goal: GoalForCalc = {
      importoTarget: 500,
      modalita: 'bloccato',
      stato: 'aperto',
      scadenza: null,
      createdAt: '2026-01-01',
      ricorrente: false,
      frequenzaMesi: null,
    };

    expect(computeQuotaMensile(goal, new Date(2026, 5, 1))).toBeNull();
  });

  it('per un obiettivo bloccato ricorrente la quota è l\'intero importo ad ogni ricorrenza', () => {
    const goal: GoalForCalc = {
      importoTarget: 9.99,
      modalita: 'bloccato',
      stato: 'aperto',
      scadenza: '2026-01-01',
      createdAt: '2026-01-01',
      ricorrente: true,
      frequenzaMesi: 1,
    };

    expect(computeQuotaMensile(goal, new Date(2026, 5, 1))).toBe(9.99);
  });

  it('per un obiettivo dilazionato non ricorrente la quota è l\'importo diviso i mesi della finestra', () => {
    const goal: GoalForCalc = {
      importoTarget: 300,
      modalita: 'dilazionato',
      scadenza: '2026-11-27',
      stato: 'aperto',
      createdAt: '2026-01-27',
      ricorrente: false,
      frequenzaMesi: null,
    };

    // 10 mesi totali (gen->nov) => 300/10 = 30
    expect(computeQuotaMensile(goal, new Date(2026, 5, 27))).toBeCloseTo(30, 5);
  });

  it('per un obiettivo dilazionato ricorrente la quota usa la finestra del ciclo corrente', () => {
    const goal: GoalForCalc = {
      importoTarget: 160,
      modalita: 'dilazionato',
      scadenza: '2025-07-01',
      stato: 'aperto',
      createdAt: '2024-07-01',
      ricorrente: true,
      frequenzaMesi: 12,
    };

    expect(computeQuotaMensile(goal, new Date(2026, 5, 1))).toBeCloseTo(160 / 12, 5);
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

    expect(() => computeQuotaMensile(goal, new Date(2026, 5, 1))).toThrow();
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

// Il test di regressione TZ sopra lascia il processo in un altro fuso: le prove
// che seguono ragionano in giorni locali, quindi fissano il fuso di Roma.
const fissaFusoRoma = () => beforeAll(() => { process.env.TZ = 'Europe/Rome'; });

describe('valori di oggi per obiettivi personali (senza accantonaDa)', () => {
  fissaFusoRoma();
  const base = { stato: 'aperto' as const, createdAt: '2026-01-01' };
  const tari: GoalForCalc = { ...base, importoTarget: 300, modalita: 'dilazionato', ricorrente: true, frequenzaMesi: 12, scadenza: '2027-03-31' };
  const trimestrale: GoalForCalc = { ...base, importoTarget: 120, modalita: 'dilazionato', ricorrente: true, frequenzaMesi: 3, scadenza: '2026-02-15' };
  const singolo: GoalForCalc = { ...base, importoTarget: 500, modalita: 'dilazionato', ricorrente: false, frequenzaMesi: null, scadenza: '2027-01-20' };
  const mensile: GoalForCalc = { ...base, importoTarget: 90, modalita: 'bloccato', ricorrente: true, frequenzaMesi: 1, scadenza: '2026-11-20' };
  const unico: GoalForCalc = { ...base, importoTarget: 60, modalita: 'bloccato', ricorrente: false, frequenzaMesi: null, scadenza: null };

  it.each([
    [tari, new Date(2026, 10, 9), 200, 25],
    [tari, new Date(2026, 11, 20), 225, 25],
    [tari, new Date(2027, 0, 15), 250, 25],
    [tari, new Date(2027, 3, 1), 25, 25],
    [trimestrale, new Date(2026, 10, 9), 120, 40],
    [trimestrale, new Date(2026, 11, 20), 40, 40],
    [trimestrale, new Date(2027, 0, 15), 80, 40],
    [trimestrale, new Date(2027, 3, 1), 80, 40],
    [singolo, new Date(2026, 10, 9), 416.66666666666663, 41.666666666666664],
    [singolo, new Date(2027, 0, 15), 500, 41.666666666666664],
    [mensile, new Date(2026, 11, 20), 90, 90],
    [unico, new Date(2027, 3, 1), 60, null],
  ])('accantonato e quota invariati (%#)', (goal, today, atteso, quota) => {
    expect(computeAccantonatoFinora(goal, today)).toBeCloseTo(atteso, 9);
    const q = computeQuotaMensile(goal, today);
    if (quota === null) expect(q).toBeNull();
    else expect(q).toBeCloseTo(quota, 9);
  });

  it('con speso collegato 10 sottrae 10 dal teorico', () => {
    expect(computeAccantonatoFinora(tari, new Date(2026, 10, 9), 10)).toBe(190);
    expect(computeAccantonatoFinora(mensile, new Date(2026, 10, 9), 10)).toBe(80);
  });
});

describe('accantonaDa', () => {
  fissaFusoRoma();
  const tari: GoalForCalc = {
    importoTarget: 300,
    modalita: 'dilazionato',
    stato: 'aperto',
    scadenza: '2027-03-31',
    createdAt: '2026-01-01',
    ricorrente: true,
    frequenzaMesi: 12,
  };

  it('con accantonaDa nullo i risultati sono quelli di oggi', () => {
    expect(computeAccantonatoFinora({ ...tari, accantonaDa: null }, new Date(2026, 10, 9))).toBe(200);
  });

  it('con accantonaDa a metà ciclo i mesi si contano da lì', () => {
    const g = { ...tari, accantonaDa: '2026-11-09' };
    expect(computeAccantonatoFinora(g, new Date(2026, 10, 9))).toBe(0);
    expect(computeAccantonatoFinora(g, new Date(2027, 0, 15))).toBe(50);
    expect(computeAccantonatoFinora(g, new Date(2027, 2, 31))).toBe(100);
  });

  it('dopo la prima scadenza il ciclo è completo', () => {
    const g = { ...tari, accantonaDa: '2026-11-09' };
    expect(computeAccantonatoFinora(g, new Date(2027, 3, 1))).toBe(25);
  });

  it('un accantonaDa nel futuro non dà mai negativo', () => {
    const g = { ...tari, accantonaDa: '2027-02-01' };
    expect(computeAccantonatoFinora(g, new Date(2026, 10, 9))).toBe(0);
  });

  it('quota mensile invariata', () => {
    expect(computeQuotaMensile({ ...tari, accantonaDa: '2026-11-09' }, new Date(2026, 10, 9))).toBe(25);
  });
});

describe('scadenze a fine mese', () => {
  fissaFusoRoma();
  it('freq 3 from 2026-11-30 expects 2027-05-31', () => {
    expect(format(nextOccurrence(new Date(2026, 10, 30), 3, new Date(2027, 1, 1)), 'yyyy-MM-dd')).toBe('2027-02-28');
    expect(format(nextOccurrence(new Date(2026, 10, 30), 3, new Date(2027, 2, 2)), 'yyyy-MM-dd')).toBe('2027-05-31');
  });

  it('la finestra parte dal fine mese precedente', () => {
    const g: GoalForCalc = {
      importoTarget: 90, modalita: 'dilazionato', stato: 'aperto', scadenza: '2026-11-30',
      createdAt: '2026-01-01', ricorrente: true, frequenzaMesi: 3,
    };
    const w = computeFinestraGoal(g, new Date(2027, 4, 1));
    expect(format(w.windowStart, 'yyyy-MM-dd')).toBe('2027-02-28');
    expect(format(w.windowEnd!, 'yyyy-MM-dd')).toBe('2027-05-31');
  });

  it('una scadenza che non è a fine mese non cambia', () => {
    expect(format(nextOccurrence(new Date(2026, 0, 28), 1, new Date(2026, 2, 1)), 'yyyy-MM-dd')).toBe('2026-03-28');
    expect(format(nextOccurrence(new Date(2026, 0, 30), 1, new Date(2026, 2, 1)), 'yyyy-MM-dd')).toBe('2026-03-28');
  });
});
