'use client';

import { Trash2 } from 'lucide-react';
import { formatEuro, formatDateIt } from '@/lib/format';
import type { RigaNeutra } from '@/lib/calculations/casa/righeNeutre';

export function StoricoCasa({
  righe,
  titolo = 'Movimenti con la casa',
  id = 'movimenti-con-la-casa',
  nota,
  onElimina,
}: {
  righe: RigaNeutra[];
  titolo?: string;
  id?: string;
  // Una riga sotto il titolo, per spiegare cosa sono questi movimenti.
  nota?: string;
  // Se c'è, ogni riga si può togliere (con Annulla).
  onElimina?: (r: RigaNeutra) => void;
}) {
  if (righe.length === 0) return null;
  return (
    <section
      aria-labelledby={id}
      className="overflow-hidden rounded-[var(--radius-md)] border border-rule bg-surface"
    >
      <h2 id={id} className="px-4 pb-2 pt-4 font-serif text-lg font-semibold">
        {titolo}
      </h2>
      {nota ? <p className="px-4 pb-2 text-[13px] text-ink-2">{nota}</p> : null}
      <ul>
        {righe.map((r) => (
          <li
            key={r.id}
            className="flex min-h-12 items-center justify-between gap-3 border-t border-rule px-4 py-3"
          >
            <div className="min-w-0">
              <p className="text-[15px]">{r.etichetta}</p>
              <p className="num text-[13px] text-ink-2">{formatDateIt(r.data)}</p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
            <span className="num text-[15px] text-ink-2">
              {r.verso === 'entra' ? '+' : r.verso === 'esce' ? '−' : ''}
              {formatEuro(r.importo)}
            </span>
            {onElimina ? (
              <button
                type="button"
                onClick={() => onElimina(r)}
                aria-label={`Elimina: ${r.etichetta}`}
                className="flex size-11 shrink-0 items-center justify-center rounded-full text-ink-2 hover:bg-brand-tint"
              >
                <Trash2 size={18} aria-hidden="true" />
              </button>
            ) : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
