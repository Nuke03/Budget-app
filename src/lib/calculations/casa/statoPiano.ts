import type { PlanShare } from '@/lib/types';

// Bozza finché una posizione attiva con quota maggiore di zero non è legata a un membro.
export function statoPiano(
  shares: Pick<PlanShare, 'quotaMensile' | 'userId' | 'esceDal'>[],
): 'bozza' | 'attivo' {
  const attive = shares.filter((s) => s.esceDal === null || s.esceDal === undefined);
  if (attive.length === 0) return 'bozza';
  return attive.some((s) => s.quotaMensile > 0 && s.userId === null) ? 'bozza' : 'attivo';
}

// Nomi di chi manca perché il piano diventi attivo (posizioni con quota > 0 non legate).
export function nomiMancanti(
  shares: Pick<PlanShare, 'quotaMensile' | 'userId' | 'esceDal' | 'displayName'>[],
): string[] {
  const nomi = shares
    .filter((s) => (s.esceDal === null || s.esceDal === undefined) && s.quotaMensile > 0 && s.userId === null)
    .map((s) => s.displayName);
  return Array.from(new Set(nomi));
}
