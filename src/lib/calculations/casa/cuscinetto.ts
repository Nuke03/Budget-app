export function cuscinettoDefault(
  sottotot: number,
  mesi: 1 | 2 = 1,
): { obiettivo: number; quotaMensile: number } {
  return { obiettivo: sottotot * mesi, quotaMensile: Math.round(sottotot * 0.05) };
}

export function mesiAlPieno(obiettivo: number, quotaMensile: number): number | null {
  if (!(quotaMensile > 0)) return null;
  return Math.round(obiettivo / quotaMensile);
}
