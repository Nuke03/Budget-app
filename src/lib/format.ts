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
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
}
