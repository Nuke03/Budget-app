import { formatNumero } from '../../format';
import type { Transaction } from '../../types';

export type EsitoControllo = 'torna' | 'mancano' | 'in_piu';

// Sotto questa soglia la differenza è rumore di arrotondamento: il saldo torna.
const SOGLIA_TORNA = 1;

// Confronta il saldo registrato nell app con quello dichiarato dalla banca.
// differenza = banca - app: negativa se in banca ci sono meno soldi di quelli registrati.
export function valutaControllo(
  saldoApp: number,
  saldoBanca: number
): { differenza: number; esito: EsitoControllo; frase: string } {
  const differenza = Math.round((saldoBanca - saldoApp) * 100) / 100 || 0;
  if (Math.abs(differenza) < SOGLIA_TORNA) {
    return { differenza, esito: 'torna', frase: 'Torna tutto.' };
  }
  const importo = `${formatNumero(Math.abs(differenza))} €`;
  if (differenza < 0) {
    return {
      differenza,
      esito: 'mancano',
      frase: `Mancano ${importo}. Succede: nessuno ricorda ogni spesa.`,
    };
  }
  return {
    differenza,
    esito: 'in_piu',
    frase: `In banca ci sono ${importo} in più di quelli registrati.`,
  };
}

// Le spese che il controllo del saldo ha registrato nel mese (origine riconciliazione).
// mese accetta sia 'YYYY-MM' sia 'YYYY-MM-DD': si confronta solo il mese.
export function speseNonRegistrate(
  transazioni: Pick<Transaction, 'tipo' | 'importo' | 'data' | 'origine'>[],
  mese: string
): number {
  const meseIso = mese.slice(0, 7);
  return transazioni
    .filter((t) => t.tipo === 'expense' && t.origine === 'riconciliazione' && t.data.slice(0, 7) === meseIso)
    .reduce((somma, t) => somma + t.importo, 0);
}
