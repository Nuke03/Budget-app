'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { creaFondiIngresso } from '@/lib/data/fondiCasa';
import {
  anteprimaGraduale,
  AVVISO_COSTI,
  calcolaCostiIngresso,
  controllaDataIngresso,
  COSTI_INGRESSO,
  totaleCosti,
} from '@/lib/calculations/casa/costiIngresso';
import { parseImporto } from '@/lib/calculations/casa/parseImporto';
import { formatNumero } from '@/lib/format';
import { CLASSE_CAMPO, CLASSE_LINK, CLASSE_PRIMARIO } from '../CampiMovimento';
import { ComeSiCalcola } from '../ComeSiCalcola';

const ERRORE = 'Salvataggio fallito, controlla la connessione e riprova.';
const DATA_PASSATA = 'La data di ingresso è già passata.';

export function CostiIngresso({
  householdId,
  oggi,
  canonePiano,
  esistenti,
}: {
  householdId: string;
  oggi: string;
  canonePiano: number;
  esistenti: string[];
}) {
  const router = useRouter();
  const [canoneTesto, setCanoneTesto] = useState(canonePiano > 0 ? String(canonePiano) : '');
  const [data, setData] = useState('');
  const [modifica, setModifica] = useState(false);
  const [mesi, setMesi] = useState(2);
  const [cedolare, setCedolare] = useState(false);
  const [agenzia, setAgenzia] = useState(false);
  const [arredoTesto, setArredoTesto] = useState('');
  const [inCorso, setInCorso] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [fatto, setFatto] = useState(false);
  const occupato = useRef(false);
  // Nomi già scritti, anche da un tentativo finito male a metà.
  const creati = useRef<Set<string>>(new Set());

  const canone = parseImporto(canoneTesto);
  const arredo = arredoTesto.trim() === '' ? 0 : parseImporto(arredoTesto);
  const valido = canone !== null && canone > 0 && arredo !== null;
  const voci = valido
    ? calcolaCostiIngresso({
        canoneMensile: canone,
        mesiDeposito: mesi,
        cedolareSecca: cedolare,
        agenzia,
        numeroUtenze: COSTI_INGRESSO.utenzeIniziali,
        arredo,
      })
    : [];
  const attive = voci.filter((v) => v.importo > 0);
  const totale = totaleCosti(
    voci,
    attive.map((v) => v.chiave)
  );
  const dataStato = data === '' ? null : controllaDataIngresso(data, oggi);
  const puoMettere = valido && dataStato === 'ok' && attive.length > 0 && !inCorso && !fatto;

  async function metti() {
    if (occupato.current || !puoMettere) return;
    occupato.current = true;
    setInCorso(true);
    setErrore(null);
    try {
      await creaFondiIngresso(createClient(), {
        householdId,
        scadenza: data,
        oggi,
        voci: attive.map((v) => ({ nome: v.nome, importo: v.importo })),
        esistenti: [...esistenti, ...creati.current],
        onCreato: (nome) => creati.current.add(nome),
      });
      setFatto(true);
    } catch {
      setErrore(ERRORE);
    } finally {
      occupato.current = false;
      setInCorso(false);
      router.refresh();
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-serif text-lg font-semibold">Costi per entrare in casa</h2>
      <p className="text-[13px] text-ink-2">{AVVISO_COSTI}</p>

      <label className="flex flex-col gap-1.5 text-[13px] text-ink-2">
        Canone al mese (€)
        <input
          inputMode="decimal"
          value={canoneTesto}
          onChange={(e) => setCanoneTesto(e.target.value)}
          className={CLASSE_CAMPO}
        />
      </label>
      <label className="flex flex-col gap-1.5 text-[13px] text-ink-2">
        Data di ingresso
        <input
          type="date"
          value={data}
          onChange={(e) => setData(e.target.value)}
          className={CLASSE_CAMPO}
        />
      </label>
      {dataStato === 'passata' ? (
        <p role="alert" className="text-[15px] text-danger">
          {DATA_PASSATA}
        </p>
      ) : null}

      {valido ? (
        <>
          <ul className="flex flex-col gap-2">
            {attive.map((v) => {
              const a =
                dataStato === 'ok' ? anteprimaGraduale({ importo: v.importo, scadenza: data, oggi }) : null;
              return (
                <li
                  key={v.chiave}
                  className="flex flex-col gap-1 rounded-[var(--radius-md)] border border-rule bg-surface p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[15px] font-semibold">{v.nome}</span>
                    <span className="num flex items-center gap-2 text-[15px] font-semibold">
                      {`${formatNumero(v.importo)} €`}
                      <ComeSiCalcola spiegazione={v.spiegazione} />
                    </span>
                  </div>
                  {v.nota ? <p className="text-[13px] text-ink-2">{v.nota}</p> : null}
                  {v.chiave === 'deposito' ? (
                    <p className="text-[13px] text-ink-2">Importo indicativo, controllate il contratto.</p>
                  ) : null}
                  {a ? (
                    <p className="text-[13px] text-ink-2">
                      {`Mettete da parte ${formatNumero(v.importo)} € in ${a.mesi} ${a.mesi === 1 ? 'mese' : 'mesi'}: ${formatNumero(a.quotaMensile)} € al mese`}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
          <p className="num font-serif text-lg font-semibold">{`Totale: ${formatNumero(totale)} €`}</p>
        </>
      ) : (
        <p className="text-[15px] text-ink-2">Scrivete il canone e l&apos;eventuale arredo come numeri, per vedere i costi.</p>
      )}

      {!modifica ? (
        <button
          type="button"
          onClick={() => setModifica(true)}
          className={`${CLASSE_LINK} self-start`}
        >
          Modifica
        </button>
      ) : (
        <div className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-rule bg-brand-tint p-3 text-[15px]">
          <label className="flex flex-col gap-1.5 text-[13px] text-ink-2">
            Mensilità di deposito
            <select
              value={mesi}
              onChange={(e) => setMesi(Number(e.target.value))}
              className={CLASSE_CAMPO}
            >
              {[1, 2, 3].map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-h-11 items-center gap-2">
            <input type="checkbox" checked={cedolare} onChange={(e) => setCedolare(e.target.checked)} />
            Cedolare secca
          </label>
          <label className="flex min-h-11 items-center gap-2">
            <input type="checkbox" checked={agenzia} onChange={(e) => setAgenzia(e.target.checked)} />
            Agenzia immobiliare
          </label>
          <label className="flex flex-col gap-1.5 text-[13px] text-ink-2">
            Arredo (€)
            <input
              inputMode="decimal"
              value={arredoTesto}
              onChange={(e) => setArredoTesto(e.target.value)}
              className={CLASSE_CAMPO}
            />
          </label>
        </div>
      )}

      <button
        type="button"
        disabled={!puoMettere}
        onClick={metti}
        className={CLASSE_PRIMARIO}
      >
        Metti da parte i costi per entrare
      </button>
      {fatto ? <p className="text-[15px]">{'Fatto: trovate le voci qui sopra, in "Da pagare una volta".'}</p> : null}
      {errore ? (
        <p role="alert" className="text-[15px] text-danger">
          {errore}
        </p>
      ) : null}
    </section>
  );
}
