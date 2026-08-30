import type { Transaction, Category } from '../types';

export function aggregateByCategory(
  transactions: Transaction[],
  categories: Category[]
): { nome: string; totale: number }[] {
  const nomeById = new Map(categories.map((c) => [c.id, c.nome]));
  const totali = new Map<string, number>();

  for (const t of transactions) {
    if (t.tipo !== 'expense') continue;
    const nome = t.categoriaId ? nomeById.get(t.categoriaId) ?? 'Senza categoria' : 'Senza categoria';
    totali.set(nome, (totali.get(nome) ?? 0) + t.importo);
  }

  return Array.from(totali.entries()).map(([nome, totale]) => ({ nome, totale }));
}
