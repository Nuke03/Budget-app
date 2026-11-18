'use client';

import { useEffect, useState } from 'react';
import { useThrowToBoundary } from '@/lib/useThrowToBoundary';
import { createClient } from '@/lib/supabase/client';
import { getTransactions } from '@/lib/data/transactions';
import { getAccounts } from '@/lib/data/accounts';
import {
  accantonaTasse,
  assicuraScadenze,
  creaFattura,
  getAccantonamenti,
  getFatture,
  getScadenze,
} from '@/lib/data/piva';
import { computeDisponibileLibero } from '@/lib/calculations/disponibile';
import { homeConStipendio, propostaStipendio, speseDelMese } from '@/lib/calculations/stipendio';
import {
  casaDelMese,
  finestraIncassi,
  inizioMesiFa,
  leggiCasaPerStipendio,
  leggiGoalsConSpeso,
  speseUltimiMesi,
} from '@/lib/pivaHome';
import type { CasaStato } from '@/lib/loadCasaStato';
import { contoPerIncasso } from '@/lib/calculations/pivaFatture';
import { prossimaScadenza, scadenzeDaCreare } from '@/lib/calculations/pivaScadenze';
import {
  computeAliquotaSostitutiva,
  computeFatturatoAnnuo,
  computePercentualeIncasso,
  computeStimaAnno,
  confrontoAnno,
  quoteInSospeso,
  totaleInSospeso,
} from '@/lib/calculations/piva';
import { oggiRomaData, oggiRomaISO } from '@/lib/calculations/casa/oggi';
import { formatDateIt, formatEuro, formatNumero } from '@/lib/format';
import type { PivaSettingsInput } from '@/lib/data/pivaSettings';
import { CoverHeader } from '../CoverHeader';
import { FoglioInferiore } from '../FoglioInferiore';
import { CLASSE_NEUTRO, CLASSE_PRIMARIO, CLASSE_SCHEDA, CLASSE_SECONDARIO } from '../casa/CampiMovimento';
import { PercheQuote, PerchePercentuale, PercheSaldoVaso, PercheVaso } from './PerchePiva';
import { FattureInAttesa } from './FattureInAttesa';
import { NuovaFattura, type ValoriFattura } from './NuovaFattura';
import { contoDaCuiSpostare, euroInFrase, PromptQuota } from './PromptQuota';
import { ScadenzePiva } from './ScadenzePiva';
import { StipendioPiva } from './StipendioPiva';
import type {
  Account,
  BudgetGoal,
  PivaAccantonamento,
  PivaFattura,
  PivaScadenza,
  PivaSettings,
  Transaction,
} from '@/lib/types';

// Il primo giorno da cui servono i dati: l'inizio dell'anno (per "messi quest'anno") o, se prima, il giorno della guida.
function leggiDal(guidataDal: string | null, anno: number): string {
  const inizioAnno = `${anno}-01-01`;
  return guidataDal && guidataDal < inizioAnno ? guidataDal : inizioAnno;
}

// I campi dello stipendio che la pagina sa salvare.
export type CampiStipendio = Partial<
  Pick<PivaSettingsInput, 'stipendioMensile' | 'stipendioRivistoIl' | 'incassoMeseMagro'>
>;

// Quello che serve per lo stipendio oltre ai conti e agli incassi: le spese dei mesi scorsi e di questo,
// la casa e gli obiettivi (per il cuscinetto). null: non si leggono, e lo stipendio non si calcola.
export interface DatiStipendio {
  spese: Transaction[];
  casa: CasaStato | null;
  goals: (BudgetGoal & { specoCollegato: number })[];
}

// Tutto quello che la pagina legge. Si passa già pronto solo per l'anteprima, senza rete.
export interface DatiPivaHub {
  acc: Account[];
  tx: Transaction[];
  accant: PivaAccantonamento[];
  scad: PivaScadenza[] | null;
  fatt: PivaFattura[] | null;
  stip: DatiStipendio | null;
}

// La pagina P.IVA a guida finita: quanto mettere da parte, il conto tasse, le quote ancora da spostare.
export function PivaHub({
  settings,
  onModifica,
  onDisattiva,
  onSalvaStipendio,
  datiIniziali,
}: {
  settings: PivaSettings;
  onModifica: () => void;
  onDisattiva: () => Promise<void>;
  onSalvaStipendio: (campi: CampiStipendio) => Promise<void>;
  // Se c'è, la pagina non legge dal database: usa questi dati (anteprima).
  datiIniziali?: DatiPivaHub;
}) {
  const fail = useThrowToBoundary();
  const [conti, setConti] = useState<Account[]>([]);
  const [incassi, setIncassi] = useState<Transaction[]>([]);
  const [accantonamenti, setAccantonamenti] = useState<PivaAccantonamento[]>([]);
  const [scadenze, setScadenze] = useState<PivaScadenza[]>([]);
  const [scadenzeNonCaricate, setScadenzeNonCaricate] = useState(false);
  const [fatture, setFatture] = useState<PivaFattura[]>([]);
  const [fattureNonCaricate, setFattureNonCaricate] = useState(false);
  const [datiStipendio, setDatiStipendio] = useState<DatiStipendio | null>(null);
  const [caricato, setCaricato] = useState(false);
  // La quota per cui è aperto il foglio "Fatto" (importo modificabile).
  const [quotaAperta, setQuotaAperta] = useState<string | null>(null);
  // Il foglio della nuova fattura: dal "+ Incasso" parte già pagata.
  const [nuova, setNuova] = useState<'fattura' | 'incasso' | null>(null);
  const [impostazioni, setImpostazioni] = useState(false);
  // Le quote con "Fatto" in corso: un solo tocco conta.
  const [inCorso, setInCorso] = useState<Set<string>>(new Set());
  const [errore, setErrore] = useState<string | null>(null);

  const oggi = oggiRomaData();
  const anno = oggi.getFullYear();
  const categoriaId = settings.categoriaFatturatoId;
  const contoTasseId = settings.contoTasseId;

  // Legge tutto senza toccare lo stato: così l'effetto imposta lo stato solo dopo l'attesa.
  async function leggi(): Promise<DatiPivaHub> {
    if (datiIniziali) return datiIniziali;
    const supabase = createClient();
    const da = leggiDal(settings.guidataDal, anno);
    const oggiISO = oggiRomaISO();
    const adesso = new Date();
    // Per la media degli incassi servono gli ultimi 6 mesi interi, anche se l'anno è appena iniziato.
    const daIncassi = da < inizioMesiFa(oggiISO, 6) ? da : inizioMesiFa(oggiISO, 6);
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
    // Come le scadenze: se le fatture non si leggono, il resto della pagina funziona.
    const leggiFatture = async (): Promise<PivaFattura[] | null> => {
      try {
        return await getFatture(supabase);
      } catch {
        return null;
      }
    };
    // Le letture dello stipendio non fermano il resto: se falliscono lo stipendio non si calcola.
    const leggiStipendio = async (): Promise<DatiStipendio | null> => {
      try {
        const [spese, casa, goals] = await Promise.all([
          getTransactions(supabase, undefined, { da: inizioMesiFa(oggiISO, 3), tipo: 'expense' }),
          leggiCasaPerStipendio(supabase, adesso),
          leggiGoalsConSpeso(supabase, adesso),
        ]);
        return { spese, casa, goals };
      } catch {
        return null;
      }
    };
    // getAccounts senza scope: i conti personali.
    const [acc, tx, accant, scad, fatt, stip] = await Promise.all([
      getAccounts(supabase),
      getTransactions(supabase, undefined, { da: daIncassi, tipo: 'income' }),
      getAccantonamenti(supabase, { da }),
      leggiScadenze(),
      leggiFatture(),
      leggiStipendio(),
    ]);
    return { acc, tx, accant, scad, fatt, stip };
  }

  function applica(d: Awaited<ReturnType<typeof leggi>>) {
    setConti(d.acc);
    setIncassi(d.tx);
    setAccantonamenti(d.accant);
    setScadenze(d.scad ?? []);
    setScadenzeNonCaricate(d.scad === null);
    setFatture(d.fatt ?? []);
    setFattureNonCaricate(d.fatt === null);
    setDatiStipendio(d.stip);
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
  // Sul conto tasse non entrano incassi: gli altri conti sono personali (getAccounts senza scope).
  const contiIncasso = conti.filter((c) => c.id !== contoTasseId);
  const contoIniziale = contoPerIncasso(incassi, conti, categoriaId, contoTasseId);

  // Lo stipendio, con le stesse funzioni della Home: la proposta, e se c'è già quanto resta e il cuscinetto.
  const oggiISO = oggiRomaISO();
  const contiDisponibile = new Set(conti.filter((c) => c.contaInDisponibile && c.id !== contoTasseId).map((c) => c.id));
  let calcoloStipendio: ReturnType<typeof propostaStipendio> | null = null;
  let rigaStipendio: { rimasto: number; cuscinetto: number; mesiCoperti: number } | null = null;
  if (datiStipendio && categoriaId) {
    const { incassiMensili, mesiConIncassi } = finestraIncassi(incassi, categoriaId, oggiISO);
    const { quotaCasaMensile, versatoCasaMese } = casaDelMese(datiStipendio.casa?.righe ?? null, oggiISO);
    calcoloStipendio = propostaStipendio({
      incassiMensili,
      mesiConIncassi,
      percentuale,
      speseMensili: speseUltimiMesi(datiStipendio.spese, contiDisponibile, oggiISO),
      quotaCasaMensile,
      incassoMeseMagro: settings.incassoMeseMagro,
    });
    if (settings.stipendioMensile !== null) {
      const riservaVersamento = datiStipendio.casa?.riservaVersamento ?? 0;
      const disponibile = computeDisponibileLibero(
        conti,
        datiStipendio.goals,
        oggi,
        riservaVersamento,
        datiStipendio.casa?.debitoDaRestituire ?? 0,
        totaleInSospeso(inSospeso)
      );
      const { rimasto, cuscinetto, mesiCoperti } = homeConStipendio({
        disponibileLibero: disponibile,
        stipendio: settings.stipendioMensile,
        speseMese: speseDelMese(datiStipendio.spese, contiDisponibile, oggiISO.slice(0, 7)),
        versatoCasaMese,
        riservaVersamento,
      });
      rigaStipendio = { rimasto, cuscinetto, mesiCoperti };
    }
  }

  // Dopo un'azione riuscita la ricarica può fallire: non è un'azione fallita, si segnala a parte.
  // true se la pagina è stata riletta.
  async function ricarica(): Promise<boolean> {
    try {
      await carica();
      return true;
    } catch {
      setErrore('Fatto, ma non riesco ad aggiornare la pagina. Riaprila tra poco.');
      return false;
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

  // Crea la fattura; con "Pagata adesso" nasce già incassata e subito dopo compare la quota tasse.
  // Dopo che la fattura esiste nulla deve lanciare: un secondo tentativo ne farebbe un doppione.
  async function salvaNuova(v: ValoriFattura) {
    const id = await creaFattura(createClient(), {
      cliente: v.cliente,
      importo: v.importo,
      dataEmissione: v.dataEmissione,
      nota: v.nota,
      ...(v.pagataAdesso && v.accountId ? { incassaSu: { accountId: v.accountId, categoriaId } } : {}),
    });
    setNuova(null);
    try {
      const d = await leggi();
      applica(d);
      const transazione = d.fatt?.find((f) => f.id === id)?.transactionId;
      if (v.pagataAdesso && transazione) setQuotaAperta(transazione);
    } catch {
      setErrore('Fatto, ma non riesco ad aggiornare la pagina. Riaprila tra poco.');
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

        <section aria-label="Stipendio" className={CLASSE_SCHEDA}>
          <StipendioPiva
            stipendio={settings.stipendioMensile}
            oggi={oggiISO}
            calcolo={calcoloStipendio}
            riga={rigaStipendio}
            onSalva={onSalvaStipendio}
            onMeseMagro={(incassoMeseMagro) => onSalvaStipendio({ incassoMeseMagro })}
          />
        </section>

        <section aria-label="Fatture in attesa" className={CLASSE_SCHEDA}>
          {fattureNonCaricate ? (
            <>
              <h2 className="font-serif text-lg font-semibold">Fatture in attesa</h2>
              <p className="text-[15px] text-ink-2">Le fatture non si caricano ora.</p>
            </>
          ) : (
            <FattureInAttesa
              fatture={fatture}
              oggi={oggiRomaISO()}
              conti={contiIncasso}
              contoIniziale={contoIniziale}
              categoriaId={categoriaId}
              onIncassata={async (transazione) => {
                // Se la pagina non si è riletta la quota non c'è ancora: non si tiene un id che potrebbe saltare fuori dopo.
                if (await ricarica()) setQuotaAperta(transazione);
              }}
              onCambiato={async () => { await ricarica(); }}
              onTolta={(id) => setFatture((prima) => prima.filter((f) => f.id !== id))}
            />
          )}
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
              onCambiato={async () => { await ricarica(); }}
              onNascosta={(id) => setScadenze((prima) => prima.map((x) => (x.id === id ? { ...x, nascosta: true } : x)))}
            />
          </section>
        ) : null}

        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setNuova('incasso')} className={CLASSE_PRIMARIO}>
            + Incasso
          </button>
          <button type="button" onClick={() => setNuova('fattura')} className={CLASSE_SECONDARIO}>
            + Fattura
          </button>
        </div>

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

      {nuova ? (
        <FoglioInferiore titolo={nuova === 'incasso' ? 'Nuovo incasso' : 'Nuova fattura'} onClose={() => setNuova(null)}>
          <NuovaFattura
            pagataAdessoIniziale={nuova === 'incasso'}
            conti={contiIncasso}
            contoIniziale={contoIniziale}
            oggi={oggiRomaISO()}
            onSalva={salvaNuova}
          />
        </FoglioInferiore>
      ) : null}
    </>
  );
}
