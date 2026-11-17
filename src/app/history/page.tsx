'use client';

import { useEffect, useRef, useState } from 'react';
import { useThrowToBoundary } from '@/lib/useThrowToBoundary';
import { Pencil, Trash2 } from 'lucide-react';
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
import { formatEuro } from '@/lib/format';
import { CATEGORY_COLOR_FALLBACK } from '@/lib/categoryColors';
import { useEliminaConAnnulla } from '../AnnullaProvider';
import { CoverHeader } from '../CoverHeader';
import { FoglioInferiore } from '../FoglioInferiore';
import { PallinoCategoria } from '../home/PallinoCategoria';
import { giornoEMese } from '../home/formati';
import { raggruppaPerGiorno } from './raggruppaPerGiorno';
import { HistoryChartCard } from './HistoryChartCard';
import { StoricoCasa } from './StoricoCasa';
import { PeriodoFilter } from './PeriodoFilter';
import { AddTransactionForm } from '../add/AddTransactionForm';
import type { Transaction, Category, Account, BudgetGoal, TransactionTipo } from '@/lib/types';

export default function HistoryPage() {
  const fail = useThrowToBoundary();
  const eliminaConAnnulla = useEliminaConAnnulla();
  // Righe tolte alla vista in attesa della scrittura vera: Annulla le rimette al loro posto.
  const [nascoste, setNascoste] = useState<Set<string>>(new Set());
  const [erroreSaldo, setErroreSaldo] = useState(false);
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

  function handleDelete(t: Transaction) {
    const cambia = (nascondi: boolean) =>
      setNascoste((prima) => {
        const dopo = new Set(prima);
        if (nascondi) dopo.add(t.id);
        else dopo.delete(t.id);
        return dopo;
      });
    eliminaConAnnulla({
      id: t.id,
      testo: t.tipo === 'income' ? 'Entrata eliminata.' : 'Spesa eliminata.',
      nascondi: () => cambia(true),
      ripristina: () => cambia(false),
      esegui: async () => {
        const supabase = createClient();
        await deleteTransaction(supabase, t.id);
        try {
          await applicaAggiornamentiSaldo(
            { accountId: t.accountId, tipo: t.tipo, importo: t.importo },
            { accountId: null, tipo: t.tipo, importo: 0 }
          );
        } catch {
          // La riga è già cancellata: non va rimessa. Si ricarica lo stato vero e si avvisa.
          setErroreSaldo(true);
          await refresh().catch(() => {});
          return;
        }
        setErroreSaldo(false);
        await refresh();
      },
    });
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
    transactions.filter((t) => !nascoste.has(t.id)),
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
  const giorni = raggruppaPerGiorno(transactionsFiltrate);
  const annoCorrente = new Date().getFullYear();
  const titoloGiorno = (data: string) =>
    Number(data.slice(0, 4)) === annoCorrente ? giornoEMese(data) : `${giornoEMese(data)} ${data.slice(0, 4)}`;

  const BOTTONE_ICONA =
    'flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-2 hover:bg-brand-tint';

  return (
    <>
      <CoverHeader titolo="Storico" />
      <main className="mx-auto flex max-w-md flex-col gap-3.5 px-3 pb-28 pt-3.5">
        {erroreSaldo && (
          <p role="alert" className="rounded-[var(--radius-md)] bg-danger-tint p-3 text-[15px] text-danger">
            Spesa eliminata, ma il saldo del conto non si è aggiornato: controllalo in Conti.
          </p>
        )}

        <PeriodoFilter
          periodo={periodo}
          onChangePeriodo={cambiaPeriodo}
          rangePersonalizzato={rangePersonalizzato}
          onChangeRangePersonalizzato={cambiaRange}
        />

        <HistoryChartCard chartData={chartData} colorByCategoryName={colorByCategoryName} />

        <section className="overflow-hidden rounded-[var(--radius-md)] border border-rule bg-surface">
          <h2 className="sr-only">Movimenti</h2>
          {giorni.map((g) => (
            <div key={g.data} data-giorno={g.data}>
              <div className="flex items-baseline justify-between gap-3 border-b border-rule px-4 py-2.5">
                <h3 className="text-[13px] font-semibold text-ink-2">{titoloGiorno(g.data)}</h3>
                <p className="num text-[13px] font-semibold">
                  <span className="sr-only">Totale del giorno </span>
                  {g.totale === 0 ? '' : g.totale < 0 ? '−' : '+'}
                  {formatEuro(Math.abs(g.totale))}
                </p>
              </div>
              <ul>
                {g.righe.map((t) => (
                  <li
                    key={t.id}
                    data-riga
                    className="flex min-h-12 items-center gap-2 border-b border-rule py-1 pl-4 pr-1 text-[15px]"
                  >
                    <PallinoCategoria colore={t.categoriaId ? (colorByCategoryId.get(t.categoriaId) ?? null) : null} />
                    <span className="min-w-0 flex-1 truncate">{t.descrizione || '(senza descrizione)'}</span>
                    <span className={`num shrink-0 ${t.tipo === 'income' ? 'font-semibold text-brand-dark' : ''}`}>
                      {t.tipo === 'income' ? '+' : '−'}
                      {formatEuro(t.importo)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setEditingTransaction(t)}
                      aria-label="Modifica transazione"
                      className={BOTTONE_ICONA}
                    >
                      <Pencil size={18} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(t)}
                      aria-label="Elimina transazione"
                      className={BOTTONE_ICONA}
                    >
                      <Trash2 size={18} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {caricato && transactionsFiltrate.length === 0 && (
            <p className="px-4 py-5 text-[15px] text-ink-2">
              {transactions.length === 0
                ? 'Il libretto è vuoto: la prima spesa che segni compare qui.'
                : 'Nessun movimento in questo periodo.'}
            </p>
          )}
        </section>

        <StoricoCasa righe={righeNeutreFiltrate} />
      </main>

      {editingTransaction && (
        <FoglioInferiore titolo="Modifica transazione" onClose={() => setEditingTransaction(null)}>
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
        </FoglioInferiore>
      )}
    </>
  );
}
