import { computeAccantonatoFinora } from './accantonato';
import type { AccountBalance, GoalForCalc } from './types';

export function computeDisponibileLibero(
  accounts: AccountBalance[],
  goals: GoalForCalc[],
  today: Date
): number {
  const saldoDisponibile = accounts
    .filter((a) => a.contaInDisponibile)
    .reduce((sum, a) => sum + a.saldoAttuale, 0);

  const riservato = goals
    .filter((g) => g.stato === 'aperto')
    .reduce((sum, g) => sum + computeAccantonatoFinora(g, today, g.specoCollegato ?? 0), 0);

  return saldoDisponibile - riservato;
}
