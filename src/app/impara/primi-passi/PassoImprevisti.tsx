'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { MESI_MASSIMI_IMPREVISTI, QUOTA_IMPREVISTI, TRAGUARDO_IMPREVISTI } from '@/lib/calculations/percorso/soglie';
import { mesiPerTraguardo } from '@/lib/calculations/percorso/primiPassiFondi';
import { creaFondoImprevisti } from './actions';
import { CAMPO, ERRORE_TESTO, ETICHETTA, PRIMARIO } from './stili';

const DOMANDE = [
  'Qualcuno dipende dai tuoi soldi?',
  'Le tue entrate cambiano da un mese all’altro?',
  'Hai un’auto o una casa da mantenere?',
];

const comeNumero = (s: string): number => Number(s.replace(',', '.'));

export function PassoImprevisti({ giaCreato }: { giaCreato: boolean }) {
  const router = useRouter();
  const [inCorso, avvia] = useTransition();
  const [errore, setErrore] = useState(false);
  const [traguardo, setTraguardo] = useState(String(TRAGUARDO_IMPREVISTI));
  const [quota, setQuota] = useState(String(QUOTA_IMPREVISTI));
  const [si, setSi] = useState<boolean[]>(DOMANDE.map(() => false));

  const t = comeNumero(traguardo);
  const q = comeNumero(quota);
  const validi =
    Number.isFinite(t) && t > 0 && Number.isFinite(q) && q > 0 && mesiPerTraguardo(t, q) <= MESI_MASSIMI_IMPREVISTI;
  const quanteSi = si.filter(Boolean).length;

  function crea() {
    setErrore(false);
    avvia(async () => {
      try {
        await creaFondoImprevisti({ traguardo: t, quota: q });
        router.refresh();
      } catch {
        setErrore(true);
      }
    });
  }

  if (giaCreato) {
    return <p className="mt-5 text-[15px]">Il cuscinetto per gli imprevisti c’è già: lo trovi fra i tuoi obiettivi.</p>;
  }

  return (
    <div className="mt-5 flex flex-col gap-4">
      <p className="text-[15px]">Il cuscinetto cresce un poco ogni mese: non si mette da parte tutto in una volta.</p>
      <fieldset className="flex flex-col gap-1">
        <legend className={ETICHETTA}>Tre domande per scegliere la cifra</legend>
        {DOMANDE.map((d, i) => (
          <label key={d} className="flex min-h-11 items-center gap-3 text-[15px]">
            <input
              type="checkbox"
              checked={si[i]}
              onChange={(e) => setSi((prima) => prima.map((v, k) => (k === i ? e.target.checked : v)))}
              className="size-5"
            />
            {d}
          </label>
        ))}
        {quanteSi >= 2 ? (
          <p className="text-sm text-ink-2">Con più di una risposta sì, un cuscinetto un po’ più grande può dare più respiro.</p>
        ) : null}
      </fieldset>

      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1">
          <span className={ETICHETTA}>Quanto vuoi avere (€)</span>
          <input inputMode="decimal" value={traguardo} onChange={(e) => setTraguardo(e.target.value)} className={CAMPO} />
        </label>
        <label className="flex flex-col gap-1">
          <span className={ETICHETTA}>Quanto metti ogni mese (€)</span>
          <input inputMode="decimal" value={quota} onChange={(e) => setQuota(e.target.value)} className={CAMPO} />
        </label>
      </div>
      {validi ? <p className="text-sm text-ink-2">{`Ci arrivi in circa ${mesiPerTraguardo(t, q)} mesi.`}</p> : null}

      <button type="button" disabled={!validi || inCorso} onClick={crea} className={PRIMARIO}>
        Crea il cuscinetto
      </button>
      {errore ? <p role="alert" className="text-sm text-ink-2">{ERRORE_TESTO}</p> : null}
    </div>
  );
}
