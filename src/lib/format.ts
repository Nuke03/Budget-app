import { parseISO } from 'date-fns';

export function formatEuro(value: number): string {
  const formatted = new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
    useGrouping: true,
  }).format(value);
  // Replace non-breaking space (U+00A0) with regular space
  return formatted.replace(/\u00A0/g, ' ');
}

export function formatDateIt(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return new Intl.DateTimeFormat('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
}

export function formatNumero(value: number): string {
  return new Intl.NumberFormat('it-IT', {
    useGrouping: true,
    maximumFractionDigits: 2,
  }).format(value);
}

// "2026-11-01" -> "novembre"
export function nomeMese(meseISO: string): string {
  return new Intl.DateTimeFormat('it-IT', { month: 'long', timeZone: 'UTC' }).format(
    new Date(`${meseISO.slice(0, 10)}T12:00:00Z`)
  );
}
