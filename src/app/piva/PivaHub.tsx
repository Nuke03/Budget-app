'use client';

import { useEffect, useState } from 'react';
import { useThrowToBoundary } from '@/lib/useThrowToBoundary';
import { createClient } from '@/lib/supabase/client';
import { getTransactions } from '@/lib/data/transactions';
import { getAccounts } from '@/lib/data/accounts';
import { accantonaTasse, assicuraScadenze, getAccantonamenti, getScadenze } from '@/lib/data/piva';
import { prossimaScadenza, scadenzeDaCreare } from '@/lib/calculations/pivaScadenze';
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
import { contoDaCuiSpostare, euroInFrase, PromptQuota } from './PromptQuota';
import { ScadenzePiva } from './ScadenzePiva';
import type { Account, Category, PivaAccantonamento, PivaScadenza, PivaSettings, Transaction } from '@/lib/types';

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
  const [scadenze, setScadenze] = useState<PivaScadenza[]>([]);
  const [scadenzeNonCaricate, setScadenzeNonCaricate] = useState(false);
  const [caricato, setCaricato] = useState(false);
  // La quota per cui è aperto il foglio "Fatto" (importo modificabile).
  const [quotaAperta, setQuotaAperta] = useState<string | null>(null);
  const [aggiungi, setAggiungi] = useState(false);
  const [impostazioni, setImpostazioni] = useState(false);
  // Le quote con "Fatto" in corso: un solo tocco conta.
  const [inCorso, setInCorso] = useState<Set<string>>(new Set());
  const [errore, setErrore] = useState<string | null>(null);

  const oggi = oggiRomaData();
  const anno = oggi.getFullYear();
  const categoriaId = settings.categoriaFatturatoId;
  const contoTasseId = settings.contoTasseId;

  // Legge tutto senza toccare lo stato: così l'effetto imposta lo stato solo dopo l'attesa.
  async function leggi() {
    const supabase = createClient();
    const da = leggiDal(settings.guidataDal, anno);
    // Le scadenze mancanti si creano all'apertura; quelle tolte non tornano (il database ignora i doppioni).
    // Un errore sulle scadenze non deve fermare vaso e quote: la lista resta vuota con una riga calma.
    const leggiScadenze = async (): Promise<PivaScadenza[] | null> => {
      try {
        if (settings.guidataDal) await assicuraScadenze(supabase, scadenzeDaCreare(anno, settings.guidataDal));
        return await getScadenze(supabase, anno);
      } catch {
        return null;
      }
    };
    // getAccounts senza scope: i conti personali.
    const [acc, tx, accant, scad] = await Promise.all([
      getAccounts(supabase),
      getTransactions(supabase, undefined, { da, tipo: 'income' }),
      getAccantonamenti(supabase, { da }),
      leggiScadenze(),
    ]);
    return { acc, tx, accant, scad };
  }

  function applica(d: Awaited<ReturnType<typeof leggi>>) {
    setConti(d.acc);
    setIncassi(d.tx);
    setAccantonamenti(d.accant);
    setScadenze(d.scad ?? []);
    setScadenzeNonCaricate(d.scad === null);
    setCaricato(true);
  }

  async function carica() {
    applica(await leggi());
  }

  useEffect(() => {
    leggi().then(applica).catch(fail);
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
  const prossima = prossimaScadenza(scadenze, oggiRomaISO());
  const inSospeso = categoriaId
    ? quoteInSospeso(incassi, accantonamenti, percentuale, categoriaId, settings.guidataDal)
    : [];
  const quotaDaSpostare = inSospeso.find((x) => x.transactionId === quotaAperta) ?? null;

  // Dopo un'azione riuscita la ricarica può fallire: non è un'azione fallita, si segnala a parte.
  async function ricarica() {
    try {
      await carica();
    } catch {
      setErrore('Fatto, ma non riesco ad aggiornare la pagina. Riaprila tra poco.');
    }
  }

  // true se i soldi sono stati registrati come spostati.
  async function sposta(transactionId: string, quota: number): Promise<boolean> {
    if (inCorso.has(transactionId) || !contoTasseId) return false;
    const incasso = incassi.find((t) => t.id === transactionId);
    const da = contoDaCuiSpostare(incasso?.accountId ?? null, conti, contoTasseId);
    if (!da) {
      setErrore('Non trovo un conto da cui spostare i soldi.');
      return false;
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
    } catch {
      setErrore('Non è riuscito. Riprova.');
      return false;
    } finally {
      setInCorso((prima) => {
        const dopo = new Set(prima);
        dopo.delete(transactionId);
        return dopo;
      });
    }
    await ricarica();
    return true;
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
          {prossima ? (
            <p className="num text-[15px] text-ink-2">
              prossima {prossima.tipo === 'f24' ? 'F24' : 'ENPAP'} {prossima.data.slice(8)}/{prossima.data.slice(5, 7)}
            </p>
          ) : null}
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
                        onClick={() => setQuotaAperta(q.transactionId)}
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

        {settings.guidataDal ? (
          <section aria-label="Scadenze dell'anno" className={CLASSE_SCHEDA}>
            <ScadenzePiva
              scadenze={scadenze}
              saldoVaso={contoTasse.saldoAttuale}
              contoTasseId={contoTasseId}
              guidataDal={settings.guidataDal}
              anno={anno}
              oggi={oggiRomaISO()}
              nonCaricate={scadenzeNonCaricate}
              onCambiato={ricarica}
              onNascosta={(id) => setScadenze((prima) => prima.map((x) => (x.id === id ? { ...x, nascosta: true } : x)))}
            />
          </section>
        ) : null}

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

      {quotaDaSpostare ? (
              <PromptQuota
                importo={quotaDaSpostare.importo}
                quota={quotaDaSpostare.quota}
                contoTasse={contoTasse.nome}
                onFatto={async (spostato) => {
                  if (!(await sposta(quotaDaSpostare.transactionId, spostato))) throw new Error('non spostato');
                  setQuotaAperta(null);
                }}
                onPiuTardi={() => setQuotaAperta(null)}
              />
      ) : null}

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
