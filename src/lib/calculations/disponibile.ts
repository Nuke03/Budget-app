import { computeAccantonatoFinora } from './accantonato';
import type { AccountBalance, GoalForCalc } from './types';

export function computeDisponibileLibero(
  accounts: AccountBalance[],
  goals: GoalForCalc[],
  today: Date,
  riservaVersamento = 0,
  riservaDebiti = 0
): number {
  const saldoDisponibile = accounts
    .filter((a) => a.contaInDisponibile)
    .reduce((sum, a) => sum + a.saldoAttuale, 0);

  const riservato = goals
    .filter((g) => g.stato === 'aperto')
    .reduce((sum, g) => sum + computeAccantonatoFinora(g, today, g.specoCollegato ?? 0), 0);

  // Il versamento alla casa e i debiti verso gli altri membri sono già "usati": si tolgono come gli obiettivi.
  return saldoDisponibile - riservato - riservaVersamento - riservaDebiti;
}
