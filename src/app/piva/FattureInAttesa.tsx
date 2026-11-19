'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { collegaIncasso, deleteFattura, incassaFattura, updateFattura } from '@/lib/data/piva';
import { entrataGemella, fattureInAttesa, riassuntoInAttesa } from '@/lib/calculations/pivaFatture';
import { formatDataLunga } from '@/lib/format';
import { useEliminaConAnnulla } from '../AnnullaProvider';
import { FoglioInferiore } from '../FoglioInferiore';
import {
  Campo,
  CLASSE_CAMPO,
  CLASSE_LINK,
  CLASSE_NEUTRO,
  CLASSE_PRIMARIO,
  CLASSE_SECONDARIO,
  ErroreMovimento,
  SelezioneConto,
} from '../casa/CampiMovimento';
import { NuovaFattura } from './NuovaFattura';
import { PercheFatture } from './PerchePiva';
import { euroInFrase } from './PromptQuota';
import type { PivaFattura, Transaction } from '@/lib/types';

type Foglio = { id: string; modo: 'pagata' | 'modifica' | 'azioni' };

const MESSAGGIO_DATA = (emissione: string) =>
  `La data dell'incasso non può essere prima di quella della fattura (${formatDataLunga(emissione)}).`;

// Il vincolo del database (piva_fatture_date_check) dice la stessa cosa del controllo nel foglio.
function eErroreData(e: unknown): boolean {
  return String((e as { message?: unknown } | null)?.message ?? '').includes('piva_fatture_date_check');
}

const INCASSATE_VISIBILI = 3;

// Chi ti deve soldi: le fatture non ancora pagate, dalla più vecchia. "Pagata" le trasforma in incasso.
export function FattureInAttesa({
  fatture,
  oggi,
  conti,
  contoIniziale,
  categoriaId,
  incassi = [],
  onIncassata,
  onCambiato,
  onTolta,
}: {
  fatture: PivaFattura[];
  oggi: string;
  // I conti su cui può entrare un incasso: personali, non il conto tasse.
  conti: { id: string; nome: string }[];
  contoIniziale: string | null;
  categoriaId: string | null;
  // Le entrate lette dalla pagina: servono a riconoscere un incasso già registrato a mano.
  incassi?: Transaction[];
  // Fattura incassata: arriva l'id dell'entrata creata (per proporre la quota tasse).
  onIncassata: (transactionId: string) => Promise<void>;
  onCambiato: () => Promise<void>;
  onTolta: (id: string) => void;
}) {
  const eliminaConAnnulla = useEliminaConAnnulla();
  const [nascoste, setNascoste] = useState<Set<string>>(new Set());
  const [aperte, setAperte] = useState(false);
  const [foglio, setFoglio] = useState<Foglio | null>(null);
  const [data, setData] = useState(oggi);
  const [conto, setConto] = useState(contoIniziale ?? conti[0]?.id ?? '');
  const [inCorso, setInCorso] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  // C'è un'entrata uguale già registrata: prima di incassare si chiede se è la stessa.
  const [chiedeGemella, setChiedeGemella] = useState(false);

  const attesa = fattureInAttesa(
    fatture.filter((f) => !nascoste.has(f.id)),
    oggi
  );
  const incassate = fatture
    .filter((f) => f.dataIncasso !== null)
    .sort((a, b) => ((a.dataIncasso ?? '') < (b.dataIncasso ?? '') ? 1 : -1))
    .slice(0, INCASSATE_VISIBILI);
  const aperta = foglio ? (fatture.find((f) => f.id === foglio.id) ?? null) : null;
  const gemella = aperta && chiedeGemella ? entrataGemella(aperta, incassi, fatture, categoriaId) : null;

  function apriPagata(f: PivaFattura) {
    setErrore(null);
    setChiedeGemella(false);
    // Una fattura con la data di emissione ancora davanti non si incassa prima.
    setData(oggi < f.dataEmissione ? f.dataEmissione : oggi);
    setConto(contoIniziale ?? conti[0]?.id ?? '');
    setFoglio({ id: f.id, modo: 'pagata' });
  }

  // "Segna incassata": se un'entrata uguale c'è già, prima si chiede; altrimenti si incassa.
  function conferma(f: PivaFattura) {
    if (inCorso || !data || !conto || data < f.dataEmissione) return;
    if (entrataGemella(f, incassi, fatture, categoriaId)) {
      setChiedeGemella(true);
      return;
    }
    void incassa(f);
  }

  // "Sì, è questo": l'incasso c'è già, si collega senza creare nulla.
  async function collega(f: PivaFattura, gemella: Transaction) {
    if (inCorso) return;
    setInCorso(true);
    setErrore(null);
    try {
      await collegaIncasso(createClient(), f.id, gemella.id, gemella.data);
    } catch (e) {
      setErrore(eErroreData(e) ? MESSAGGIO_DATA(f.dataEmissione) : 'Non è riuscito. Riprova.');
      setInCorso(false);
      return;
    }
    setFoglio(null);
    setInCorso(false);
    try {
      await onCambiato();
    } catch {
      // Il collegamento c'è: se la pagina non si aggiorna lo dice chi ricarica.
    }
  }

  async function incassa(f: PivaFattura) {
    if (inCorso || !data || !conto || data < f.dataEmissione) return;
    setInCorso(true);
    setErrore(null);
    let transazione: string;
    try {
      transazione = await incassaFattura(createClient(), f.id, { data, accountId: conto, categoriaId });
    } catch (e) {
      setErrore(eErroreData(e) ? MESSAGGIO_DATA(f.dataEmissione) : 'Non è riuscito. Riprova.');
      setInCorso(false);
      return;
    }
    setFoglio(null);
    setInCorso(false);
    try {
      await onIncassata(transazione);
    } catch {
      // L'incasso c'è: se la pagina non si aggiorna lo dice chi ricarica.
    }
  }

  function elimina(f: PivaFattura) {
    const cambia = (nascondi: boolean) =>
      setNascoste((prima) => {
        const dopo = new Set(prima);
        if (nascondi) dopo.add(f.id);
        else dopo.delete(f.id);
        return dopo;
      });
    eliminaConAnnulla({
      id: f.id,
      testo: 'Fattura eliminata.',
      nascondi: () => cambia(true),
      ripristina: () => cambia(false),
      esegui: async () => {
        // Se nel frattempo è stata incassata non si elimina: la fattura torna nella lista.
        if ((await deleteFattura(createClient(), f.id)) === 0) throw new Error('fattura non eliminata');
        onTolta(f.id);
      },
    });
  }

  return (
    <>
      <h2 className="font-serif text-lg font-semibold">Fatture in attesa</h2>
      {attesa.righe.length === 0 ? (
        <p className="text-[15px] text-ink-2">Nessuna fattura in attesa.</p>
      ) : (
        <>
          <div>
            <p className="num text-[15px]">
              Ti devono <span className="font-serif text-[22px] font-semibold">{euroInFrase(attesa.totale)}</span>
            </p>
            <p className="text-[15px] text-ink-2">{riassuntoInAttesa(attesa)}</p>
          </div>
          <PercheFatture />
        </>
      )}

      {attesa.righe.length > 0 || incassate.length > 0 ? (
        <button
          type="button"
          aria-expanded={aperte}
          onClick={() => setAperte((v) => !v)}
          className="inline-flex min-h-11 items-center self-start text-[15px] font-semibold text-brand-dark"
        >
          Le fatture una per una
        </button>
      ) : null}

      {aperte && attesa.righe.length > 0 ? (
        <ul>
          {attesa.righe.map((f) => (
            <li key={f.id} className="flex items-center justify-between gap-3 border-t border-rule py-2 first:border-t-0">
              <button
                type="button"
                aria-label={`Dettagli della fattura di ${f.cliente}`}
                onClick={() => {
                  setErrore(null);
                  setFoglio({ id: f.id, modo: 'azioni' });
                }}
                className="min-h-11 min-w-0 flex-1 text-left"
              >
                <span className="flex items-baseline justify-between gap-3">
                  <span className="text-[15px] font-medium">{f.cliente}</span>
                  <span className="num font-serif text-[18px] font-semibold">{euroInFrase(f.importo)}</span>
                </span>
                <span className="num block text-[13px] text-ink-2">
                  Emessa il {formatDataLunga(f.dataEmissione)}
                  {f.vecchia ? <span className="font-semibold text-foreground">, da {f.giorni} giorni</span> : null}
                </span>
              </button>
              <button type="button" onClick={() => apriPagata(f)} className={`${CLASSE_SECONDARIO} shrink-0`}>
                Pagata
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {aperte && incassate.length > 0 ? (
        <div className="flex flex-col">
          <h3 className="text-[13px] text-ink-2">Incassate da poco</h3>
          <ul>
            {incassate.map((f) => (
              <li key={f.id} className="flex flex-col border-t border-rule py-2 first:border-t-0">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-[15px]">{f.cliente}</p>
                  <p className="num text-[15px]">{euroInFrase(f.importo)}</p>
                </div>
                <p className="num text-[13px] text-ink-2">
                  Incassata il {formatDataLunga(f.dataIncasso as string)}: la trovi nello{' '}
                  <Link href="/history" className="font-semibold text-brand-dark underline">
                    Storico
                  </Link>
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <ErroreMovimento testo={foglio ? null : errore} />

      {foglio?.modo === 'azioni' && aperta && aperta.dataIncasso === null ? (
        <FoglioInferiore titolo={`Fattura di ${aperta.cliente}`} onClose={() => setFoglio(null)}>
          <div className="flex flex-col gap-3 px-5 pb-5">
            <p className="num text-[15px]">
              <span className="font-serif text-[22px] font-semibold">{euroInFrase(aperta.importo)}</span>
              {', emessa il '}
              {formatDataLunga(aperta.dataEmissione)}
            </p>
            <button type="button" onClick={() => setFoglio({ id: aperta.id, modo: 'modifica' })} className={CLASSE_SECONDARIO}>
              Modifica
            </button>
            <button
              type="button"
              onClick={() => {
                setFoglio(null);
                elimina(aperta);
              }}
              className={CLASSE_NEUTRO}
            >
              Elimina
            </button>
          </div>
        </FoglioInferiore>
      ) : null}

      {foglio?.modo === 'pagata' && aperta ? (
        <FoglioInferiore titolo="Fattura pagata" onClose={() => !inCorso && setFoglio(null)}>
          <div className="flex flex-col gap-4 px-5 pb-5">
            <p className="font-serif text-[20px] font-semibold">
              {aperta.cliente}: {euroInFrase(aperta.importo)}
            </p>
            <Campo etichetta="Data">
              <input type="date" value={data} onChange={(e) => setData(e.target.value)} className={CLASSE_CAMPO} />
            </Campo>
            <SelezioneConto etichetta="Conto" conti={conti} valore={conto} onChange={setConto} />
            <ErroreMovimento testo={data && data < aperta.dataEmissione ? MESSAGGIO_DATA(aperta.dataEmissione) : errore} />
            {gemella ? (
              <>
                <p className="num text-[15px]">
                  Hai già registrato {euroInFrase(gemella.importo)} il {formatDataLunga(gemella.data)}: è questo?
                </p>
                <button type="button" onClick={() => void collega(aperta, gemella)} disabled={inCorso} className={CLASSE_PRIMARIO}>
                  Sì, è questo
                </button>
                <button type="button" onClick={() => void incassa(aperta)} disabled={inCorso} className={CLASSE_SECONDARIO}>
                  No, è un altro incasso
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => conferma(aperta)}
                disabled={inCorso || !data || !conto || data < aperta.dataEmissione}
                className={CLASSE_PRIMARIO}
              >
                Segna incassata
              </button>
            )}
            <button type="button" onClick={() => setFoglio(null)} disabled={inCorso} className={CLASSE_LINK}>
              Annulla
            </button>
          </div>
        </FoglioInferiore>
      ) : null}

      {foglio?.modo === 'modifica' && aperta && aperta.dataIncasso === null ? (
        <FoglioInferiore titolo="Modifica la fattura" onClose={() => setFoglio(null)}>
          <NuovaFattura
            pagataAdessoIniziale={false}
            conti={conti}
            contoIniziale={contoIniziale}
            oggi={oggi}
            modifica={{
              cliente: aperta.cliente,
              importo: aperta.importo,
              dataEmissione: aperta.dataEmissione,
              nota: aperta.nota,
            }}
            onSalva={async (v) => {
              await updateFattura(createClient(), aperta.id, {
                cliente: v.cliente,
                importo: v.importo,
                dataEmissione: v.dataEmissione,
                nota: v.nota,
              });
              setFoglio(null);
              try {
                await onCambiato();
              } catch {
                // La modifica c'è: se la pagina non si aggiorna lo dice chi ricarica.
              }
            }}
          />
        </FoglioInferiore>
      ) : null}
    </>
  );
}
