import { startOfMonth, endOfMonth, subMonths, parseISO } from 'date-fns';
import type { Transaction } from '../types';

export type Periodo = 'mese' | '3mesi' | '6mesi' | 'anno' | 'personalizzato';

export function filterTransactionsByPeriodo(
  transactions: Transaction[],
  periodo: Periodo,
  oggi: Date,
  rangePersonalizzato?: { da: string; a: string } | null
): Transaction[] {
  let from: Date;
  let to: Date;

  switch (periodo) {
    case 'mese':
      from = startOfMonth(oggi);
      to = endOfMonth(oggi);
      break;
    case '3mesi':
      from = subMonths(oggi, 3);
      to = oggi;
      break;
    case '6mesi':
      from = subMonths(oggi, 6);
      to = oggi;
      break;
    case 'anno':
      from = subMonths(oggi, 12);
      to = oggi;
      break;
    case 'personalizzato':
      if (!rangePersonalizzato || !rangePersonalizzato.da || !rangePersonalizzato.a) {
        return transactions;
      }
      from = parseISO(rangePersonalizzato.da);
      to = parseISO(rangePersonalizzato.a);
      break;
  }

  return transactions.filter((t) => {
    const data = parseISO(t.data);
    return data >= from && data <= to;
  });
}
