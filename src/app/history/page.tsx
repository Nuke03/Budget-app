'use client';

import { useEffect, useRef, useState } from 'react';
import { useThrowToBoundary } from '@/lib/useThrowToBoundary';
import { Pencil, Trash2, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { getTransactions, updateTransaction, deleteTransaction } from '@/lib/data/transactions';
import { getCategories } from '@/lib/data/categories';
import { getMyHousehold } from '@/lib/data/households';
import { getTransfers } from '@/lib/data/transfers';
import { casa, PERSONALE } from '@/lib/data/scope';
import { inizioStorico } from '@/lib/calculations/filterTransactionsByPeriodo';
import { leggiSessione } from '@/lib/utenteOLogin';
import { righeNeutreStorico, type RigaNeutra } from '@/lib/calculations/casa/righeNeutre';
import { getAccounts, adjustAccountBalance } from '@/lib/data/accounts';
import { getOpenGoals, createGoal } from '@/lib/data/goals';
import { aggregateByCategory } from '@/lib/calculations/aggregateByCategory';
import { filterTransactionsByPeriodo, type Periodo } from '@/lib/calculations/filterTransactionsByPeriodo';
import { deltaPerModifica } from '@/lib/calculations/accountBalance';
import { formatEuro, formatDateIt } from '@/lib/format';
import { CATEGORY_COLOR_FALLBACK } from '@/lib/categoryColors';
import { HistoryChartCard } from './HistoryChartCard';
import { StoricoCasa } from './StoricoCasa';
import { PeriodoFilter } from './PeriodoFilter';
import { AddTransactionForm } from '../add/AddTransactionForm';
import type { Transaction, Category, Account, BudgetGoal, TransactionTipo } from '@/lib/types';

export default function HistoryPage() {
  const fail = useThrowToBoundary();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [goals, setGoals] = useState<BudgetGoal[]>([]);
  const [righeNeutre, setRigheNeutre] = useState<RigaNeutra[]>([]);
  const [periodo, setPeriodo] = useState<Periodo>('mese');
  const [rangePersonalizzato, setRangePersonalizzato] = useState({ da: '', a: '' });
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [caricato, setCaricato] = useState(false);
  // Da quale giorno sono lette le righe: l'ultimo anno copre tutti i periodi fissi; un periodo
  // personalizzato più vecchio allarga la lettura ('' vuol dire tutto lo storico).
  const [letteDal, setLetteDal] = useState(() => inizioStorico(new Date()));
  // Solo la lettura più recente aggiorna la pagina: una risposta vecchia arrivata dopo non la sovrascrive.
  const ultimaLettura = useRef(0);

  async function refresh(da: string = letteDal) {
    const lettura = ++ultimaLettura.current;
    const supabase = createClient();
    // La parte di casa è solo un di più: se non si legge, lo storico personale resta intero.
    // Parte insieme a quella personale, senza aspettarla.
    const casaInCorso = caricaRigheCasa(supabase, da).catch(() => [] as RigaNeutra[]);
    const [tx, cats, accs, openGoals] = await Promise.all([
      getTransactions(supabase, PERSONALE, { da }),
      getCategories(supabase),
      getAccounts(supabase),
      getOpenGoals(supabase),
    ]);
    if (lettura !== ultimaLettura.current) return;
    setTransactions(tx);
    setCategories(cats);
    setAccounts(accs);
    setGoals(openGoals);
    setLetteDal(da);
    setCaricato(true);
    const righeCasa = await casaInCorso;
    if (lettura === ultimaLettura.current) setRigheNeutre(righeCasa);
  }

  async function caricaRigheCasa(supabase: ReturnType<typeof createClient>, da: string): Promise<RigaNeutra[]> {
    const { userId } = await leggiSessione(supabase);
    const casaCorrente = userId ? await getMyHousehold(supabase, userId) : null;
    if (!userId || !casaCorrente) return [];
    const scope = casa(casaCorrente.household.id);
    const [txCasa, trasferimenti] = await Promise.all([
      getTransactions(supabase, scope, { da }),
      getTransfers(supabase, scope),
    ]);
    const nomi = Object.fromEntries(casaCorrente.members.map((m) => [m.userId, m.displayName]));
    return righeNeutreStorico({ userId, transazioni: txCasa, trasferimenti, nomi });
  }

  // Un periodo personalizzato che parte prima delle righe lette allarga la lettura. Finché il
  // periodo non ha entrambe le date si mostra tutto, come prima: serve tutto lo storico.
  function allargaSeServe(p: Periodo, range: { da: string; a: string }) {
    if (p !== 'personalizzato') return;
    const serveDal = range.da && range.a ? range.da : '';
    if (serveDal >= letteDal) return;
    refresh(serveDal).catch(fail);
  }

  function cambiaPeriodo(p: Periodo) {
    setPeriodo(p);
    allargaSeServe(p, rangePersonalizzato);
  }

  function cambiaRange(range: { da: string; a: string }) {
    setRangePersonalizzato(range);
    allargaSeServe(periodo, range);
  }

  async function handleCreateGoal(payload: {
    nome: string;
    importoTarget: number;
    categoriaId: string | null;
  }) {
    const supabase = createClient();
    return createGoal(supabase, {
      nome: payload.nome,
      importoTarget: payload.importoTarget,
      modalita: 'bloccato',
      scadenza: null,
      categoriaId: payload.categoriaId,
      ricorrente: false,
      frequenzaMesi: null,
    });
  }

  useEffect(() => {
    refresh().catch(fail);
  }, [fail]);

  async function applicaAggiornamentiSaldo(
    vecchia: { accountId: string | null; tipo: TransactionTipo; importo: number },
    nuova: { accountId: string | null; tipo: TransactionTipo; importo: number }
  ) {
    const supabase = createClient();
    // Per differenza: le altre scritture sugli stessi conti (casa, rimborsi) non si perdono.
    for (const { accountId, delta } of deltaPerModifica(vecchia, nuova)) {
      await adjustAccountBalance(supabase, accountId, delta);
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
    goalId: string | null;
    descrizione: string;
  }) {
    if (!editingTransaction) return;
    const supabase = createClient();
    await updateTransaction(supabase, editingTransaction.id, {
      ...payload,
      data: editingTransaction.data,
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
  const righeNeutreFiltrate = filterTransactionsByPeriodo(
    righeNeutre,
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
        onChangePeriodo={cambiaPeriodo}
        rangePersonalizzato={rangePersonalizzato}
        onChangeRangePersonalizzato={cambiaRange}
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
        {caricato && transactionsFiltrate.length === 0 && (
          <p className="rounded-[var(--radius-md)] bg-surface p-4 text-center text-sm text-muted shadow-[var(--shadow-card)]">
            {transactions.length === 0
              ? 'Nessuna transazione ancora.'
              : 'Nessuna transazione in questo periodo.'}
          </p>
        )}
      </ul>

      <StoricoCasa righe={righeNeutreFiltrate} />

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
                goals={goals}
                onCreateGoal={handleCreateGoal}
                initial={{
                  tipo: editingTransaction.tipo,
                  importo: editingTransaction.importo,
                  categoriaId: editingTransaction.categoriaId,
                  accountId: editingTransaction.accountId,
                  goalId: editingTransaction.goalId,
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
