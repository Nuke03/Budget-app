import { parseISO } from 'date-fns';

// "Oggi" nel fuso Europe/Rome, indipendente dal fuso del server o del browser.
function partiRoma(now: Date): { y: string; m: string; d: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Rome',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return { y: get('year'), m: get('month'), d: get('day') };
}

export function oggiRomaISO(now: Date = new Date()): string {
  const { y, m, d } = partiRoma(now);
  return `${y}-${m}-${d}`;
}

export function meseRomaISO(now: Date = new Date()): string {
  const { y, m } = partiRoma(now);
  return `${y}-${m}-01`;
}

// Mezzanotte locale del giorno di Roma: la data da passare ai calcoli che
// ragionano in giorni e mesi di calendario.
export function oggiRomaData(now: Date = new Date()): Date {
  return parseISO(oggiRomaISO(now));
}
