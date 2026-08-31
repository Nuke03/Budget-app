'use client';

import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { getTransactions, deleteTransaction } from '@/lib/data/transactions';
import { getCategories } from '@/lib/data/categories';
import { aggregateByCategory } from '@/lib/calculations/aggregateByCategory';
import { formatEuro, formatDateIt } from '@/lib/format';
import { CATEGORY_COLOR_FALLBACK } from '@/lib/categoryColors';
import { HistoryChartCard } from './HistoryChartCard';
import type { Transaction, Category } from '@/lib/types';

export default function HistoryPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  async function refresh() {
    const supabase = createClient();
    const [tx, cats] = await Promise.all([getTransactions(supabase), getCategories(supabase)]);
    setTransactions(tx);
    setCategories(cats);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleDelete(id: string) {
    const supabase = createClient();
    await deleteTransaction(supabase, id);
    await refresh();
  }

  const chartData = aggregateByCategory(transactions, categories);
  const colorByCategoryName = new Map(
    categories.map((c) => [c.nome, c.colore ?? CATEGORY_COLOR_FALLBACK])
  );
  const colorByCategoryId = new Map(categories.map((c) => [c.id, c.colore ?? CATEGORY_COLOR_FALLBACK]));

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 p-5 pt-8">
      <h1 className="text-2xl font-bold">Storico</h1>

      <HistoryChartCard chartData={chartData} colorByCategoryName={colorByCategoryName} />

      <ul className="flex flex-col gap-2">
        {transactions.map((t) => {
          const color = t.categoriaId ? colorByCategoryId.get(t.categoriaId) : null;
          return (
            <li
              key={t.id}
              className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] bg-surface p-3 shadow-[var(--shadow-card)]"
            >
              <div className="flex items-center gap-3">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: color ?? CATEGORY_COLOR_FALLBACK }}
                />
                <div>
                  <p className="text-sm font-medium">{t.descrizione || '(senza descrizione)'}</p>
                  <p className="text-xs text-muted">{formatDateIt(t.data)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`tabular-nums text-sm font-semibold ${
                    t.tipo === 'income' ? 'text-brand-dark' : 'text-foreground'
                  }`}
                >
                  {t.tipo === 'income' ? '+' : '-'}
                  {formatEuro(t.importo)}
                </span>
                <button
                  type="button"
                  onClick={() => handleDelete(t.id)}
                  aria-label="Elimina transazione"
                  className="rounded-full p-1.5 text-muted hover:bg-surface-muted hover:text-danger"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </li>
          );
        })}
        {transactions.length === 0 && (
          <p className="rounded-[var(--radius-md)] bg-surface p-4 text-center text-sm text-muted shadow-[var(--shadow-card)]">
            Nessuna transazione ancora.
          </p>
        )}
      </ul>
    </main>
  );
}
