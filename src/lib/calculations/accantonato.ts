import { addMonths, differenceInCalendarMonths, parseISO } from 'date-fns';
import type { GoalForCalc } from './types';

export function nextOccurrence(scadenza: Date, frequenzaMesi: number, today: Date): Date {
  let occurrence = scadenza;
  while (occurrence < today) {
    occurrence = addMonths(occurrence, frequenzaMesi);
  }
  return occurrence;
}

function computeFinestraDilazionato(
  goal: GoalForCalc,
  today: Date
): { windowStart: Date; windowEnd: Date; totalMonths: number } {
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
  return { windowStart, windowEnd, totalMonths };
}

export function computeAccantonatoFinora(goal: GoalForCalc, today: Date): number {
  if (goal.modalita === 'bloccato') {
    return goal.importoTarget;
  }

  const { windowStart, totalMonths } = computeFinestraDilazionato(goal, today);
  const elapsedMonthsRaw = differenceInCalendarMonths(today, windowStart);
  const elapsedMonths = Math.min(Math.max(elapsedMonthsRaw, 0), totalMonths);

  const quotaMensile = goal.importoTarget / totalMonths;
  return quotaMensile * elapsedMonths;
}

// Quanto spostare in un mese/ricorrenza "tipica" verso un fondo separato
// (es. un conto non incluso nel disponibile) — a differenza di
// computeAccantonatoFinora, che dice quanto è già stato maturato ad oggi,
// questa dice quanto spostare ogni volta per restare al passo. Per un
// obiettivo bloccato non ricorrente non esiste una quota periodica: è un
// versamento unico già interamente riservato dal giorno della creazione.
export function computeQuotaMensile(goal: GoalForCalc, today: Date): number | null {
  if (goal.modalita === 'bloccato') {
    return goal.ricorrente ? goal.importoTarget : null;
  }

  const { totalMonths } = computeFinestraDilazionato(goal, today);
  return goal.importoTarget / totalMonths;
}
