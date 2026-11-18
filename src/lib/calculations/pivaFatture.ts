import type { Account, PivaFattura, Transaction } from '../types';

// Dopo quanti giorni una fattura non pagata è "vecchia".
export const GIORNI_FATTURA_VECCHIA = 60;

export type RigaFattura = PivaFattura & { giorni: number; vecchia: boolean };

function giorniTra(da: string, a: string): number {
  return Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${da}T00:00:00Z`)) / 86_400_000);
}

// Le fatture ancora da incassare, dalla più vecchia, col totale che ti devono.
export function fattureInAttesa(f: PivaFattura[], oggi: string): { totale: number; righe: RigaFattura[] } {
  const righe = f
    .filter((x) => x.dataIncasso === null)
    .map((x) => {
      const giorni = giorniTra(x.dataEmissione, oggi);
      return { ...x, giorni, vecchia: giorni > GIORNI_FATTURA_VECCHIA };
    })
    .sort((a, b) => (a.dataEmissione < b.dataEmissione ? -1 : a.dataEmissione > b.dataEmissione ? 1 : 0));
  return { totale: righe.reduce((tot, x) => tot + x.importo, 0), righe };
}

// "3 fatture, 1 da 90 giorni". Con più fatture vecchie si dice quante e da quanto la più vecchia.
export function riassuntoInAttesa(r: { righe: RigaFattura[] }): string {
  const n = r.righe.length;
  const base = n === 1 ? '1 fattura' : `${n} fatture`;
  const vecchie = r.righe.filter((x) => x.vecchia);
  if (vecchie.length === 0) return base;
  const giorni = vecchie[0].giorni;
  return vecchie.length === 1
    ? `${base}, 1 da ${giorni} giorni`
    : `${base}, ${vecchie.length} vecchie, la prima da ${giorni} giorni`;
}

// Il conto proposto per un incasso: quello dell'ultimo incasso del fatturato, altrimenti il primo
// personale nel disponibile. Mai il conto tasse. null: non c'è un conto adatto.
export function contoPerIncasso(
  incassi: Transaction[],
  conti: Pick<Account, 'id' | 'contaInDisponibile'>[],
  categoriaFatturatoId: string | null,
  contoTasseId: string | null
): string | null {
  const valido = (id: string | null): id is string => !!id && id !== contoTasseId && conti.some((c) => c.id === id);
  const ultimo = incassi
    .filter((t) => t.tipo === 'income' && categoriaFatturatoId !== null && t.categoriaId === categoriaFatturatoId && valido(t.accountId))
    .sort((a, b) => (a.data === b.data ? ((a.createdAt ?? '') < (b.createdAt ?? '') ? 1 : -1) : a.data < b.data ? 1 : -1))[0];
  if (ultimo?.accountId) return ultimo.accountId;
  return conti.find((c) => c.contaInDisponibile && c.id !== contoTasseId)?.id ?? null;
}
