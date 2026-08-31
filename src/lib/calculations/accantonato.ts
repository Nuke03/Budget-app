import { addMonths, differenceInCalendarMonths, parseISO } from 'date-fns';
import type { GoalForCalc } from './types';

export function nextOccurrence(scadenza: Date, frequenzaMesi: number, today: Date): Date {
  let occurrence = scadenza;
  while (occurrence < today) {
    occurrence = addMonths(occurrence, frequenzaMesi);
  }
  return occurrence;
}

export function computeAccantonatoFinora(goal: GoalForCalc, today: Date): number {
  if (goal.modalita === 'bloccato') {
    return goal.importoTarget;
  }

  if (!goal.scadenza) {
    throw new Error('Obiettivo dilazionato senza scadenza');
  }

  const scadenzaDate = parseISO(goal.scadenza);
  const createdAtDate = parseISO(goal.createdAt);

  let windowStart: Date;
  let windowEnd: Date;

  if (goal.ricorrente) {
    if (!(goal.frequenzaMesi && goal.frequenzaMesi > 0)) {
      throw new Error('Obiettivo ricorrente con frequenzaMesi non valida');
    }
    windowEnd = nextOccurrence(scadenzaDate, goal.frequenzaMesi, today);
    windowStart = addMonths(windowEnd, -goal.frequenzaMesi);
  } else {
    windowStart = createdAtDate;
    windowEnd = scadenzaDate;
  }

  const totalMonths = Math.max(1, differenceInCalendarMonths(windowEnd, windowStart));
  const elapsedMonthsRaw = differenceInCalendarMonths(today, windowStart);
  const elapsedMonths = Math.min(Math.max(elapsedMonthsRaw, 0), totalMonths);

  const quotaMensile = goal.importoTarget / totalMonths;
  return quotaMensile * elapsedMonths;
}
