import type { Transaction } from '@/lib/types';

export interface Andamento {
  // Spese del mese di oggi, fino a oggi compreso.
  spesoFinora: number;
  // Media dello speso allo stesso giorno nei mesi di confronto, null se non ce ne sono.
  solito: number | null;
  // Quanti mesi precedenti entrano nel confronto (0..3).
  mesiConfronto: number;
  // Dal giorno 1 a oggi, cumulato.
  curva: { giorno: number; mese: number; solito: number | null }[];
  perCategoria: { categoriaId: string | null; mese: number; solito: number | null }[];
}

type Spesa = Pick<Transaction, 'tipo' | 'importo' | 'data' | 'categoriaId'>;

const MESI_DI_CONFRONTO = 3;
const arrotonda = (n: number): number => Math.round(n * 100) / 100;

// Mese di calendario prima di quello dato (YYYY-MM), senza passare da Date locali.
function mesePrima(mese: string, quanti: number): string {
  const totale = Number(mese.slice(0, 4)) * 12 + (Number(mese.slice(5, 7)) - 1) - quanti;
  return `${Math.floor(totale / 12)}-${String((totale % 12) + 1).padStart(2, '0')}`;
}

function giorniDelMese(mese: string): number {
  return new Date(Date.UTC(Number(mese.slice(0, 4)), Number(mese.slice(5, 7)), 0)).getUTCDate();
}

export function calcolaAndamento(spese: Spesa[], oggi: string): Andamento {
  const meseOggi = oggi.slice(0, 7);
  const giornoOggi = Number(oggi.slice(8, 10));
  const solo = spese.filter((s) => s.tipo === 'expense');

  // Un mese conta solo se c'è almeno una spesa in quel mese o prima.
  const primaSpesa = solo.reduce<string | null>((min, s) => (min === null || s.data < min ? s.data : min), null);
  const mesiConfronto: string[] = [];
  for (let i = MESI_DI_CONFRONTO; i >= 1; i--) {
    const m = mesePrima(meseOggi, i);
    if (primaSpesa !== null && primaSpesa.slice(0, 7) <= m) mesiConfronto.push(m);
  }

  // Giorno di confronto per ogni mese: oggi, ma dentro la lunghezza di quel mese.
  const finestre = new Map<string, number>(mesiConfronto.map((m) => [m, Math.min(giornoOggi, giorniDelMese(m))]));
  finestre.set(meseOggi, giornoOggi);

  // Speso per mese e giorno, e per mese e categoria, solo dentro la finestra.
  const perGiorno = new Map<string, number[]>();
  const perCat = new Map<string | null, Map<string, number>>();
  for (const s of solo) {
    const m = s.data.slice(0, 7);
    const finestra = finestre.get(m);
    const g = Number(s.data.slice(8, 10));
    if (finestra === undefined || g > finestra) continue;
    const giorni = perGiorno.get(m) ?? new Array<number>(32).fill(0);
    giorni[g] += s.importo;
    perGiorno.set(m, giorni);
    const mesi = perCat.get(s.categoriaId) ?? new Map<string, number>();
    mesi.set(m, (mesi.get(m) ?? 0) + s.importo);
    perCat.set(s.categoriaId, mesi);
  }

  const cumulato = (m: string, giorno: number): number => {
    const giorni = perGiorno.get(m);
    let tot = 0;
    if (giorni) for (let g = 1; g <= Math.min(giorno, finestre.get(m) ?? 0); g++) tot += giorni[g];
    return tot;
  };
  const media = (valore: (m: string) => number): number | null =>
    mesiConfronto.length === 0 ? null : arrotonda(mesiConfronto.reduce((t, m) => t + valore(m), 0) / mesiConfronto.length);

  const curva = Array.from({ length: giornoOggi }, (_, i) => ({
    giorno: i + 1,
    mese: arrotonda(cumulato(meseOggi, i + 1)),
    solito: media((m) => cumulato(m, i + 1)),
  }));

  const perCategoria = [...perCat.entries()].map(([categoriaId, mesi]) => ({
    categoriaId,
    mese: arrotonda(mesi.get(meseOggi) ?? 0),
    solito: media((m) => mesi.get(m) ?? 0),
  }));

  return { spesoFinora: arrotonda(cumulato(meseOggi, giornoOggi)), solito: media((m) => cumulato(m, giornoOggi)), mesiConfronto: mesiConfronto.length, curva, perCategoria };
}
