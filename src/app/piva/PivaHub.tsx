'use client';

import { useEffect, useState } from 'react';
import { useThrowToBoundary } from '@/lib/useThrowToBoundary';
import { createClient } from '@/lib/supabase/client';
import { getTransactions } from '@/lib/data/transactions';
import { getAccounts } from '@/lib/data/accounts';
import { accantonaTasse, getAccantonamenti } from '@/lib/data/piva';
import {
  computeAliquotaSostitutiva,
  computeFatturatoAnnuo,
  computePercentualeIncasso,
  computeStimaAnno,
  confrontoAnno,
  quoteInSospeso,
} from '@/lib/calculations/piva';
import { oggiRomaData, oggiRomaISO } from '@/lib/calculations/casa/oggi';
import { formatDateIt, formatEuro, formatNumero } from '@/lib/format';
import { CoverHeader } from '../CoverHeader';
import { AddTransactionSheet } from '../add/AddTransactionSheet';
import { CLASSE_NEUTRO, CLASSE_PRIMARIO, CLASSE_SCHEDA, CLASSE_SECONDARIO } from '../casa/CampiMovimento';
import { PercheQuote, PerchePercentuale, PercheSaldoVaso, PercheVaso } from './PerchePiva';
import { contoDaCuiSpostare, euroInFrase } from './PromptQuota';
import type { Account, Category, PivaAccantonamento, PivaSettings, Transaction } from '@/lib/types';

// Il primo giorno da cui servono i dati: l'inizio dell'anno (per "messi quest'anno") o, se prima, il giorno della guida.
function leggiDal(guidataDal: string | null, anno: number): string {
  const inizioAnno = `${anno}-01-01`;
  return guidataDal && guidataDal < inizioAnno ? guidataDal : inizioAnno;
}

// La pagina P.IVA a guida finita: quanto mettere da parte, il conto tasse, le quote ancora da spostare.
export function PivaHub({
  settings,
  categories,
  onModifica,
  onDisattiva,
}: {
  settings: PivaSettings;
  categories: Category[];
  onModifica: () => void;
  onDisattiva: () => Promise<void>;
}) {
  const fail = useThrowToBoundary();
  const [conti, setConti] = useState<Account[]>([]);
  const [incassi, setIncassi] = useState<Transaction[]>([]);
  const [accantonamenti, setAccantonamenti] = useState<PivaAccantonamento[]>([]);
  const [caricato, setCaricato] = useState(false);
  const [aggiungi, setAggiungi] = useState(false);
  const [impostazioni, setImpostazioni] = useState(false);
  // Le quote con "Fatto" in corso: un solo tocco conta.
  const [inCorso, setInCorso] = useState<Set<string>>(new Set());
  const [errore, setErrore] = useState<string | null>(null);

  const oggi = oggiRomaData();
  const anno = oggi.getFullYear();
  const categoriaId = settings.categoriaFatturatoId;
  const contoTasseId = settings.contoTasseId;

  async function carica() {
    const supabase = createClient();
    const da = leggiDal(settings.guidataDal, anno);
    // getAccounts senza scope: i conti personali.
    const [acc, tx, accant] = await Promise.all([
      getAccounts(supabase),
      getTransactions(supabase, undefined, { da, tipo: 'income' }),
      getAccantonamenti(supabase, { da }),
    ]);
    setConti(acc);
    setIncassi(tx);
    setAccantonamenti(accant);
    setCaricato(true);
  }

  useEffect(() => {
    carica().catch(fail);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fail]);

  const contoTasse = conti.find((c) => c.id === contoTasseId);
  if (!caricato || !contoTasse || !contoTasseId) return null;

  const percentuale = computePercentualeIncasso(
    settings.coefficienteRedditivita,
    computeAliquotaSostitutiva(settings.dataApertura, oggi, settings.aliquotaSostitutivaOverride),
    settings.aliquotaContributoSoggettivo,
    settings.aliquotaContributoIntegrativo
  );
  const aliquota = computeAliquotaSostitutiva(settings.dataApertura, oggi, settings.aliquotaSostitutivaOverride);

  const fatturato = categoriaId ? computeFatturatoAnnuo(incassi, categoriaId, anno) : 0;
  const stima = computeStimaAnno(settings, fatturato, oggi);
  const messi = accantonamenti
    .filter((a) => a.data.slice(0, 4) === String(anno))
    .reduce((tot, a) => tot + a.importo, 0);
  const confronto = confrontoAnno(stima.totale, messi);
  const inSospeso = categoriaId
    ? quoteInSospeso(incassi, accantonamenti, percentuale, categoriaId, settings.guidataDal)
    : [];

  async function sposta(transactionId: string, quota: number) {
    if (inCorso.has(transactionId) || !contoTasseId) return;
    const incasso = incassi.find((t) => t.id === transactionId);
    const da = contoDaCuiSpostare(incasso?.accountId ?? null, conti, contoTasseId);
    if (!da) {
      setErrore('Non trovo un conto da cui spostare i soldi.');
      return;
    }
    setErrore(null);
    setInCorso((prima) => new Set(prima).add(transactionId));
    try {
      await accantonaTasse(createClient(), {
        importo: quota,
        data: oggiRomaISO(),
        daAccountId: da,
        aAccountId: contoTasseId,
        transactionId,
      });
      await carica();
    } catch {
      setErrore('Non è riuscito. Riprova.');
    } finally {
      setInCorso((prima) => {
        const dopo = new Set(prima);
        dopo.delete(transactionId);
        return dopo;
      });
    }
  }

  return (
    <>
      <CoverHeader titolo="P.IVA" />
      <main className="mx-auto flex max-w-md flex-col gap-3.5 px-3 pb-28 pt-3.5">
        <section aria-label="Quanto mettere da parte" className={CLASSE_SCHEDA}>
          <p className="num font-serif text-[22px] font-semibold">
            Metti da parte il {formatNumero(percentuale)}% di ogni incasso.
          </p>
          <PerchePercentuale settings={settings} aliquota={aliquota} percentuale={percentuale} />
        </section>

        <section aria-label="Conto tasse" className={CLASSE_SCHEDA}>
          <h2 className="text-[13px] text-ink-2">{contoTasse.nome}</h2>
          <p className="num font-serif text-[40px] font-bold leading-none">{formatEuro(contoTasse.saldoAttuale)}</p>
          <PercheSaldoVaso nomeConto={contoTasse.nome} />
          <p className="text-[15px]">
            Quest&apos;anno servono circa {euroInFrase(Math.round(confronto.servono))}, ne hai messi da parte{' '}
            {euroInFrase(Math.round(confronto.messi))}.
          </p>
          <PercheVaso settings={settings} fatturato={fatturato} stima={stima} messi={messi} />
        </section>

        <section aria-label="Da spostare" className={CLASSE_SCHEDA}>
          <h2 className="font-serif text-lg font-semibold">Da spostare</h2>
          {inSospeso.length === 0 ? (
            <p className="text-[15px] text-ink-2">Niente da spostare: sei in pari con gli incassi.</p>
          ) : (
            <>
              <ul>
                {inSospeso.map((q) => {
                  const incasso = incassi.find((t) => t.id === q.transactionId);
                  return (
                    <li
                      key={q.transactionId}
                      className="flex min-h-12 items-center justify-between gap-3 border-t border-rule py-2 first:border-t-0"
                    >
                      <div className="min-w-0">
                        <p className="num text-[15px]">
                          {euroInFrase(q.quota)} da {euroInFrase(q.importo)}
                        </p>
                        {incasso ? (
                          <p className="num text-[13px] text-ink-2">Incasso del {formatDateIt(incasso.data)}</p>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        onClick={() => sposta(q.transactionId, q.quota)}
                        disabled={inCorso.has(q.transactionId)}
                        className={`${CLASSE_SECONDARIO} shrink-0`}
                      >
                        Fatto
                      </button>
                    </li>
                  );
                })}
              </ul>
              <PercheQuote percentuale={percentuale} />
            </>
          )}
          {errore ? (
            <p role="alert" className="text-[15px] font-medium text-danger">
              {errore}
            </p>
          ) : null}
        </section>

        <button type="button" onClick={() => setAggiungi(true)} className={CLASSE_PRIMARIO}>
          + Incasso
        </button>

        <section className="flex flex-col gap-2">
          <button
            type="button"
            aria-expanded={impostazioni}
            onClick={() => setImpostazioni((v) => !v)}
            className="inline-flex min-h-11 items-center self-start text-[15px] font-semibold text-brand-dark"
          >
            Impostazioni
          </button>
          {impostazioni ? (
            <div className="flex flex-col gap-2">
              <button type="button" onClick={onModifica} className={CLASSE_SECONDARIO}>
                Modifica i parametri
              </button>
              <button type="button" onClick={() => onDisattiva().catch(fail)} className={CLASSE_NEUTRO}>
                Disattiva gestione P.IVA
              </button>
            </div>
          ) : null}
        </section>
      </main>

      <AddTransactionSheet
        aperto={aggiungi}
        onClose={() => setAggiungi(false)}
        personale={{ categories, accounts: conti, goals: [] }}
        casa={null}
        modoIniziale="personale"
        iniziale={{ tipo: 'income', categoriaId: categoriaId }}
        piva={
          categoriaId ? { categoriaFatturatoId: categoriaId, percentuale, contoTasseId } : null
        }
        onSaved={() => {
          carica().catch(fail);
        }}
        onAccantonato={() => {
          carica().catch(fail);
        }}
      />
    </>
  );
}
