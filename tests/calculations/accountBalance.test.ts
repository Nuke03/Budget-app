import { describe, it, expect } from 'vitest';
import {
  computeNuovoSaldoConto,
  computeSaldoSenzaTransazione,
  computeAggiornamentiSaldoPerModifica,
  deltaPerModifica,
} from '@/lib/calculations/accountBalance';

describe('computeNuovoSaldoConto', () => {
  it('sottrae una spesa dal saldo attuale', () => {
    expect(computeNuovoSaldoConto(500, 'expense', 26)).toBe(474);
  });

  it('somma un entrata al saldo attuale', () => {
    expect(computeNuovoSaldoConto(500, 'income', 100)).toBe(600);
  });
});

describe('computeSaldoSenzaTransazione', () => {
  it('inverte l\'effetto di una spesa (la riaggiunge al saldo)', () => {
    expect(computeSaldoSenzaTransazione(474, 'expense', 26)).toBe(500);
  });

  it('inverte l\'effetto di un\'entrata (la sottrae dal saldo)', () => {
    expect(computeSaldoSenzaTransazione(600, 'income', 100)).toBe(500);
  });
});

describe('computeAggiornamentiSaldoPerModifica', () => {
  const accounts = [
    { id: 'acc-1', saldoAttuale: 500 },
    { id: 'acc-2', saldoAttuale: 200 },
  ];

  it('aggiorna un solo conto quando la transazione resta sullo stesso conto', () => {
    const result = computeAggiornamentiSaldoPerModifica(
      accounts,
      { accountId: 'acc-1', tipo: 'expense', importo: 26 },
      { accountId: 'acc-1', tipo: 'expense', importo: 40 }
    );

    // riaggiunge 26 (500->526) poi sottrae 40 (526->486)
    expect(result).toEqual([{ accountId: 'acc-1', nuovoSaldo: 486 }]);
  });

  it('aggiorna entrambi i conti quando la transazione cambia conto', () => {
    const result = computeAggiornamentiSaldoPerModifica(
      accounts,
      { accountId: 'acc-1', tipo: 'expense', importo: 26 },
      { accountId: 'acc-2', tipo: 'expense', importo: 40 }
    );

    expect(result).toEqual(
      expect.arrayContaining([
        { accountId: 'acc-1', nuovoSaldo: 526 },
        { accountId: 'acc-2', nuovoSaldo: 160 },
      ])
    );
    expect(result).toHaveLength(2);
  });

  it('non genera aggiornamenti se la transazione non aveva né ha un conto', () => {
    const result = computeAggiornamentiSaldoPerModifica(
      accounts,
      { accountId: null, tipo: 'expense', importo: 26 },
      { accountId: null, tipo: 'expense', importo: 40 }
    );

    expect(result).toEqual([]);
  });
});

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
