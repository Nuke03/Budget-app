import { describe, it, expect } from 'vitest';
import { computeNuovoSaldoConto } from '@/lib/calculations/accountBalance';

describe('computeNuovoSaldoConto', () => {
  it('sottrae una spesa dal saldo attuale', () => {
    expect(computeNuovoSaldoConto(500, 'expense', 26)).toBe(474);
  });

  it('somma un entrata al saldo attuale', () => {
    expect(computeNuovoSaldoConto(500, 'income', 100)).toBe(600);
  });
});
