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

interface TransazioneSaldo {
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
