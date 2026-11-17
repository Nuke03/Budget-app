import { describe, it, expect } from 'vitest';
import {
  computeFatturatoAnnuo,
  computeAliquotaSostitutiva,
  computeRedditoImponibile,
  computeImpostaSostitutiva,
  computeContributoSoggettivo,
  computeContributoIntegrativo,
  computeTotaleDaAccantonare,
  computeQuotaMensileSuggerita,
  computePercentualeIncasso,
  computeQuotaIncasso,
  computeStimaAnno,
  confrontoAnno,
  quoteInSospeso,
  totaleInSospeso,
} from '@/lib/calculations/piva';
import type { PivaAccantonamento, PivaSettings, Transaction } from '@/lib/types';

function tx(overrides: Partial<Transaction>): Transaction {
  return {
    id: 'x',
    tipo: 'income',
    importo: 0,
    data: '2026-01-01',
    categoriaId: null,
    accountId: null,
    goalId: null,
    descrizione: '',
    nota: null,
    createdAt: '2026-01-01T00:00:00Z', stima: false,
    ...overrides,
  };
}

describe('computeFatturatoAnnuo', () => {
  it('somma solo le entrate della categoria fatturato nell\'anno indicato', () => {
    const transactions = [
      tx({ tipo: 'income', categoriaId: 'cat-fatt', data: '2026-02-10', importo: 1000 }),
      tx({ tipo: 'income', categoriaId: 'cat-fatt', data: '2026-06-01', importo: 2000 }),
      tx({ tipo: 'income', categoriaId: 'cat-fatt', data: '2025-12-31', importo: 5000 }),
      tx({ tipo: 'income', categoriaId: 'cat-altro', data: '2026-03-01', importo: 999 }),
      tx({ tipo: 'expense', categoriaId: 'cat-fatt', data: '2026-03-01', importo: 50 }),
    ];

    expect(computeFatturatoAnnuo(transactions, 'cat-fatt', 2026)).toBe(3000);
  });
});

describe('computeAliquotaSostitutiva', () => {
  it('usa l\'override quando presente', () => {
    expect(computeAliquotaSostitutiva('2020-01-01', new Date('2026-06-01'), 15)).toBe(15);
  });

  it('ritorna 5 se sono passati meno di 5 anni dall\'apertura', () => {
    expect(computeAliquotaSostitutiva('2023-01-01', new Date('2026-06-01'), null)).toBe(5);
  });

  it('ritorna 15 se sono passati 5 anni o più dall\'apertura', () => {
    expect(computeAliquotaSostitutiva('2020-01-01', new Date('2026-06-01'), null)).toBe(15);
  });

  it('ritorna 15 se la data di apertura non è impostata', () => {
    expect(computeAliquotaSostitutiva(null, new Date('2026-06-01'), null)).toBe(15);
  });
});

describe('computeRedditoImponibile', () => {
  it('applica il coefficiente e deduce i contributi versati l\'anno precedente', () => {
    expect(computeRedditoImponibile(10000, 78, 500)).toBe(7300);
  });

  it('non va mai sotto zero', () => {
    expect(computeRedditoImponibile(100, 78, 500)).toBe(0);
  });
});

describe('computeImpostaSostitutiva', () => {
  it('applica l\'aliquota al reddito imponibile', () => {
    expect(computeImpostaSostitutiva(7300, 5)).toBe(365);
  });
});

describe('computeContributoSoggettivo', () => {
  it('applica l\'aliquota quando supera il minimale', () => {
    expect(computeContributoSoggettivo(10000, 10, 856)).toBe(1000);
  });

  it('usa il minimale quando il calcolo percentuale è sotto soglia', () => {
    expect(computeContributoSoggettivo(1000, 10, 856)).toBe(856);
  });
});

describe('computeContributoIntegrativo', () => {
  it('applica l\'aliquota al fatturato lordo', () => {
    expect(computeContributoIntegrativo(10000, 4)).toBe(400);
  });
});

describe('computeTotaleDaAccantonare', () => {
  it('somma imposta sostitutiva e i due contributi', () => {
    expect(computeTotaleDaAccantonare(365, 1000, 400)).toBe(1765);
  });
});

describe('computeQuotaMensileSuggerita', () => {
  it('divide il totale per i mesi rimanenti nell\'anno solare, incluso quello corrente', () => {
    // Giugno = 6 mesi rimanenti (giu, lug, ago, set, ott, nov, dic = 7 in realtà: verificare)
    expect(computeQuotaMensileSuggerita(1200, new Date('2026-01-15'))).toBe(100);
  });

  it('a dicembre resta un solo mese', () => {
    expect(computeQuotaMensileSuggerita(1200, new Date('2026-12-01'))).toBe(1200);
  });
});

describe('quota per incasso e stima dell anno', () => {
  const settings: PivaSettings = {
    id: 's',
    attivo: true,
    dataApertura: '2024-01-01',
    categoriaFatturatoId: 'cat-fatt',
    coefficienteRedditivita: 78,
    aliquotaSostitutivaOverride: 5,
    aliquotaContributoSoggettivo: 10,
    aliquotaContributoIntegrativo: 2,
    minimaleContributivoAnnuo: 856,
    contributiVersatiAnnoPrecedente: 0,
    contoTasseId: null,
    preset: 'enpap',
    guidataDal: '2026-03-01',
    stipendioMensile: null,
    stipendioRivistoIl: null,
    incassoMeseMagro: null,
  };
  const acc = (transactionId: string | null): PivaAccantonamento => ({
    id: 'a',
    transactionId,
    importo: 10,
    data: '2026-04-01',
    daAccountId: null,
    aAccountId: null,
  });

  it('percentuale ENPAP al 5%: 13.7', () => {
    expect(computePercentualeIncasso(78, 5, 10, 2)).toBe(13.7);
  });
  it('percentuale al 15%: 21.5', () => {
    expect(computePercentualeIncasso(78, 15, 10, 2)).toBe(21.5);
  });
  it('quota di 600 € al 13.7%: 82', () => {
    expect(computeQuotaIncasso(600, 13.7)).toBe(82);
  });
  it('confronto: servono 4300, messi 3100, mancano 1200', () => {
    expect(confrontoAnno(4300, 3100)).toEqual({ servono: 4300, messi: 3100, mancano: 1200 });
  });
  it('mancano mai negativo', () => {
    expect(confrontoAnno(1000, 3000).mancano).toBe(0);
  });
  it('stima anno applica il minimale 856 se il 10% è più basso', () => {
    const s = computeStimaAnno(settings, 5000, new Date('2026-06-01'));
    expect(s.soggettivo).toBe(856);
    expect(s.totale).toBeCloseTo(s.imposta + 856 + s.integrativo);
  });
  it('quoteInSospeso esclude incassi prima di guidataDal e quelli già accantonati', () => {
    const incassi = [
      tx({ id: 'vecchio', categoriaId: 'cat-fatt', data: '2026-02-01', importo: 500 }),
      tx({ id: 'fatto', categoriaId: 'cat-fatt', data: '2026-03-10', importo: 500 }),
      tx({ id: 'nuovo', categoriaId: 'cat-fatt', data: '2026-03-01', importo: 600 }),
      tx({ id: 'altra', categoriaId: 'cat-altro', data: '2026-03-10', importo: 600 }),
    ];
    const q = quoteInSospeso(incassi, [acc('fatto')], 13.7, 'cat-fatt', '2026-03-01');
    expect(q).toEqual([{ transactionId: 'nuovo', importo: 600, quota: 82 }]);
    expect(totaleInSospeso(q)).toBe(82);
  });
  it('quoteInSospeso con guidataDal null è vuota', () => {
    const incassi = [tx({ id: 'n', categoriaId: 'cat-fatt', data: '2026-03-10', importo: 600 })];
    expect(quoteInSospeso(incassi, [], 13.7, 'cat-fatt', null)).toEqual([]);
  });
});
