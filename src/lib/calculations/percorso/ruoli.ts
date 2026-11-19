// Che cosa è una categoria o una spesa per il percorso: regole pure, nessun accesso ai dati.
// Sta a parte perché lo usano sia regole.ts sia numeri.ts.
import type { Category, Transaction } from '@/lib/types';

export const normalizza = (s: string): string => s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');

const PAROLE_CERTE = ['auto', 'assicura', 'bollo', 'tari', 'abbonament', 'tagliando', 'revisione'];
const PAROLE_SVAGO = ['svago', 'acquist', 'shopping', 'vestit', 'hobby', 'regal'];

export function ruoloCategoria(c: Category): 'certa' | 'svago' | null {
  if (c.ruolo) return c.ruolo;
  const nome = normalizza(c.nome);
  if (PAROLE_CERTE.some((p) => nome.includes(p))) return 'certa';
  if (PAROLE_SVAGO.some((p) => nome.includes(p))) return 'svago';
  return null;
}

// Confini di parola: "pirata" non è una rata; "rateale" e "rateizzo" sì.
const RE_RATA = /\b(?:rata|rate|rateale|rateizz\w*|klarna|scalapay|paypal in 3|finanziament\w*)\b/;

export function eRata(t: Transaction, categorie: Category[]): boolean {
  const nomeCategoria = categorie.find((c) => c.id === t.categoriaId)?.nome ?? '';
  return RE_RATA.test(normalizza(`${t.descrizione} ${nomeCategoria}`));
}
