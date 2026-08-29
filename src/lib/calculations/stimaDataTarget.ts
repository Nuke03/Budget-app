import { addMonths, setDate } from 'date-fns';

export function stimaDataTarget(ultimaEntrata: Date | null, today: Date): Date {
  if (!ultimaEntrata) {
    return addMonths(today, 1);
  }

  const giorno = ultimaEntrata.getDate();
  let candidate = setDate(today, giorno);

  if (candidate <= today) {
    candidate = setDate(addMonths(today, 1), giorno);
  }

  return candidate;
}
