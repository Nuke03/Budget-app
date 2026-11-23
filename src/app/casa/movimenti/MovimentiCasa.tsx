'use client';

import { useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';
import { createClient } from '@/lib/supabase/client';
import { eliminaMovimento, modificaMovimento } from '@/lib/data/transactions';
import { deleteTransfer } from '@/lib/data/transfers';
import { descriviTrasferimento } from '@/lib/calculations/casa/descriviTrasferimento';
import { etichettaChiHaPagato } from '@/lib/calculations/casa/etichette';
import { meseRomaISO } from '@/lib/calculations/casa/oggi';
import {
  scopertoAnnullandoVersamento,
  scopertoEliminandoSpesa,
  type Scoperto,
} from '@/lib/calculations/casa/scoperto';
import { formatDateIt, formatEuro } from '@/lib/format';
import type { CasaCorrente } from '@/lib/data/households';
import type { CasaAggiunta } from '@/lib/loadCasaData';
import type { Account, Transaction, TransactionTipo, Transfer } from '@/lib/types';
import { AddTransactionForm } from '../../add/AddTransactionForm';
import { useEliminaConAnnulla } from '../../AnnullaProvider';
import { ConfermaPesante } from '../../ConfermaPesante';
import { CoverHeader } from '../../CoverHeader';
import { serveConferma } from '@/lib/conferme';
import { PallinoCategoria } from '../../home/PallinoCategoria';
import { Campo, CLASSE_CAMPO, CLASSE_LINK, CLASSE_SCHEDA, ErroreMovimento } from '../CampiMovimento';

const ERRORE_SALVATAGGIO =
  'Salvataggio fallito, controlla la connessione e riprova.';

function etichettaMese(mese: string): string {
  return format(parseISO(`${mese}-01`), 'LLLL yyyy', { locale: it });
}

export function MovimentiCasa({
  casa,
  aggiunta,
  transazioni,
  trasferimenti = [],
  meUserId,
  contiPersonali = [],
}: {
  casa: CasaCorrente;
  aggiunta: CasaAggiunta;
  transazioni: Transaction[];
  trasferimenti?: Transfer[];
  meUserId: string;
  // I conti personali di chi guarda: servono per modificare una spesa pagata con la propria carta.
  contiPersonali?: Account[];
}) {
  const router = useRouter();
  const eliminaConAnnulla = useEliminaConAnnulla();
  const [righe, setRighe] = useState<Transaction[]>(transazioni);
  const meseCorrente = meseRomaISO().slice(0, 7);
  const [mosse, setMosse] = useState<Transfer[]>(trasferimenti);
  const [mese, setMese] = useState(meseCorrente);
  const [inModifica, setInModifica] = useState<string | null>(null);
  const [errore, setErrore] = useState(false);
  const [conferma, setConferma] = useState<{ testo: string; procedi: () => void } | null>(null);
  const [pesante, setPesante] = useState<Transfer | null>(null);

  const nomi = Object.fromEntries(aggiunta.nomi.map((n) => [n.userId, n.nome]));
  const mesi = Array.from(
    new Set([
      meseCorrente,
      ...righe.map((t) => t.data.slice(0, 7)),
      ...mosse.map((t) => t.data.slice(0, 7)),
    ]),
  )
    .sort()
    .reverse();
  type Voce =
    { tipo: 'spesa'; t: Transaction } | { tipo: 'trasferimento'; m: Transfer };
  const voci: Voce[] = [
    ...righe
      .filter((t) => t.data.startsWith(mese))
      .map((t): Voce => ({ tipo: 'spesa', t })),
    ...mosse
      .filter((m) => m.data.startsWith(mese))
      .map((m): Voce => ({ tipo: 'trasferimento', m })),
  ].sort((a, b) => {
    const da = a.tipo === 'spesa' ? a.t.data : a.m.data;
    const db = b.tipo === 'spesa' ? b.t.data : b.m.data;
    return da === db ? 0 : da < db ? 1 : -1;
  });
  const puoModificare = (t: Transaction) =>
    !t.pagataDaUserId || t.pagataDaUserId === meUserId;
  // Una spesa pagata con la carta personale: il conto è quello di chi ha pagato e non si cambia (il trigger
  // vieta di cambiare chi ha pagato). Si modifica solo se il conto personale è tra quelli di chi guarda.
  const conCartaPersonale = (t: Transaction) =>
    !!t.accountId && !aggiunta.conti.some((c) => c.id === t.accountId);
  const cartaDi = (t: Transaction): Account | null =>
    conCartaPersonale(t) && t.pagataDaUserId === meUserId
      ? (contiPersonali.find((c) => c.id === t.accountId) ?? null)
      : null;
  const puoModificareForm = (t: Transaction) => !conCartaPersonale(t) || cartaDi(t) !== null;

  function frase(sc: Scoperto, cosa: 'spesa' | 'versamento'): string {
    const nome = (id: string | null) => (id ? (nomi[id] ?? 'Un altro membro') : 'La casa');
    if (sc.tipo === 'credito') {
      return `Questa ${cosa} è già stata rimborsata a ${nome(sc.userId)}. Se la elimini, la casa resta senza ${formatEuro(sc.importo)}: li ha già ricevuti ${nome(sc.userId)}.`;
    }
    return `${nome(sc.userId)} ha già restituito dei soldi a ${nome(sc.controparteId)}. Se annulli il versamento, ${nome(sc.userId)} resta senza ${formatEuro(sc.importo)}: li ha già ricevuti ${nome(sc.controparteId)}.`;
  }

  // Se togliere il movimento lascia qualcuno senza soldi già restituiti, prima si chiede conferma.
  function chiediAnnulla(m: Transfer) {
    const sc = scopertoAnnullandoVersamento(m, mosse);
    if (sc) return setConferma({ testo: frase(sc, 'versamento'), procedi: () => void annulla(m) });
    if (serveConferma('movimento_casa')) return setPesante(m);
    annulla(m);
  }

  function chiediElimina(t: Transaction) {
    const sc = scopertoEliminandoSpesa(t, righe, mosse);
    if (!sc) return void elimina(t);
    setConferma({ testo: frase(sc, 'spesa'), procedi: () => void elimina(t) });
  }

  function fraseMovimento(m: Transfer): string {
    const cosa = m.causale === 'rimborso' ? 'rimborso' : m.causale === 'restituzione' ? 'importo restituito' : 'versamento';
    return `Il ${cosa} di ${formatEuro(m.importo)} sparisce anche dai saldi dei conti. Puoi comunque annullare per qualche secondo.`;
  }

  function annulla(m: Transfer) {
    const posizione = mosse.findIndex((x) => x.id === m.id);
    setErrore(false);
    setConferma(null);
    eliminaConAnnulla({
      id: m.id,
      testo: 'Movimento eliminato.',
      nascondi: () => setMosse((r) => r.filter((x) => x.id !== m.id)),
      ripristina: () =>
        setMosse((r) => {
          if (r.some((x) => x.id === m.id)) return r;
          const copia = [...r];
          copia.splice(Math.min(posizione, copia.length), 0, m);
          return copia;
        }),
      esegui: async () => {
        await deleteTransfer(createClient(), m.id);
      },
    });
  }

  function elimina(t: Transaction) {
    const posizione = righe.findIndex((r) => r.id === t.id);
    setErrore(false);
    setConferma(null);
    eliminaConAnnulla({
      id: t.id,
      testo: t.tipo === 'expense' ? 'Spesa eliminata.' : 'Entrata eliminata.',
      nascondi: () => setRighe((r) => r.filter((x) => x.id !== t.id)),
      ripristina: () =>
        setRighe((r) => {
          if (r.some((x) => x.id === t.id)) return r;
          const copia = [...r];
          copia.splice(Math.min(posizione, copia.length), 0, t);
          return copia;
        }),
      riprendibile: true,
      esegui: async () => {
        // Una sola rpc: riga e saldo insieme. Se fallisce non è cambiato niente e la riga torna (lo fa AnnullaProvider).
        await eliminaMovimento(createClient(), t.id);
      },
    });
  }

  async function salva(
    t: Transaction,
    payload: {
      tipo: TransactionTipo;
      importo: number;
      categoriaId: string | null;
      accountId: string | null;
      goalId: string | null;
      descrizione: string;
    },
  ) {
    const nuova: Transaction = { ...t, ...payload };
    setErrore(false);
    setRighe((r) => r.map((x) => (x.id === t.id ? nuova : x)));
    setInModifica(null);
    try {
      // Una sola rpc con tutti i campi: riga e saldi cambiano insieme o per niente.
      await modificaMovimento(createClient(), t.id, {
        tipo: payload.tipo,
        importo: payload.importo,
        data: t.data,
        categoriaId: payload.categoriaId,
        accountId: payload.accountId,
        goalId: payload.goalId,
        descrizione: payload.descrizione,
        nota: t.nota,
      });
      router.refresh();
    } catch {
      // Non è cambiato niente: si torna alla riga di prima e si avvisa.
      setErrore(true);
      setRighe((r) => r.map((x) => (x.id === t.id ? t : x)));
    }
  }

  const RIGA = 'flex flex-col gap-2 border-b border-rule px-4 py-3 last:border-b-0';
  const AZIONE = 'inline-flex min-h-11 items-center text-[15px] font-semibold';

  return (
    <>
      <CoverHeader titolo="Movimenti di casa" lato={casa.household.nome} />
      <main className="mx-auto flex max-w-md flex-col gap-3.5 px-3 pb-6 pt-3.5">
        <Link href="/casa" className={CLASSE_LINK}>
          <ChevronLeft size={18} aria-hidden="true" className="shrink-0" />
          La casa
        </Link>

        <Campo etichetta="Mese">
          <select value={mese} onChange={(e) => setMese(e.target.value)} className={CLASSE_CAMPO}>
            {mesi.map((m) => (
              <option key={m} value={m}>
                {etichettaMese(m)}
              </option>
            ))}
          </select>
        </Campo>

        <ErroreMovimento testo={errore ? ERRORE_SALVATAGGIO : null} />

        {pesante && (
          <ConfermaPesante
            titolo="Eliminare questo movimento?"
            frase={fraseMovimento(pesante)}
            tipo="movimento_casa"
            onConferma={() => {
              const m = pesante;
              setPesante(null);
              annulla(m);
            }}
            onChiudi={() => setPesante(null)}
          />
        )}

        {conferma && (
          <section aria-label="Conferma" className={`${CLASSE_SCHEDA} text-[15px]`}>
            <p>{conferma.testo}</p>
            <div className="flex gap-4">
              <button type="button" onClick={conferma.procedi} className={`${AZIONE} text-danger`}>
                Procedi lo stesso
              </button>
              <button type="button" onClick={() => setConferma(null)} className={`${AZIONE} text-brand-dark`}>
                Lascia com&apos;è
              </button>
            </div>
          </section>
        )}

        {voci.length === 0 ? (
          <section className={CLASSE_SCHEDA}>
            <p className="text-[15px] text-ink-2">Nessun movimento in questo mese.</p>
          </section>
        ) : (
          <ul className="overflow-hidden rounded-[var(--radius-md)] border border-rule bg-surface">
            {voci.map((voce) => {
              if (voce.tipo === 'trasferimento') {
                const m = voce.m;
                const { titolo, dettaglio } = descriviTrasferimento(m, nomi);
                return (
                  <li key={`tr-${m.id}`} className={`${RIGA} bg-brand-tint`}>
                    <div className="flex justify-between gap-3">
                      <div className="flex min-w-0 flex-col">
                        <span className="text-[15px] font-semibold">{titolo}</span>
                        <span className="num text-[13px] text-ink-2">
                          {formatDateIt(m.data)}
                          {dettaglio ? ` · ${dettaglio}` : ''}
                        </span>
                      </div>
                      <span className="num text-[15px] text-ink-2">{formatEuro(m.importo)}</span>
                    </div>
                    {m.userId === meUserId && (
                      <div className="flex gap-4">
                        <button type="button" onClick={() => chiediAnnulla(m)} className={`${AZIONE} text-brand-dark`}>
                          Annulla
                        </button>
                      </div>
                    )}
                  </li>
                );
              }
              const t = voce.t;
              const cat = aggiunta.categorie.find((c) => c.id === t.categoriaId);
              const carta = cartaDi(t);
              return (
                <li key={t.id} className={RIGA}>
                  {inModifica === t.id ? (
                    <div className="-mx-4">
                      <AddTransactionForm
                        categories={aggiunta.categorie}
                        accounts={carta ? [{ ...carta, nome: `Io, con ${carta.nome}` }] : aggiunta.conti}
                        tipoFisso={!!carta}
                        goals={aggiunta.obiettivi}
                        initial={{
                          tipo: t.tipo,
                          importo: t.importo,
                          categoriaId: t.categoriaId,
                          accountId: t.accountId,
                          goalId: t.goalId,
                          descrizione: t.descrizione,
                        }}
                        contoEtichetta="Chi ha pagato"
                        obiettivoEtichetta="Da parte (opzionale)"
                        nascondiGestisciCategorie
                        submitLabel="Salva modifiche"
                        onCancel={() => setInModifica(null)}
                        onSubmit={(payload) => salva(t, payload)}
                      />
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between gap-3">
                        <div className="flex min-w-0 flex-col">
                          <span className="flex items-center gap-2 text-[15px]">
                            <PallinoCategoria colore={cat?.colore ?? null} icona={cat?.icona} />
                            <span className="min-w-0 break-words">{t.descrizione}</span>
                          </span>
                          <span className="num text-[13px] text-ink-2">
                            {formatDateIt(t.data)}
                            {cat ? ` · ${cat.nome}` : ''}
                          </span>
                          <span className="text-[13px] text-ink-2">{etichettaChiHaPagato(t, aggiunta.conti, nomi)}</span>
                        </div>
                        <span className="num text-[15px] font-semibold">
                          {t.tipo === 'expense' ? '\u2212' : '+'}
                          {formatEuro(t.importo)}
                        </span>
                      </div>
                      {puoModificare(t) && (
                        <div className="flex gap-4">
                          {puoModificareForm(t) && (
                            <button type="button" onClick={() => setInModifica(t.id)} className={`${AZIONE} text-brand-dark`}>
                              Modifica
                            </button>
                          )}
                          <button type="button" onClick={() => chiediElimina(t)} className={`${AZIONE} text-danger`}>
                            Elimina
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </>
  );
}
