'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';
import { createClient } from '@/lib/supabase/client';
import { deleteTransaction, updateTransaction } from '@/lib/data/transactions';
import { adjustAccountBalance } from '@/lib/data/accounts';
import { deltaPerModifica } from '@/lib/calculations/accountBalance';
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
import type { Transaction, TransactionTipo, Transfer } from '@/lib/types';
import { AddTransactionForm } from '../../add/AddTransactionForm';
import { CoverHeader } from '../../CoverHeader';
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
}: {
  casa: CasaCorrente;
  aggiunta: CasaAggiunta;
  transazioni: Transaction[];
  trasferimenti?: Transfer[];
  meUserId: string;
}) {
  const router = useRouter();
  const [righe, setRighe] = useState<Transaction[]>(transazioni);
  const meseCorrente = meseRomaISO().slice(0, 7);
  const [mosse, setMosse] = useState<Transfer[]>(trasferimenti);
  const [mese, setMese] = useState(meseCorrente);
  const [inModifica, setInModifica] = useState<string | null>(null);
  const [errore, setErrore] = useState(false);
  const [conferma, setConferma] = useState<{ testo: string; procedi: () => void } | null>(null);

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
  // Una spesa pagata con la carta personale si cambia dal conto personale: il modulo qui conosce solo i conti di casa.
  const conCartaPersonale = (t: Transaction) =>
    !!t.accountId && !aggiunta.conti.some((c) => c.id === t.accountId);

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
    if (!sc) return void annulla(m);
    setConferma({ testo: frase(sc, 'versamento'), procedi: () => void annulla(m) });
  }

  function chiediElimina(t: Transaction) {
    const sc = scopertoEliminandoSpesa(t, righe, mosse);
    if (!sc) return void elimina(t);
    setConferma({ testo: frase(sc, 'spesa'), procedi: () => void elimina(t) });
  }

  async function annulla(m: Transfer) {
    const posizione = mosse.findIndex((x) => x.id === m.id);
    setErrore(false);
    setConferma(null);
    setMosse((r) => r.filter((x) => x.id !== m.id));
    try {
      await deleteTransfer(createClient(), m.id);
      router.refresh();
    } catch {
      setErrore(true);
      setMosse((r) => {
        if (r.some((x) => x.id === m.id)) return r;
        const copia = [...r];
        copia.splice(Math.min(posizione, copia.length), 0, m);
        return copia;
      });
    }
  }

  async function elimina(t: Transaction) {
    const posizione = righe.findIndex((r) => r.id === t.id);
    setErrore(false);
    setConferma(null);
    setRighe((r) => r.filter((x) => x.id !== t.id));
    let cancellata = false;
    try {
      const supabase = createClient();
      await deleteTransaction(supabase, t.id);
      cancellata = true;
      if (t.accountId) {
        await adjustAccountBalance(
          supabase,
          t.accountId,
          t.tipo === 'expense' ? t.importo : -t.importo,
        );
      }
      router.refresh();
    } catch {
      setErrore(true);
      // Se la riga e gia stata cancellata e fallisce solo il saldo, non va rimessa.
      if (cancellata) return;
      setRighe((r) => {
        if (r.some((x) => x.id === t.id)) return r;
        const copia = [...r];
        copia.splice(Math.min(posizione, copia.length), 0, t);
        return copia;
      });
    }
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
    let aggiornata = false;
    try {
      const supabase = createClient();
      await updateTransaction(supabase, t.id, {
        tipo: payload.tipo,
        importo: payload.importo,
        data: t.data,
        categoriaId: payload.categoriaId,
        accountId: payload.accountId,
        goalId: payload.goalId,
        descrizione: payload.descrizione,
        nota: t.nota,
      });
      aggiornata = true;
      for (const { accountId, delta } of deltaPerModifica(t, nuova)) {
        await adjustAccountBalance(supabase, accountId, delta);
      }
      router.refresh();
    } catch {
      setErrore(true);
      // Se la spesa è già stata salvata e fallisce solo il saldo, tornare alla riga vecchia
      // farebbe applicare due volte la differenza: si ricarica lo stato vero.
      if (aggiornata) {
        router.refresh();
        return;
      }
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
          ‹ La casa
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
              return (
                <li key={t.id} className={RIGA}>
                  {inModifica === t.id ? (
                    <div className="-mx-4">
                      <AddTransactionForm
                        categories={aggiunta.categorie}
                        accounts={aggiunta.conti}
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
                            <PallinoCategoria colore={cat?.colore ?? null} />
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
                          {!conCartaPersonale(t) && (
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
