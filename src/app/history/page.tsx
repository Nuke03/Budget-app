'use client';

import { useEffect, useState } from 'react';
import { Pencil, Trash2, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { getTransactions, updateTransaction, deleteTransaction } from '@/lib/data/transactions';
import { getCategories } from '@/lib/data/categories';
import { getAccounts, updateAccountBalance } from '@/lib/data/accounts';
import { aggregateByCategory } from '@/lib/calculations/aggregateByCategory';
import { filterTransactionsByPeriodo, type Periodo } from '@/lib/calculations/filterTransactionsByPeriodo';
import { computeAggiornamentiSaldoPerModifica } from '@/lib/calculations/accountBalance';
import { formatEuro, formatDateIt } from '@/lib/format';
import { CATEGORY_COLOR_FALLBACK } from '@/lib/categoryColors';
import { HistoryChartCard } from './HistoryChartCard';
import { PeriodoFilter } from './PeriodoFilter';
import { AddTransactionForm } from '../add/AddTransactionForm';
import type { Transaction, Category, Account, TransactionTipo } from '@/lib/types';

export default function HistoryPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [periodo, setPeriodo] = useState<Periodo>('mese');
  const [rangePersonalizzato, setRangePersonalizzato] = useState({ da: '', a: '' });
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  async function refresh() {
    const supabase = createClient();
    const [tx, cats, accs] = await Promise.all([
      getTransactions(supabase),
      getCategories(supabase),
      getAccounts(supabase),
    ]);
    setTransactions(tx);
    setCategories(cats);
    setAccounts(accs);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function applicaAggiornamentiSaldo(
    vecchia: { accountId: string | null; tipo: TransactionTipo; importo: number },
    nuova: { accountId: string | null; tipo: TransactionTipo; importo: number }
  ) {
    const supabase = createClient();
    const aggiornamenti = computeAggiornamentiSaldoPerModifica(accounts, vecchia, nuova);
    for (const a of aggiornamenti) {
      await updateAccountBalance(supabase, a.accountId, a.nuovoSaldo);
    }
  }

  async function handleDelete(t: Transaction) {
    const supabase = createClient();
    await deleteTransaction(supabase, t.id);
    await applicaAggiornamentiSaldo(
      { accountId: t.accountId, tipo: t.tipo, importo: t.importo },
      { accountId: null, tipo: t.tipo, importo: 0 }
    );
    await refresh();
  }

  async function handleUpdate(payload: {
    tipo: TransactionTipo;
    importo: number;
    categoriaId: string | null;
    accountId: string | null;
    descrizione: string;
  }) {
    if (!editingTransaction) return;
    const supabase = createClient();
    await updateTransaction(supabase, editingTransaction.id, {
      ...payload,
      data: editingTransaction.data,
      goalId: editingTransaction.goalId,
      nota: editingTransaction.nota,
    });
    await applicaAggiornamentiSaldo(
      { accountId: editingTransaction.accountId, tipo: editingTransaction.tipo, importo: editingTransaction.importo },
      { accountId: payload.accountId, tipo: payload.tipo, importo: payload.importo }
    );
    setEditingTransaction(null);
    await refresh();
  }

  const transactionsFiltrate = filterTransactionsByPeriodo(
    transactions,
    periodo,
    new Date(),
    rangePersonalizzato
  );
  const chartData = aggregateByCategory(transactionsFiltrate, categories);
  const colorByCategoryName = new Map(
    categories.map((c) => [c.nome, c.colore ?? CATEGORY_COLOR_FALLBACK])
  );
  const colorByCategoryId = new Map(categories.map((c) => [c.id, c.colore ?? CATEGORY_COLOR_FALLBACK]));

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 p-5 pt-8">
      <h1 className="text-2xl font-bold">Storico</h1>

      <PeriodoFilter
        periodo={periodo}
        onChangePeriodo={setPeriodo}
        rangePersonalizzato={rangePersonalizzato}
        onChangeRangePersonalizzato={setRangePersonalizzato}
      />

      <HistoryChartCard chartData={chartData} colorByCategoryName={colorByCategoryName} />

      <ul className="flex flex-col gap-2">
        {transactionsFiltrate.map((t) => {
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
                  onClick={() => setEditingTransaction(t)}
                  aria-label="Modifica transazione"
                  className="rounded-full p-1.5 text-muted hover:bg-surface-muted hover:text-foreground"
                >
                  <Pencil size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(t)}
                  aria-label="Elimina transazione"
                  className="rounded-full p-1.5 text-muted hover:bg-surface-muted hover:text-danger"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </li>
          );
        })}
        {transactionsFiltrate.length === 0 && (
          <p className="rounded-[var(--radius-md)] bg-surface p-4 text-center text-sm text-muted shadow-[var(--shadow-card)]">
            {transactions.length === 0
              ? 'Nessuna transazione ancora.'
              : 'Nessuna transazione in questo periodo.'}
          </p>
        )}
      </ul>

      {editingTransaction && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <button
            type="button"
            aria-label="Chiudi"
            onClick={() => setEditingTransaction(null)}
            className="animate-backdrop-in absolute inset-0 bg-black/40 backdrop-blur-sm"
          />
          <div className="animate-sheet-in relative w-full max-w-md rounded-t-[var(--radius-lg)] bg-surface pt-3 shadow-2xl">
            <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-black/10" />
            <div className="flex items-center justify-between px-5 pb-2">
              <h2 className="text-lg font-bold">Modifica transazione</h2>
              <button
                type="button"
                aria-label="Chiudi"
                onClick={() => setEditingTransaction(null)}
                className="rounded-full p-1.5 text-muted hover:bg-surface-muted"
              >
                <X size={20} />
              </button>
            </div>
            <div className="max-h-[75vh] overflow-y-auto">
              <AddTransactionForm
                categories={categories}
                accounts={accounts}
                initial={{
                  tipo: editingTransaction.tipo,
                  importo: editingTransaction.importo,
                  categoriaId: editingTransaction.categoriaId,
                  accountId: editingTransaction.accountId,
                  descrizione: editingTransaction.descrizione,
                }}
                submitLabel="Salva modifiche"
                onCancel={() => setEditingTransaction(null)}
                onSubmit={handleUpdate}
              />
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
