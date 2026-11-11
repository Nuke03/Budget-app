import { startOfMonth, endOfMonth, subMonths, parseISO, format } from 'date-fns';

export type Periodo = 'mese' | '3mesi' | '6mesi' | 'anno' | 'personalizzato';

export function filterTransactionsByPeriodo<T extends { data: string }>(
  transactions: T[],
  periodo: Periodo,
  oggi: Date,
  rangePersonalizzato?: { da: string; a: string } | null
): T[] {
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

// Il primo giorno letto dallo storico: copre il periodo fisso più lungo ('anno', 12 mesi indietro).
export function inizioStorico(oggi: Date): string {
  return format(startOfMonth(subMonths(oggi, 12)), 'yyyy-MM-dd');
}
