import { addMonths, differenceInCalendarMonths, parseISO } from 'date-fns';
import type { GoalForCalc } from './types';

export function nextOccurrence(scadenza: Date, frequenzaMesi: number, today: Date): Date {
  let occurrence = scadenza;
  while (occurrence < today) {
    occurrence = addMonths(occurrence, frequenzaMesi);
  }
  return occurrence;
}

export interface FinestraGoal {
  windowStart: Date;
  windowEnd: Date | null;
}

// Finestra temporale entro cui contare le spese collegate a un obiettivo
// (vedi computeAccantonatoFinora). Per un obiettivo ricorrente è il ciclo
// attuale, cosi pagare la rata di gennaio non azzera per sbaglio anche quella
// di aprile. Un obiettivo dilazionato ha sempre bisogno della scadenza per
// fare questo calcolo (lancia un errore se manca); un bloccato invece, se non
// ha una scadenza/ricorrenza valida (versamento unico, o dati creati prima
// che la scadenza diventasse obbligatoria per i ricorrenti), resta aperto da
// quando è stato creato: non c'è nulla da azzerare, solo da non far crashare.
export function computeFinestraGoal(goal: GoalForCalc, today: Date): FinestraGoal {
  const createdAtDate = parseISO(goal.createdAt);
  const haFrequenzaValida = goal.ricorrente && !!goal.frequenzaMesi && goal.frequenzaMesi > 0;

  if (goal.modalita === 'dilazionato') {
    if (!goal.scadenza) {
      throw new Error('Obiettivo dilazionato senza scadenza');
    }
    if (goal.ricorrente && !haFrequenzaValida) {
      throw new Error('Obiettivo ricorrente con frequenzaMesi non valida');
    }
    if (goal.ricorrente) {
      const windowEnd = nextOccurrence(parseISO(goal.scadenza), goal.frequenzaMesi!, today);
      return { windowStart: addMonths(windowEnd, -goal.frequenzaMesi!), windowEnd };
    }
    return { windowStart: createdAtDate, windowEnd: parseISO(goal.scadenza) };
  }

  if (haFrequenzaValida && goal.scadenza) {
    const windowEnd = nextOccurrence(parseISO(goal.scadenza), goal.frequenzaMesi!, today);
    return { windowStart: addMonths(windowEnd, -goal.frequenzaMesi!), windowEnd };
  }

  return { windowStart: createdAtDate, windowEnd: null };
}

function computeAccantonatoTeorico(goal: GoalForCalc, today: Date): number {
  if (goal.modalita === 'bloccato') {
    return goal.importoTarget;
  }

  const { windowStart, windowEnd } = computeFinestraGoal(goal, today);
  const totalMonths = Math.max(1, differenceInCalendarMonths(windowEnd!, windowStart));
  const elapsedMonthsRaw = differenceInCalendarMonths(today, windowStart);
  const elapsedMonths = Math.min(Math.max(elapsedMonthsRaw, 0), totalMonths);

  const quotaMensile = goal.importoTarget / totalMonths;
  return quotaMensile * elapsedMonths;
}

// `specoCollegato` è il totale delle spese che l'utente ha esplicitamente
// collegato a questo obiettivo (vedi il selettore "Obiettivo" nel form di
// aggiunta transazione), nella finestra data da computeFinestraGoal. Una
// volta speso, quel denaro è già uscito dal saldo del conto — tenerlo anche
// riservato qui lo conterebbe due volte, quindi lo sottraiamo dal teorico
// (mai sotto zero).
export function computeAccantonatoFinora(
  goal: GoalForCalc,
  today: Date,
  specoCollegato: number = 0
): number {
  const teorico = computeAccantonatoTeorico(goal, today);
  return Math.max(0, teorico - specoCollegato);
}

// Quanto spostare in un mese/ricorrenza "tipica" verso un fondo separato
// (es. un conto non incluso nel disponibile) — a differenza di
// computeAccantonatoFinora, che dice quanto è già stato maturato/riservato ad
// oggi (al netto di quanto già speso), questa dice quanto spostare ogni volta
// per restare al passo, indipendentemente da quanto già speso in questo
// ciclo. Per un obiettivo bloccato non ricorrente non esiste una quota
// periodica: è un versamento unico già interamente riservato dal giorno
// della creazione.
export function computeQuotaMensile(goal: GoalForCalc, today: Date): number | null {
  if (goal.modalita === 'bloccato') {
    return goal.ricorrente ? goal.importoTarget : null;
  }

  const { windowStart, windowEnd } = computeFinestraGoal(goal, today);
  const totalMonths = Math.max(1, differenceInCalendarMonths(windowEnd!, windowStart));
  return goal.importoTarget / totalMonths;
}
