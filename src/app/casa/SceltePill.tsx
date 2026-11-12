'use client';

import { useRef, type KeyboardEvent } from 'react';

export interface OpzionePill {
  chiave: string;
  etichetta: string;
}

const PILL =
  'inline-flex min-h-11 items-center rounded-full border-2 px-4 py-2 text-left text-[15px] font-semibold';
const PILL_SCELTA = 'border-brand bg-brand text-brand-foreground';
const PILL_LIBERA = 'border-rule bg-surface text-foreground';

// Una scelta tra poche opzioni, in stile pill. Si comporta come un gruppo di radio:
// una sola opzione è raggiungibile col Tab, le frecce spostano la scelta.
export function SceltePill({
  legenda,
  opzioni,
  valore,
  onChange,
}: {
  legenda: string;
  opzioni: OpzionePill[];
  valore: string | null;
  onChange: (chiave: string) => void;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const scelta = opzioni.findIndex((o) => o.chiave === valore);
  const raggiungibile = scelta >= 0 ? scelta : 0;

  function tasto(e: KeyboardEvent<HTMLButtonElement>, i: number) {
    const passo =
      e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (passo === 0) return;
    e.preventDefault();
    const prossima = (i + passo + opzioni.length) % opzioni.length;
    onChange(opzioni[prossima].chiave);
    refs.current[prossima]?.focus();
  }

  return (
    <div role="radiogroup" aria-label={legenda} className="flex flex-wrap gap-2">
      {opzioni.map((o, i) => {
        const attiva = i === scelta;
        return (
          <button
            key={o.chiave}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={attiva}
            tabIndex={i === raggiungibile ? 0 : -1}
            onClick={() => onChange(o.chiave)}
            onKeyDown={(e) => tasto(e, i)}
            className={`${PILL} ${attiva ? PILL_SCELTA : PILL_LIBERA}`}
          >
            {o.etichetta}
          </button>
        );
      })}
    </div>
  );
}
