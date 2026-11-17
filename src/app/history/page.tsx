'use client';

import { useEffect, useRef, useState } from 'react';
import { useThrowToBoundary } from '@/lib/useThrowToBoundary';
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
import { filterTransactionsByPeriodo, type Periodo } from '@/lib/calculations/filterTransactionsByPeriodo';
import { deltaPerModifica } from '@/lib/calculations/accountBalance';
import { useEliminaConAnnulla } from '../AnnullaProvider';
import { FoglioInferiore } from '../FoglioInferiore';
import { StoricoVista } from './StoricoVista';
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
  // Lo stesso valore, letto al momento di ricaricare: la scrittura rimandata parte dopo qualche secondo.
  const letteDalRef = useRef(letteDal);
  letteDalRef.current = letteDal;

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
        const cancellate = await deleteTransaction(supabase, t.id);
        // Da qui la riga è cancellata: niente più eccezioni, o un nuovo tentativo sposterebbe il saldo due volte.
        if (cancellate > 0) {
          try {
            await applicaAggiornamentiSaldo(
              { accountId: t.accountId, tipo: t.tipo, importo: t.importo },
              { accountId: null, tipo: t.tipo, importo: 0 }
            );
          } catch {
            // La riga è già cancellata: non va rimessa. Si ricarica lo stato vero e si avvisa.
            setErroreSaldo(true);
            await refresh(letteDalRef.current).catch(() => {});
            return;
          }
        }
        setErroreSaldo(false);
        await refresh(letteDalRef.current).catch(() => {});
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
  return (
    <>
      <StoricoVista
        transactionsFiltrate={transactionsFiltrate}
        transactionsTotali={transactions.length}
        righeNeutreFiltrate={righeNeutreFiltrate}
        categories={categories}
        caricato={caricato}
        erroreSaldo={erroreSaldo}
        periodo={periodo}
        rangePersonalizzato={rangePersonalizzato}
        onChangePeriodo={cambiaPeriodo}
        onChangeRange={cambiaRange}
        onEdit={setEditingTransaction}
        onDelete={handleDelete}
      />

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
