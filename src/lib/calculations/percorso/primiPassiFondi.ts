// Calcoli dei primi passi: scadenze dei fondi e riepilogo della settimana di prova.
import { addMonths, endOfMonth, format } from 'date-fns';
import type { Category, Transaction } from '@/lib/types';
import { GIORNI_ATTESA } from './soglie';
import { piccoleSpese } from './numeri';

// Mesi per arrivare al traguardo versando la quota ogni mese (arrotondati per eccesso).
export function mesiPerTraguardo(traguardo: number, quota: number): number {
  return Math.ceil(Math.round((traguardo / quota) * 1e6) / 1e6);
}

// oggi + mesi, sicuro a fine mese (31 gennaio + 1 mese = 28 febbraio).
export function scadenzaDopoMesi(oggi: string, mesi: number): string {
  return format(addMonths(new Date(`${oggi}T12:00:00`), mesi), 'yyyy-MM-dd');
}

export function scadenzaImprevisti(oggi: string, traguardo: number, quota: number): string {
  return scadenzaDopoMesi(oggi, mesiPerTraguardo(traguardo, quota));
}

// 'YYYY-MM' -> ultimo giorno di quel mese ('YYYY-MM-DD').
export function fineDelMese(mese: string): string {
  return format(endOfMonth(new Date(`${mese}-01T12:00:00`)), 'yyyy-MM-dd');
}

export function meseValido(mese: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(mese);
}

function giorniTra(da: string, a: string): number {
  return (Date.parse(`${a}T00:00:00Z`) - Date.parse(`${da}T00:00:00Z`)) / 86_400_000;
}

export interface RiepilogoSettimana {
  numeroSpese: number;
  totale: number;
  // Le tre categorie con più spesa; "Senza categoria" per le righe senza.
  grandi: { nome: string; totale: number }[];
  piccole: { numero: number; totale: number };
}

// Le spese personali dal giorno di avvio a oggi.
export function riepilogoSettimana(
  transazioni: Transaction[],
  categorie: Category[],
  dal: string,
  oggi: string
): RiepilogoSettimana {
  const spese = transazioni.filter((t) => t.tipo === 'expense' && t.data >= dal && t.data <= oggi);
  const perCategoria = new Map<string, number>();
  let centesimi = 0;
  for (const t of spese) {
    const nome = categorie.find((c) => c.id === t.categoriaId)?.nome ?? 'Senza categoria';
    const c = Math.round(t.importo * 100);
    centesimi += c;
    perCategoria.set(nome, (perCategoria.get(nome) ?? 0) + c);
  }
  const grandi = [...perCategoria.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([nome, c]) => ({ nome, totale: c / 100 }));
  // Mese vuoto: tutte le date iniziano con '', la settimana può stare a cavallo di due mesi.
  return { numeroSpese: spese.length, totale: centesimi / 100, grandi, piccole: piccoleSpese(spese, '') };
}

export type FaseSettimana = 'da-avviare' | 'in-corso' | 'finita';

export function faseSettimana(settimanaDal: string | null, oggi: string): FaseSettimana {
  if (!settimanaDal) return 'da-avviare';
  return giorniTra(settimanaDal, oggi) >= GIORNI_ATTESA ? 'finita' : 'in-corso';
}
