'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { formatEuro, nomeMese } from '@/lib/format';
import { CoverHeader } from './CoverHeader';
import { GiroBarra } from './fumetti/GiroBarra';
import { AddTransactionSheet } from './add/AddTransactionSheet';
import { SpostaFoglio } from './sposta/SpostaFoglio';
import { RimettiARateFoglio, type DestinazioneRientro } from './rientri/RimettiARateFoglio';
import { contoDaCuiSpostare } from './piva/PromptQuota';
import { AndamentoCard } from './home/AndamentoCard';
import { ConsiglioCard } from './home/ConsiglioCard';
import { DaSapere } from './home/DaSapere';
import { PrimiPassiCard } from './home/PrimiPassiCard';
import { DettaglioDisponibile } from './home/DettaglioDisponibile';
import { Registro } from './home/Registro';
import { SchedaNotifiche } from './home/SchedaNotifiche';
import { dividiCifra, giornoEMese } from './home/formati';
import { EVENTO_AGGIUNGI, segnaGestito, type DettaglioAggiungi } from '@/lib/eventoAggiungi';
import { oggiRomaISO } from '@/lib/calculations/casa/oggi';
import { useSegnalaCasaSeCe } from './CasaSegnale';
import { usePromemoriaRimandati } from './casa/rimandaPromemoria';
import { prossimaCosa, type InputProssimaCosa } from '@/lib/calculations/supporto/home';
import type { PrimiPassi } from '@/lib/calculations/percorso/passi';
import type { ArgomentoId } from '@/lib/percorso/tipi';
import type { Andamento } from '@/lib/calculations/supporto/andamento';
import type { Consiglio } from '@/lib/calculations/supporto/consiglio';
import type { Prossimo, RigaLibretto } from '@/lib/calculations/supporto/home';
import type { CasaPerHome, PivaHome } from '@/lib/loadHomeData';
import { totaleInSospeso } from '@/lib/calculations/piva';
import { maturatoPerCassetto, type Rientro, type SituazioneRientroConto } from '@/lib/calculations/rientri';
import type { Account, BudgetGoal, Category, Transaction } from '@/lib/types';

// `accantonato` è l'importo effettivamente riservato per l'obiettivo alla data odierna
// (computeAccantonatoFinora): per gli obiettivi "bloccato" coincide con importoTarget,
// per quelli "dilazionato" è la quota maturata finora. È lo stesso valore che
// computeDisponibileLibero sottrae dal saldo, quindi è quello da mostrare nel dettaglio
// per far tornare i conti con la cifra principale.
export interface GoalWithAccantonato extends BudgetGoal {
  accantonato: number;
  // Le spese collegate al cassetto (assente = non lette): da qui la cifra proposta in "Rimetti a rate".
  specoCollegato?: number;
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
  piva = null,
  pivaNonLetta = false,
  meUserId,
  oggi = oggiRomaISO(),
  righe,
  storico,
  andamento,
  consiglio,
  prossimo: prossimoServer,
  prossimoDati = null,
  riservaRientri = 0,
  rientriConti = [],
  rientri = [],
  notificheAttive = null,
  chiavePubblica = null,
  primiPassi = null,
  lezioneDelGiorno = null,
}: {
  disponibileLibero: number;
  margineGiornaliero: number;
  dataTarget: string;
  accounts: Account[];
  categories: Category[];
  goals: GoalWithAccantonato[];
  casa?: CasaPerHome | null;
  piva?: PivaHome | null;
  // La P.IVA non si è riusciuta a leggere: il disponibile non conta le tasse, e lo si dice.
  pivaNonLetta?: boolean;
  meUserId?: string;
  oggi?: string;
  righe: RigaLibretto[];
  storico?: Pick<Transaction, 'descrizione' | 'categoriaId' | 'data' | 'tipo'>[];
  andamento: Andamento;
  consiglio: Consiglio;
  prossimo: Prossimo | null;
  // I dati da cui il server ha calcolato `prossimo`: col browser si tolgono anche i promemoria rimandati solo qui.
  prossimoDati?: InputProssimaCosa | null;
  // Le somme dei rientri verso i conti risparmio non ancora spostate (già tolte dal disponibile).
  riservaRientri?: number;
  // I rientri verso i conti risparmio: da qui il foglio "Sposta" si apre già compilato.
  rientriConti?: SituazioneRientroConto[];
  // Tutti i rientri personali: da qui quanto resta da rimettere in un cassetto.
  rientri?: Rientro[];
  notificheAttive?: boolean | null;
  chiavePubblica?: string | null;
  primiPassi?: PrimiPassi | null;
  lezioneDelGiorno?: ArgomentoId | null;
}) {
  const router = useRouter();
  const parametri = useSearchParams();
  const spostaParam = parametri.get('sposta');
  const rimettiParam = parametri.get('rimetti');
  // Il server toglie i "Più tardi" del database; il browser toglie anche quelli che il telefono ha solo in
  // localStorage (stessa memoria della Casa) e ricalcola il prossimo passo.
  const promemoriaCasa = prossimoDati?.promemoriaCasa ?? [];
  const { rimandati } = usePromemoriaRimandati(
    promemoriaCasa.flatMap((p) => (p.id ? [p.id] : [])),
    oggi ?? oggiRomaISO()
  );
  const casaVisibile = promemoriaCasa.filter((p) => !(p.id && rimandati.has(p.id)));
  const prossimo = prossimoDati
    ? prossimaCosa({ ...prossimoDati, promemoriaCasa: casaVisibile })
    : prossimoServer;
  // La barra segna la Casa se c'è un promemoria della casa non rimandato, anche se il prossimo passo è altro.
  useSegnalaCasaSeCe(prossimoDati ? casaVisibile.length > 0 : prossimoServer?.tipo === 'casa');
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  // "Entrata" dal menu: il foglio si apre già su Entrata. Si imposta all'apertura, non alla chiusura:
  // cambiarla alla chiusura ricreerebbe il foglio e perderebbe la quota delle tasse dopo il salvataggio.
  const [aggiuntaIniziale, setAggiuntaIniziale] = useState<{ tipo: 'income'; categoriaId: null } | null>(null);
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
      const tipo = (e as CustomEvent<DettaglioAggiungi>).detail?.tipo;
      setAggiuntaIniziale(tipo === 'income' ? { tipo: 'income', categoriaId: null } : null);
      setIsAddOpen(true);
    };
    window.addEventListener(EVENTO_AGGIUNGI, apri);
    const parametri = new URLSearchParams(window.location.search);
    if (parametri.has('aggiungi')) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- l'ingresso arriva dall'indirizzo, al caricamento della Home
      if (parametri.get('aggiungi') === 'entrata') setAggiuntaIniziale({ tipo: 'income', categoriaId: null });
      setIsAddOpen(true);
      router.replace('/');
    }
    return () => window.removeEventListener(EVENTO_AGGIUNGI, apri);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // "Sposta tra i tuoi conti": dal menu (?sposta=1) vuoto, da "Prossimo" (?sposta=<rientro>) già compilato.
  // Si legge dall'indirizzo a ogni cambio, poi lo si ripulisce: lo stesso ingresso si può usare di nuovo.
  const [spostaAperto, setSpostaAperto] = useState<{ chiave: number; daRientro?: boolean; iniziale?: { daAccountId?: string; aAccountId?: string; importo?: number } } | null>(null);
  useEffect(() => {
    if (!spostaParam) return;
    const situazione = rientriConti.find((s) => s.rientro.id === spostaParam && s.rientro.accountId);
    const da = situazione ? contoDaCuiSpostare(null, accounts, piva?.contoTasseId ?? '') : null;
    const iniziale = situazione
      ? {
          ...(da ? { daAccountId: da } : {}),
          aAccountId: situazione.rientro.accountId!,
          ...(situazione.daSpostare > 0 ? { importo: situazione.daSpostare } : {}),
        }
      : undefined;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- l'ingresso arriva dall'indirizzo
    setSpostaAperto({ chiave: Date.now(), iniziale, daRientro: !!situazione });
    router.replace('/');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spostaParam]);

  // "Rimetti a rate": dal menu (?rimetti=1) senza scelta, da un cassetto (?rimetti=<id>) con quel cassetto già scelto.
  const [rimettiAperto, setRimettiAperto] = useState<{ chiave: number; scelta?: string } | null>(null);
  useEffect(() => {
    if (!rimettiParam) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- l'ingresso arriva dall'indirizzo
    setRimettiAperto({ chiave: Date.now(), scelta: rimettiParam === '1' ? undefined : rimettiParam });
    router.replace('/');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rimettiParam]);

  // Dove si può rimettere: conti risparmio (non il conto tasse), cassetti aperti, cassetti aperti della casa.
  const destinazioniRientro: DestinazioneRientro[] = [
    ...accounts
      .filter((a) => !a.archiviato && !a.contaInDisponibile && a.id !== (piva?.contoTasseId ?? ''))
      .map((a): DestinazioneRientro => ({ tipo: 'conto', id: a.id, nome: a.nome })),
    ...goals
      .filter((g) => g.stato === 'aperto')
      .map((g): DestinazioneRientro => ({
        tipo: 'cassetto',
        id: g.id,
        nome: g.nome,
        spesoDaRientrare: Math.max(0, Math.round(((g.specoCollegato ?? 0) - maturatoPerCassetto(rientri, g.id, oggi)) * 100) / 100),
      })),
    ...(casa?.aggiunta?.obiettivi ?? [])
      .filter((g) => g.stato === 'aperto')
      .map((g): DestinazioneRientro => ({
        tipo: 'cassetto-casa',
        id: g.id,
        nome: g.nome,
        householdId: casa!.aggiunta!.householdId,
      })),
  ];
  const altriDiCasa = (casa?.aggiunta?.nomi ?? []).filter((n) => n.userId !== casa?.aggiunta?.meUserId).map((n) => n.nome);
  const notaCasa = altriDiCasa.length > 0 ? `Lo vedrà anche ${altriDiCasa.join(' e ')}.` : undefined;

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
  // Il cuscinetto dello stipendio si mostra a parte: non è "messo da parte" come obiettivi, casa e tasse.
  const cuscinetto = piva?.stipendio?.cuscinetto ?? 0;
  const riservato = Math.round((saldoConti - disponibileLibero - cuscinetto) * 100) / 100;
  const contaCasa = (casa?.stato?.riservaVersamento ?? 0) + (casa?.stato?.debitoDaRestituire ?? 0) > 0;
  const riservaPiva = piva ? totaleInSospeso(piva.inSospeso) : 0;
  const { intero, resto } = dividiCifra(formatEuro(disponibileLibero));
  // Il cuscinetto è finito e lo stipendio fisso è più alto di quello che c'è: si invita a rivederlo, senza allarmi.
  const cuscinettoVuoto =
    !!piva?.stipendio && piva.stipendio.cuscinetto === 0 && piva.stipendio.rimasto > disponibileLibero;

  return (
    <>
      <GiroBarra haCasa={!!casa} />
      <CoverHeader titolo="Il mio libretto" lato={`${nomeMese(oggi)} ${oggi.slice(0, 4)}`} />

      <main className="mx-auto flex max-w-md flex-col gap-3.5 px-3 pb-6">
        <section className="rounded-b-[var(--radius-md)] border border-t-0 border-rule bg-page px-[18px] pb-4 pt-5">
          <p className="text-[13px] text-ink-2">{piva?.stipendio ? 'Ti restano per questo mese' : 'Disponibile libero'}</p>
          <p data-testid="disponibile" data-fumetto="disponibile" className="num mt-1.5 font-serif text-[56px] font-bold leading-none">
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
            {cuscinetto > 0 ? `, ${euroInFrase(cuscinetto)} di cuscinetto` : ''}
          </p>
          {piva?.stipendio?.frase ? <p className="mt-1 text-[15px] text-ink-2">{piva.stipendio.frase}</p> : null}
          {pivaNonLetta ? (
            <p className="mt-1 text-[15px] text-ink-2">Il disponibile non conta le tasse: non riesco a leggere la P.IVA.</p>
          ) : null}
          {cuscinettoVuoto ? (
            <Link href="/piva" className="mt-1 block min-h-11 py-2 text-[15px] font-semibold text-brand-dark">
              Il cuscinetto per ora è finito: questo mese lo stipendio è più di quello che hai. Lo rivediamo insieme?
            </Link>
          ) : null}
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
              <DettaglioDisponibile accounts={accounts} goals={goals} casa={casa} riservaPiva={riservaPiva} cuscinetto={cuscinetto} daSpostare={riservaRientri} />
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

        {primiPassi?.visibile ? (
          <PrimiPassiCard primiPassi={primiPassi} />
        ) : (
          <>
            <ConsiglioCard consiglio={consiglio} />
            {lezioneDelGiorno ? <DaSapere id={lezioneDelGiorno} /> : null}
          </>
        )}

        <SchedaNotifiche chiavePubblica={chiavePubblica} notificheAttive={notificheAttive} />
      </main>

      {spostaAperto ? (
        <SpostaFoglio
          key={spostaAperto.chiave}
          conti={accounts}
          iniziale={spostaAperto.iniziale}
          daRientro={spostaAperto.daRientro}
          onClose={() => setSpostaAperto(null)}
          onFatto={() => {
            setSpostaAperto(null);
            router.refresh();
          }}
        />
      ) : null}

      {rimettiAperto ? (
        <RimettiARateFoglio
          key={rimettiAperto.chiave}
          destinazioni={destinazioniRientro}
          scelta={rimettiAperto.scelta}
          notaCasa={notaCasa}
          onClose={() => setRimettiAperto(null)}
          onFatto={() => {
            setRimettiAperto(null);
            router.refresh();
          }}
        />
      ) : null}

      <AddTransactionSheet
        key={aggiuntaIniziale ? 'entrata' : 'aggiunta'}
        aperto={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        modoIniziale={aggiuntaIniziale ? 'personale' : undefined}
        iniziale={aggiuntaIniziale ?? undefined}
        personale={{ categories, accounts, goals }}
        casa={casa?.aggiunta ?? null}
        contiPersonali={accounts}
        meUserId={meUserId}
        storico={storico}
        piva={
          piva
            ? { categoriaFatturatoId: piva.categoriaFatturatoId, percentuale: piva.percentuale, contoTasseId: piva.contoTasseId }
            : null
        }
        onAccantonato={() => router.refresh()}
        onSaved={(_id, spazio) => {
          if (spazio === 'casa') setRegistratoInCasa(true);
          router.refresh();
        }}
      />
    </>
  );
}
