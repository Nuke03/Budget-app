import { differenceInCalendarDays } from 'date-fns';

export function computeMargineGiornaliero(
  disponibileLibero: number,
  dataTarget: Date,
  today: Date
): number {
  const giorniRimanenti = Math.max(1, differenceInCalendarDays(dataTarget, today));
  return disponibileLibero / giorniRimanenti;
}
