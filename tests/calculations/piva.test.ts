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
} from '@/lib/calculations/piva';
import type { Transaction } from '@/lib/types';

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
    createdAt: '2026-01-01T00:00:00Z',
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
