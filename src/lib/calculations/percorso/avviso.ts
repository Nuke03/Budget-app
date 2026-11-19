export type SoldiToccati = 'obiettivi' | 'casa' | 'debiti' | 'tasse';

export interface AvvisoFondi {
  // Quanto il disponibile è sotto zero dopo la spesa (al massimo l'importo).
  buco: number;
  // Nell'ordine di consumo.
  toccati: SoldiToccati[];
  // Solo se gli obiettivi sono toccati e il fondo ha qualcosa da cedere.
  fondoImprevisti: { goalId: string; accantonato: number } | null;
}

const ORDINE: SoldiToccati[] = ['obiettivi', 'casa', 'debiti', 'tasse'];

const arrotonda2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function valutaAvvisoFondi(input: {
  importo: number;
  contaInDisponibile: boolean;
  disponibileDopo: number;
  riservati: Record<SoldiToccati, number>;
  fondoImprevisti: { goalId: string; accantonato: number } | null;
}): AvvisoFondi | null {
  const { importo, contaInDisponibile, disponibileDopo, riservati, fondoImprevisti } = input;
  if (!contaInDisponibile) return null;
  // Si confronta in centesimi, mai sul float grezzo.
  const dopo = arrotonda2(disponibileDopo);
  if (dopo >= 0) return null;
  // Era già sotto zero prima della spesa: l'avviso è già stato dato.
  if (arrotonda2(dopo + importo) < 0) return null;

  const buco = arrotonda2(-dopo);
  if (buco <= 0) return null;
  // Il buco si consuma nell'ordine, fermandosi a ciascun riservato.
  let resto = buco;
  const toccati: SoldiToccati[] = [];
  for (const voce of ORDINE) {
    if (resto <= 0) break;
    const disponibile = riservati[voce];
    if (disponibile <= 0) continue;
    toccati.push(voce);
    resto = arrotonda2(resto - disponibile);
  }

  const fondo =
    toccati.includes('obiettivi') && fondoImprevisti && fondoImprevisti.accantonato > 0 ? fondoImprevisti : null;
  return { buco, toccati, fondoImprevisti: fondo };
}
