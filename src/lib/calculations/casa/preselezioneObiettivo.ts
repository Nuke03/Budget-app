import type { BudgetGoal } from '@/lib/types';

// Obiettivo da proporre per una categoria: solo se ce n'è esattamente uno aperto.
// Con due o più obiettivi sulla stessa categoria la scelta resta a chi salva.
export function obiettivoDaCategoria(
  goals: Pick<BudgetGoal, 'id' | 'categoriaId' | 'stato'>[],
  categoriaId: string | null
): string | null {
  if (categoriaId === null) return null;
  const candidati = goals.filter((g) => g.stato === 'aperto' && g.categoriaId === categoriaId);
  return candidati.length === 1 ? candidati[0].id : null;
}
