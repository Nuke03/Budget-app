import type { TransactionTipo } from '../types';

export function computeNuovoSaldoConto(
  saldoAttuale: number,
  tipo: TransactionTipo,
  importo: number
): number {
  return tipo === 'income' ? saldoAttuale + importo : saldoAttuale - importo;
}

export function computeSaldoSenzaTransazione(
  saldoAttuale: number,
  tipo: TransactionTipo,
  importo: number
): number {
  return tipo === 'income' ? saldoAttuale - importo : saldoAttuale + importo;
}

export interface AggiornamentoSaldo {
  accountId: string;
  nuovoSaldo: number;
}

export interface TransazioneSaldo {
  accountId: string | null;
  tipo: TransactionTipo;
  importo: number;
}

export function computeAggiornamentiSaldoPerModifica(
  accounts: { id: string; saldoAttuale: number }[],
  vecchia: TransazioneSaldo,
  nuova: TransazioneSaldo
): AggiornamentoSaldo[] {
  const saldoIniziale = new Map(accounts.map((a) => [a.id, a.saldoAttuale]));
  const saldoCorrente = new Map<string, number>();

  function leggi(accountId: string): number {
    return saldoCorrente.has(accountId) ? saldoCorrente.get(accountId)! : (saldoIniziale.get(accountId) ?? 0);
  }

  if (vecchia.accountId) {
    saldoCorrente.set(
      vecchia.accountId,
      computeSaldoSenzaTransazione(leggi(vecchia.accountId), vecchia.tipo, vecchia.importo)
    );
  }

  if (nuova.accountId) {
    saldoCorrente.set(
      nuova.accountId,
      computeNuovoSaldoConto(leggi(nuova.accountId), nuova.tipo, nuova.importo)
    );
  }

  return Array.from(saldoCorrente.entries()).map(([accountId, nuovoSaldo]) => ({
    accountId,
    nuovoSaldo,
  }));
}

const arrotonda2 = (n: number) => Math.round(n * 100) / 100;

function effettoSuSaldo(t: TransazioneSaldo): number {
  return t.tipo === 'income' ? t.importo : -t.importo;
}

// Di quanto cambia ogni conto quando una transazione passa da `vecchia` a `nuova`:
// si toglie l'effetto della vecchia e si applica quello della nuova. Una voce per
// conto, senza voci a zero. Serve ai conti di casa, che si aggiornano a differenza.
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
