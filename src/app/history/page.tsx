'use client';

import { aggiungiQuotaDaRiportare, ascoltaQuoteDaRiportare, quoteDaRiportare, togliQuotaDaRiportare, type QuotaDaRiportare } from '@/lib/quoteDaRiportare';
import { useEffect, useRef, useState } from 'react';
import { useThrowToBoundary } from '@/lib/useThrowToBoundary';
import { createClient } from '@/lib/supabase/client';
import { getTransactions, modificaMovimento, eliminaMovimento } from '@/lib/data/transactions';
import { getCategories } from '@/lib/data/categories';
import { getMyHousehold } from '@/lib/data/households';
import { getTransfers } from '@/lib/data/transfers';
import { casa, PERSONALE } from '@/lib/data/scope';
import { inizioStorico } from '@/lib/calculations/filterTransactionsByPeriodo';
import { leggiSessione } from '@/lib/utenteOLogin';
import { righeNeutreAccantonamenti, righeNeutreStorico, type RigaNeutra } from '@/lib/calculations/casa/righeNeutre';
import { getPivaSettings } from '@/lib/data/pivaSettings';
import { annullaAccantonamento, getAccantonamenti } from '@/lib/data/piva';
import { getAccounts, getContiArchiviati } from '@/lib/data/accounts';
import { annullaSpostamento, getSpostamenti } from '@/lib/data/spostamenti';
import { getOpenGoals, createGoal } from '@/lib/data/goals';
import { filterTransactionsByPeriodo, type Periodo } from '@/lib/calculations/filterTransactionsByPeriodo';
import { useEliminaConAnnulla } from '../AnnullaProvider';
import { FoglioInferiore } from '../FoglioInferiore';
import { StoricoVista, type RigaSpostamento } from './StoricoVista';
import { AddTransactionForm } from '../add/AddTransactionForm';
import { euroInFrase } from '@/lib/format';
import { CLASSE_NEUTRO, CLASSE_PRIMARIO } from '../casa/CampiMovimento';
import type { Spostamento } from '@/lib/calculations/rientri';
import type { Transaction, Category, Account, BudgetGoal, TransactionTipo, PivaAccantonamento } from '@/lib/types';

export default function HistoryPage() {
  const fail = useThrowToBoundary();
  const eliminaConAnnulla = useEliminaConAnnulla();
  // Righe tolte alla vista in attesa della scrittura vera: Annulla le rimette al loro posto.
  const [nascoste, setNascoste] = useState<Set<string>>(new Set());
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [contiArchiviati, setContiArchiviati] = useState<{ id: string; nome: string }[]>([]);
  const [goals, setGoals] = useState<BudgetGoal[]>([]);
  const [righeNeutre, setRigheNeutre] = useState<RigaNeutra[]>([]);
  const [righeTasse, setRigheTasse] = useState<RigaNeutra[]>([]);
  const [spostamenti, setSpostamenti] = useState<Spostamento[]>([]);
  // Gli spostamenti sul conto tasse letti con lo storico: servono a sapere, prima di eliminare un incasso, se la sua quota è già nel conto.
  const accantonamenti = useRef<PivaAccantonamento[]>([]);
  // Dopo aver eliminato un incasso la cui quota era già nel conto tasse: la domanda con un tocco.
  // Sta nella memoria di sessione: se si lascia lo Storico prima dell'eliminazione, la domanda aspetta la prossima apertura.
  const [codaQuote, setCodaQuote] = useState<QuotaDaRiportare[]>([]);
  const quotaDaRiportare = codaQuote[0] ?? null;
  // La coda è dell'utente che ha eliminato: un altro account sullo stesso browser non la vede.
  const utenteRef = useRef('');
  const setQuotaDaRiportare = (q: null) => {
    if (q === null && quotaDaRiportare) togliQuotaDaRiportare(utenteRef.current, quotaDaRiportare.id);
    // L'errore era della domanda tolta: la prossima parte pulita.
    setRiportoFallito(false);
  };
  const [riportoInCorso, setRiportoInCorso] = useState(false);
  const [riportoFallito, setRiportoFallito] = useState(false);
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
    const tasseInCorso = caricaRigheTasse(supabase, da).catch(() => [] as RigaNeutra[]);
    // Gli spostamenti sono un di più, come la casa: se non si leggono lo storico resta intero.
    const spostamentiInCorso = getSpostamenti(supabase, da || undefined).catch(() => [] as Spostamento[]);
    // Anche i nomi dei conti archiviati, per uno spostamento da o verso di loro.
    const archiviatiInCorso = getContiArchiviati(supabase).catch(() => [] as { id: string; nome: string }[]);
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
    const archiviatiLetti = await archiviatiInCorso;
    if (lettura === ultimaLettura.current) setContiArchiviati(archiviatiLetti);
    const spostamentiLetti = await spostamentiInCorso;
    if (lettura === ultimaLettura.current) setSpostamenti(spostamentiLetti);
    const righeCasa = await casaInCorso;
    if (lettura === ultimaLettura.current) setRigheNeutre(righeCasa);
    const righeDelleTasse = await tasseInCorso;
    if (lettura === ultimaLettura.current) setRigheTasse(righeDelleTasse);
  }

  // Solo chi ha la P.IVA attiva legge gli spostamenti sul conto tasse; per gli altri una lettura sola, delle impostazioni.
  async function caricaRigheTasse(supabase: ReturnType<typeof createClient>, da: string): Promise<RigaNeutra[]> {
    const settings = await getPivaSettings(supabase);
    if (!settings?.attivo) return [];
    const letti = await getAccantonamenti(supabase, { da: da || '0001-01-01' });
    accantonamenti.current = letti;
    return righeNeutreAccantonamenti(letti);
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

  useEffect(() => {
    let vivo = true;
    const rileggi = () => setCodaQuote(quoteDaRiportare(utenteRef.current));
    const stacca = ascoltaQuoteDaRiportare(rileggi);
    leggiSessione(createClient())
      .then(({ userId }) => {
        utenteRef.current = userId ?? '';
        if (vivo) rileggi();
      })
      .catch(() => {});
    return () => {
      vivo = false;
      stacca();
    };
  }, []);

  function handleDelete(t: Transaction) {
    // Si guarda ora, prima che l'eliminazione diventi effettiva: dopo, il database stacca l'incasso dal suo spostamento.
    const spostamento =
      t.tipo === 'income' ? accantonamenti.current.find((a) => a.transactionId === t.id) : undefined;
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
      riprendibile: true,
      esegui: async () => {
        // Una sola rpc: riga e saldo insieme. Se fallisce non è cambiato niente e la riga torna (lo fa AnnullaProvider).
        await eliminaMovimento(createClient(), t.id);
        // L'incasso è andato (anche dopo l'attesa dell'Annulla): ora si chiede della quota rimasta nel conto tasse.
        if (spostamento) {
          setRiportoFallito(false);
          aggiungiQuotaDaRiportare(utenteRef.current, { id: spostamento.id, importo: spostamento.importo });
        }
        await refresh(letteDalRef.current).catch(() => {});
      },
    });
  }

  // Sì: l'rpc annulla_accantonamento rimette i soldi sul conto di partenza.
  async function riportaIndietro() {
    if (!quotaDaRiportare || riportoInCorso) return;
    setRiportoInCorso(true);
    setRiportoFallito(false);
    try {
      await annullaAccantonamento(createClient(), quotaDaRiportare.id);
    } catch {
      setRiportoFallito(true);
      setRiportoInCorso(false);
      return;
    }
    setQuotaDaRiportare(null);
    setRiportoInCorso(false);
    await refresh(letteDalRef.current).catch(() => {});
  }

  // Annullare uno spostamento rimette i soldi sul conto di partenza (lo fa l'rpc).
  function handleEliminaTasse(r: RigaNeutra) {
    const cambia = (nascondi: boolean) =>
      setNascoste((prima) => {
        const dopo = new Set(prima);
        if (nascondi) dopo.add(r.id);
        else dopo.delete(r.id);
        return dopo;
      });
    eliminaConAnnulla({
      id: r.id,
      testo: 'Spostamento annullato.',
      nascondi: () => cambia(true),
      ripristina: () => cambia(false),
      esegui: async () => {
        await annullaAccantonamento(createClient(), r.id.replace(/^pa-/, ''));
        await refresh(letteDalRef.current).catch(() => {});
      },
    });
  }

  // Eliminare uno spostamento rimette i soldi sul conto di partenza (lo fa l'rpc).
  function handleEliminaSpostamento(r: RigaSpostamento) {
    const cambia = (nascondi: boolean) =>
      setNascoste((prima) => {
        const dopo = new Set(prima);
        if (nascondi) dopo.add(r.id);
        else dopo.delete(r.id);
        return dopo;
      });
    eliminaConAnnulla({
      id: r.id,
      testo: 'Spostamento eliminato.',
      nascondi: () => cambia(true),
      ripristina: () => cambia(false),
      esegui: async () => {
        await annullaSpostamento(createClient(), r.id.replace(/^sp-/, ''));
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
    // Una sola rpc con tutti i campi: riga e saldi cambiano insieme o per niente.
    await modificaMovimento(createClient(), editingTransaction.id, {
      ...payload,
      data: editingTransaction.data,
      nota: editingTransaction.nota,
    });
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
  const righeTasseFiltrate = filterTransactionsByPeriodo(
    righeTasse.filter((r) => !nascoste.has(r.id)),
    periodo,
    new Date(),
    rangePersonalizzato
  );
  const nomeConto = (id: string | null) => (accounts.find((a) => a.id === id) ?? contiArchiviati.find((a) => a.id === id))?.nome ?? 'un conto';
  const righeSpostamenti: RigaSpostamento[] = filterTransactionsByPeriodo(
    spostamenti
      .filter((s) => !nascoste.has(`sp-${s.id}`))
      .map((s) => ({
        id: `sp-${s.id}`,
        data: s.data,
        importo: s.importo,
        etichetta: `Spostato da ${nomeConto(s.daAccountId)} a ${nomeConto(s.aAccountId)}`,
      })),
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
        righeTasse={righeTasseFiltrate}
        spostamenti={righeSpostamenti}
        onEliminaSpostamento={handleEliminaSpostamento}
        onEliminaTasse={handleEliminaTasse}
        categories={categories}
        caricato={caricato}
        periodo={periodo}
        rangePersonalizzato={rangePersonalizzato}
        onChangePeriodo={cambiaPeriodo}
        onChangeRange={cambiaRange}
        onEdit={setEditingTransaction}
        onDelete={handleDelete}
      />

      {quotaDaRiportare ? (
        <FoglioInferiore titolo="Conto tasse" onClose={() => !riportoInCorso && setQuotaDaRiportare(null)}>
          <div className="flex flex-col gap-3 px-5 pb-5">
            <p className="num text-[15px]">
              La quota di {euroInFrase(quotaDaRiportare.importo)} è nel conto tasse. La riporto indietro?
            </p>
            {riportoFallito ? (
              <p role="alert" className="text-[15px] font-medium text-danger">
                Non è riuscito. Riprova.
              </p>
            ) : null}
            <button type="button" onClick={() => void riportaIndietro()} disabled={riportoInCorso} className={CLASSE_PRIMARIO}>
              Sì
            </button>
            <button type="button" onClick={() => setQuotaDaRiportare(null)} disabled={riportoInCorso} className={CLASSE_NEUTRO}>
              No
            </button>
          </div>
        </FoglioInferiore>
      ) : null}

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
