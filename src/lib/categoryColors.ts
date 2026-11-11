export const CATEGORY_COLORS = [
  { name: 'Corallo', value: '#F97362' },
  { name: 'Ambra', value: '#F5A524' },
  { name: 'Smeraldo', value: '#0F9D6B' },
  { name: 'Teal', value: '#14B8A6' },
  { name: 'Cielo', value: '#3B9AE1' },
  { name: 'Viola', value: '#8452F5' },
  { name: 'Rosa', value: '#EC4899' },
  { name: 'Ardesia', value: '#64748B' },
  { name: 'Lime', value: '#84CC16' },
  { name: 'Indaco', value: '#6063F1' },
  { name: 'Fucsia', value: '#D946EF' },
  { name: 'Ciano', value: '#06B6D4' },
  { name: 'Rosso', value: '#EF4444' },
  { name: 'Marrone', value: '#92400E' },
  { name: 'Bosco', value: '#15803D' },
  { name: 'Grigio', value: '#9CA3AF' },
] as const;

export const CATEGORY_COLOR_FALLBACK = '#64748B';

// Colore del testo (inchiostro scuro o bianco) con più contrasto su uno sfondo #RRGGBB.
export function testoSu(sfondo: string): string {
  const m = /^#([0-9a-f]{6})$/i.exec(sfondo);
  if (!m) return '#ffffff';
  const c = [0, 2, 4]
    .map((i) => parseInt(m[1].slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  const lum = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  const conBianco = 1.05 / (lum + 0.05);
  const conInchiostro = (lum + 0.05) / (0.0165 + 0.05);
  return conBianco >= conInchiostro ? '#ffffff' : '#14213d';
}
