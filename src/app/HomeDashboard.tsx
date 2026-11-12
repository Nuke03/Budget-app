'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatEuro, nomeMese } from '@/lib/format';
import { CoverHeader } from './CoverHeader';
import { AddTransactionSheet } from './add/AddTransactionSheet';
import { AndamentoCard } from './home/AndamentoCard';
import { ConsiglioCard } from './home/ConsiglioCard';
import { DettaglioDisponibile } from './home/DettaglioDisponibile';
import { Registro } from './home/Registro';
import { SchedaNotifiche } from './home/SchedaNotifiche';
import { dividiCifra, giornoEMese } from './home/formati';
import { EVENTO_AGGIUNGI, segnaGestito } from '@/lib/eventoAggiungi';
import { oggiRomaISO } from '@/lib/calculations/casa/oggi';
import type { Andamento } from '@/lib/calculations/supporto/andamento';
import type { Consiglio } from '@/lib/calculations/supporto/consiglio';
import type { Prossimo, RigaLibretto } from '@/lib/calculations/supporto/home';
import type { CasaPerHome } from '@/lib/loadHomeData';
import type { Account, BudgetGoal, Category, Transaction } from '@/lib/types';

// `accantonato` è l'importo effettivamente riservato per l'obiettivo alla data odierna
// (computeAccantonatoFinora): per gli obiettivi "bloccato" coincide con importoTarget,
// per quelli "dilazionato" è la quota maturata finora. È lo stesso valore che
// computeDisponibileLibero sottrae dal saldo, quindi è quello da mostrare nel dettaglio
// per far tornare i conti con la cifra principale.
export interface GoalWithAccantonato extends BudgetGoal {
  accantonato: number;
}

// Scritta dal foglio di aggiunta dopo un salvataggio: l'id della riga appena creata.
const CHIAVE_REGISTRATO = 'libretto:registrato';

// Nelle frasi gli importi tondi si scrivono senza decimali: "45 €".
const euroInFrase = (n: number): string => formatEuro(n).replace(',00', '');

export function HomeDashboard({
  disponibileLibero,
  margineGiornaliero,
  dataTarget,
  accounts,
  categories,
  goals,
  casa = null,
  meUserId,
  oggi = oggiRomaISO(),
  righe,
  storico,
  andamento,
  consiglio,
  prossimo,
  notificheAttive = null,
  chiavePubblica = null,
}: {
  disponibileLibero: number;
  margineGiornaliero: number;
  dataTarget: string;
  accounts: Account[];
  categories: Category[];
  goals: GoalWithAccantonato[];
  casa?: CasaPerHome | null;
  meUserId?: string;
  oggi?: string;
  righe: RigaLibretto[];
  storico?: Pick<Transaction, 'descrizione' | 'categoriaId' | 'data' | 'tipo'>[];
  andamento: Andamento;
  consiglio: Consiglio;
  prossimo: Prossimo | null;
  notificheAttive?: boolean | null;
  chiavePubblica?: string | null;
}) {
  const router = useRouter();
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [registratoId, setRegistratoId] = useState<string | null>(null);
  // Le spese di Casa non stanno nel libretto personale: niente timbro, quindi una riga di conferma.
  const [registratoInCasa, setRegistratoInCasa] = useState(false);
  useEffect(() => {
    if (!registratoInCasa) return;
    const t = setTimeout(() => setRegistratoInCasa(false), 2500);
    return () => clearTimeout(t);
  }, [registratoInCasa]);

  // Il + della barra: apre il foglio; con ?aggiungi=1 (arrivo da un'altra pagina) lo apre al caricamento.
  useEffect(() => {
    const apri = (e: Event) => {
      segnaGestito(e);
      setIsAddOpen(true);
    };
    window.addEventListener(EVENTO_AGGIUNGI, apri);
    if (new URLSearchParams(window.location.search).has('aggiungi')) {
      setIsAddOpen(true);
      router.replace('/');
    }
    return () => window.removeEventListener(EVENTO_AGGIUNGI, apri);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Il timbro: se il foglio ha appena registrato una riga che è fra quelle mostrate.
  useEffect(() => {
    let id: string | null = null;
    try {
      id = window.sessionStorage.getItem(CHIAVE_REGISTRATO);
      if (id !== null) window.sessionStorage.removeItem(CHIAVE_REGISTRATO);
    } catch {
      return;
    }
    if (id !== null && righe.some((r) => r.id === id)) setRegistratoId(id);
  }, [righe]);

  const saldoConti = accounts.filter((a) => a.contaInDisponibile).reduce((t, a) => t + a.saldoAttuale, 0);
  const riservato = Math.round((saldoConti - disponibileLibero) * 100) / 100;
  const contaCasa = (casa?.stato?.riservaVersamento ?? 0) + (casa?.stato?.debitoDaRestituire ?? 0) > 0;
  const { intero, resto } = dividiCifra(formatEuro(disponibileLibero));

  return (
    <>
      <CoverHeader titolo="Il mio libretto" lato={`${nomeMese(oggi)} ${oggi.slice(0, 4)}`} />

      <main className="mx-auto flex max-w-md flex-col gap-3.5 px-3 pb-6">
        <section className="rounded-b-[var(--radius-md)] border border-t-0 border-rule bg-page px-[18px] pb-4 pt-5">
          <p className="text-[13px] text-ink-2">Disponibile libero</p>
          <p data-testid="disponibile" className="num mt-1.5 font-serif text-[56px] font-bold leading-none">
            {intero}
            {resto ? <span className="text-[28px]">{resto}</span> : null}
          </p>
          <p className="mt-2 text-[15px] text-ink-2">
            {margineGiornaliero <= 0 || disponibileLibero <= 0 ? (
              <>Fino al {giornoEMese(dataTarget.slice(0, 10))} conviene spendere solo per il necessario.</>
            ) : (
              <>
                Puoi spendere <b className="num font-semibold text-foreground">{euroInFrase(margineGiornaliero)} al giorno</b> fino al{' '}
                {giornoEMese(dataTarget.slice(0, 10))}
              </>
            )}
          </p>
          <p className="mt-1 text-[15px] text-ink-2">
            Hai {euroInFrase(saldoConti)} sui conti
            {riservato > 0
              ? `, ${euroInFrase(riservato)} ${contaCasa ? 'sono messi da parte o da versare' : 'sono già messi da parte'}`
              : ''}
          </p>
          <button
            type="button"
            aria-expanded={showBreakdown}
            onClick={() => setShowBreakdown((v) => !v)}
            className="-mx-2 mt-1 inline-flex min-h-11 items-center px-2 text-sm font-semibold text-brand-dark"
          >
            Come si calcola?
          </button>
          {showBreakdown ? (
            <div className="mt-1">
              <DettaglioDisponibile accounts={accounts} goals={goals} casa={casa} />
            </div>
          ) : null}
        </section>

        <AndamentoCard andamento={andamento} />

        <Registro righe={righe} registratoId={registratoId} />
        <p aria-live="polite" className="sr-only">
          {registratoId ? `Registrato. Disponibile ora ${euroInFrase(disponibileLibero)}` : ''}
        </p>
        <p role="status" aria-live="polite" className={registratoInCasa ? 'text-center text-[15px] font-semibold text-brand-dark' : 'sr-only'}>
          {registratoInCasa ? 'Registrato in Casa' : ''}
        </p>

        {prossimo ? (
          <Link
            href={prossimo.href}
            className="block min-h-11 rounded-[var(--radius-md)] border border-rule bg-surface-muted p-4 text-[15px]"
          >
            <b className="font-semibold text-brand-dark">Prossimo:</b> {prossimo.testo}
          </Link>
        ) : null}

        <ConsiglioCard consiglio={consiglio} />

        <SchedaNotifiche chiavePubblica={chiavePubblica} notificheAttive={notificheAttive} />
      </main>

      <AddTransactionSheet
        aperto={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        personale={{ categories, accounts, goals }}
        casa={casa?.aggiunta ?? null}
        contiPersonali={accounts}
        meUserId={meUserId}
        storico={storico}
        onSaved={(_id, spazio) => {
          if (spazio === 'casa') setRegistratoInCasa(true);
          router.refresh();
        }}
      />
    </>
  );
}
