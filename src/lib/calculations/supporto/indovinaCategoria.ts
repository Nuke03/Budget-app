import type { Transaction } from '@/lib/types';

type Riga = Pick<Transaction, 'descrizione' | 'categoriaId' | 'data' | 'tipo'>;

// Quanti giorni indietro contano per la categoria più usata: oggi compreso, quindi 30 giorni in tutto.
const FINESTRA_GIORNI = 30;

// Differenza in giorni fra due date 'YYYY-MM-DD', calcolata in UTC per non risentire del fuso.
function giorniTra(da: string, a: string): number {
  return (Date.parse(`${a}T00:00:00Z`) - Date.parse(`${da}T00:00:00Z`)) / 86_400_000;
}

// Suggerisce la categoria di una nuova spesa dal suo storico. Null se non c'è niente da cui imparare.
export function indovinaCategoria(
  descrizione: string,
  storico: Riga[],
  oggi: string,
): string | null {
  const chiave = descrizione.trim().toLowerCase();
  const spese = storico.filter((r) => r.tipo === 'expense' && r.categoriaId !== null);

  // Stessa descrizione: vale la categoria della spesa più recente.
  let piuRecente: Riga | null = null;
  for (const r of spese) {
    if (r.descrizione.trim().toLowerCase() !== chiave) continue;
    if (piuRecente === null || r.data > piuRecente.data) piuRecente = r;
  }
  if (piuRecente) return piuRecente.categoriaId;

  // Descrizione nuova: la categoria più frequente negli ultimi 30 giorni, a parità la più recente.
  const conteggi = new Map<string, { n: number; ultima: string }>();
  for (const r of spese) {
    const giorni = giorniTra(r.data, oggi);
    if (giorni < 0 || giorni >= FINESTRA_GIORNI) continue;
    const id = r.categoriaId as string;
    const c = conteggi.get(id) ?? { n: 0, ultima: '' };
    c.n += 1;
    if (r.data > c.ultima) c.ultima = r.data;
    conteggi.set(id, c);
  }

  let vincente: string | null = null;
  let migliore = { n: 0, ultima: '' };
  for (const [id, c] of conteggi) {
    if (c.n > migliore.n || (c.n === migliore.n && c.ultima > migliore.ultima)) {
      vincente = id;
      migliore = c;
    }
  }
  return vincente;
}
