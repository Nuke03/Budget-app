import type { Transaction, Transfer } from '../../types';

const arrotonda = (n: number): number => Math.round(n * 100) / 100;

// Quanto la casa deve ancora a un membro: spese di casa che ha pagato di tasca sua, più i versamenti
// fatti a suo favore, meno i rimborsi (e le rinunce) già registrati. Mai sotto zero.
// Rispecchia _casa_credito_aperto.
export function creditoMembro(
  userId: string,
  spese: Pick<Transaction, 'tipo' | 'importo' | 'pagataDaUserId'>[],
  transfers: Transfer[],
): number {
  let totale = 0;
  for (const s of spese) {
    if (s.tipo === 'expense' && s.pagataDaUserId === userId) totale += s.importo;
  }
  for (const t of transfers) {
    if (t.beneficiarioUserId !== userId) continue;
    if (t.causale === 'versamento') totale += t.importo;
    else if (t.causale === 'rimborso') totale -= t.importo;
  }
  return Math.max(0, arrotonda(totale));
}

export function creditiPerMembro(
  userIds: string[],
  spese: Pick<Transaction, 'tipo' | 'importo' | 'pagataDaUserId'>[],
  transfers: Transfer[],
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const id of userIds) out[id] = creditoMembro(id, spese, transfers);
  return out;
}
