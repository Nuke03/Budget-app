import { describe, it, expect } from 'vitest';
import { deltaPerModifica } from '@/lib/calculations/accountBalance';

describe('deltaPerModifica', () => {
  it('una spesa da 10 a 15 sullo stesso conto dà delta -5', () => {
    expect(
      deltaPerModifica(
        { accountId: 'a', tipo: 'expense', importo: 10 },
        { accountId: 'a', tipo: 'expense', importo: 15 }
      )
    ).toEqual([{ accountId: 'a', delta: -5 }]);
  });

  it('cambio conto sposta +10 sul vecchio e -15 sul nuovo', () => {
    expect(
      deltaPerModifica(
        { accountId: 'a', tipo: 'expense', importo: 10 },
        { accountId: 'b', tipo: 'expense', importo: 15 }
      )
    ).toEqual([
      { accountId: 'a', delta: 10 },
      { accountId: 'b', delta: -15 },
    ]);
  });

  it('senza variazione non produce voci e ignora i conti nulli', () => {
    expect(
      deltaPerModifica(
        { accountId: 'a', tipo: 'income', importo: 10 },
        { accountId: 'a', tipo: 'income', importo: 10 }
      )
    ).toEqual([]);
    expect(
      deltaPerModifica(
        { accountId: null, tipo: 'expense', importo: 10 },
        { accountId: 'a', tipo: 'income', importo: 4 }
      )
    ).toEqual([{ accountId: 'a', delta: 4 }]);
  });
});
