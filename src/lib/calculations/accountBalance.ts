import type { TransactionTipo } from '../types';

export function computeNuovoSaldoConto(
  saldoAttuale: number,
  tipo: TransactionTipo,
  importo: number
): number {
  return tipo === 'income' ? saldoAttuale + importo : saldoAttuale - importo;
}
