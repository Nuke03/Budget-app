import { describe, it, expect } from 'vitest';
import { computeDisponibileLibero } from '@/lib/calculations/disponibile';
import type { AccountBalance, GoalForCalc } from '@/lib/calculations/types';

describe('computeDisponibileLibero', () => {
  it('somma solo i conti che contano nel disponibile', () => {
    const accounts: AccountBalance[] = [
      { saldoAttuale: 1000, contaInDisponibile: true },
      { saldoAttuale: 5000, contaInDisponibile: false }, // fondo emergenza, escluso
    ];

    expect(computeDisponibileLibero(accounts, [], new Date(2026, 5, 1))).toBe(1000);
  });

  it('sottrae gli obiettivi bloccati aperti per intero', () => {
    const accounts: AccountBalance[] = [{ saldoAttuale: 1000, contaInDisponibile: true }];
    const goals: GoalForCalc[] = [
      {
        importoTarget: 130,
        modalita: 'bloccato',
        stato: 'aperto',
        scadenza: null,
        createdAt: '2026-01-01',
        ricorrente: false,
        frequenzaMesi: null,
      },
    ];

    expect(computeDisponibileLibero(accounts, goals, new Date(2026, 5, 1))).toBe(870);
  });

  it('ignora gli obiettivi non aperti', () => {
    const accounts: AccountBalance[] = [{ saldoAttuale: 1000, contaInDisponibile: true }];
    const goals: GoalForCalc[] = [
      {
        importoTarget: 130,
        modalita: 'bloccato',
        stato: 'chiuso',
        scadenza: null,
        createdAt: '2026-01-01',
        ricorrente: false,
        frequenzaMesi: null,
      },
    ];

    expect(computeDisponibileLibero(accounts, goals, new Date(2026, 5, 1))).toBe(1000);
  });

  it('combina più conti e più obiettivi di modalità diverse', () => {
    const accounts: AccountBalance[] = [
      { saldoAttuale: 600, contaInDisponibile: true },
      { saldoAttuale: 400, contaInDisponibile: true },
    ];
    const goals: GoalForCalc[] = [
      {
        importoTarget: 130,
        modalita: 'bloccato',
        stato: 'aperto',
        scadenza: null,
        createdAt: '2026-01-01',
        ricorrente: false,
        frequenzaMesi: null,
      },
      {
        importoTarget: 300,
        modalita: 'dilazionato',
        stato: 'aperto',
        scadenza: '2026-11-27',
        createdAt: '2026-01-27',
        ricorrente: false,
        frequenzaMesi: null,
      },
    ];

    // saldo: 1000, bloccato: -130, dilazionato al 2026-06-27: -150 (metà di 300)
    expect(computeDisponibileLibero(accounts, goals, new Date(2026, 5, 27))).toBeCloseTo(
      720,
      5
    );
  });
});
