import { accantonatoObiettivo } from './accantonato';
import type { AccountBalance, GoalForCalc } from './types';

// Quanto gli obiettivi aperti hanno messo da parte finora.
export function riservatoObiettivi(goals: GoalForCalc[], today: Date): number {
  return goals
    .filter((g) => g.stato === 'aperto')
    .reduce((sum, g) => sum + accantonatoObiettivo(g, today), 0);
}

export function computeDisponibileLibero(
  accounts: AccountBalance[],
  goals: GoalForCalc[],
  today: Date,
  riservaVersamento = 0,
  riservaDebiti = 0,
  // Le quote delle tasse degli incassi non ancora spostate sul conto tasse.
  riservaPiva = 0,
  // Le somme che i rientri chiedono di spostare sui conti risparmio, non ancora spostate.
  riservaRientri = 0
): number {
  const saldoDisponibile = accounts
    .filter((a) => a.contaInDisponibile)
    .reduce((sum, a) => sum + a.saldoAttuale, 0);

  const riservato = riservatoObiettivi(goals, today);

  // Il versamento alla casa e i debiti verso gli altri membri sono già "usati": si tolgono come gli obiettivi.
  // Anche le quote delle tasse ancora sul conto sono già "usate".
  return saldoDisponibile - riservato - riservaVersamento - riservaDebiti - riservaPiva - riservaRientri;
}
