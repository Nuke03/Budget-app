'use client';

import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { createClient } from '@/lib/supabase/client';
import { getTransactions, deleteTransaction } from '@/lib/data/transactions';
import { getCategories } from '@/lib/data/categories';
import { aggregateByCategory } from '@/lib/calculations/aggregateByCategory';
import { formatEuro, formatDateIt } from '@/lib/format';
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

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 p-6">
      <h1 className="text-xl font-bold">Storico</h1>

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <XAxis dataKey="nome" tick={{ fontSize: 10 }} />
            <YAxis />
            <Tooltip formatter={(value) => formatEuro(Number(value))} />
            <Bar dataKey="totale" fill="#0f172a" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <ul className="flex flex-col gap-2">
        {transactions.map((t) => (
          <li key={t.id} className="flex items-center justify-between rounded border p-2 text-sm">
            <div>
              <p>{t.descrizione || '(senza descrizione)'}</p>
              <p className="text-xs text-slate-400">{formatDateIt(t.data)}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={t.tipo === 'income' ? 'text-green-600' : ''}>
                {t.tipo === 'income' ? '+' : '-'}
                {formatEuro(t.importo)}
              </span>
              <button
                type="button"
                onClick={() => handleDelete(t.id)}
                className="text-xs text-red-500 underline"
              >
                Elimina
              </button>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
