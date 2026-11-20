'use client';

import { useRef, useState } from 'react';
import { euroInFrase } from '@/lib/format';
import { fraseRientro } from '@/lib/calculations/rientriTesti';
import type { Rientro, SituazioneRientroConto } from '@/lib/calculations/rientri';

const AZIONE = 'inline-flex min-h-11 items-center text-[15px] font-semibold text-brand-dark disabled:opacity-40';

// La riga di un rientro sotto la card di un cassetto o di un conto. Un tocco alla volta.
export function RigaRientro({
  rientro,
  situazione,
  onFerma,
  onLasciaStare,
}: {
  rientro: Rientro;
  // Solo per i rientri verso un conto: quanto è maturato, spostato e resta da spostare.
  situazione?: SituazioneRientroConto;
  onFerma: () => Promise<void>;
  onLasciaStare?: () => Promise<void>;
}) {
  const [inCorso, setInCorso] = useState(false);
  const [errore, setErrore] = useState(false);
  const occupato = useRef(false);

  async function esegui(azione: () => Promise<void>) {
    if (occupato.current) return;
    occupato.current = true;
    setInCorso(true);
    setErrore(false);
    try {
      await azione();
    } catch {
      setErrore(true);
    }
    occupato.current = false;
    setInCorso(false);
  }

  const daSpostare = situazione?.daSpostare ?? 0;
  return (
    <div className="mt-2 flex flex-col gap-0.5 border-t border-rule pt-2 text-[13px] text-ink-2">
      <p className="num">{fraseRientro(rientro)}</p>
      {situazione ? <p className="num">{`Da spostare: ${euroInFrase(daSpostare)}`}</p> : null}
      {errore ? (
        <p role="alert" className="text-danger">
          Non è andata: riprova.
        </p>
      ) : null}
      <div className="flex flex-wrap gap-x-4">
        {rientro.stato === 'aperto' ? (
          <button type="button" disabled={inCorso} onClick={() => void esegui(onFerma)} className={AZIONE}>
            Ferma
          </button>
        ) : null}
        {onLasciaStare && situazione && daSpostare > 0 ? (
          <button type="button" disabled={inCorso} onClick={() => void esegui(onLasciaStare)} className={AZIONE}>
            Lascia stare
          </button>
        ) : null}
      </div>
    </div>
  );
}
