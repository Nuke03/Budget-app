import type { TransactionTipo } from '../types';

export interface TransazioneSaldo {
  accountId: string | null;
  tipo: TransactionTipo;
  importo: number;
}

const arrotonda2 = (n: number) => Math.round(n * 100) / 100;

function effettoSuSaldo(t: TransazioneSaldo): number {
  return t.tipo === 'income' ? t.importo : -t.importo;
}

// Di quanto cambia ogni conto quando una transazione passa da `vecchia` a `nuova`:
// si toglie l'effetto della vecchia e si applica quello della nuova. Una voce per
// conto, senza voci a zero. Tutti i conti si aggiornano a differenza, mai con un saldo assoluto.
export function deltaPerModifica(
  vecchia: TransazioneSaldo,
  nuova: TransazioneSaldo
): { accountId: string; delta: number }[] {
  const delta = new Map<string, number>();
  if (vecchia.accountId) {
    delta.set(vecchia.accountId, (delta.get(vecchia.accountId) ?? 0) - effettoSuSaldo(vecchia));
  }
  if (nuova.accountId) {
    delta.set(nuova.accountId, (delta.get(nuova.accountId) ?? 0) + effettoSuSaldo(nuova));
  }
  return Array.from(delta.entries())
    .map(([accountId, d]) => ({ accountId, delta: arrotonda2(d) }))
    .filter((v) => v.delta !== 0);
}
