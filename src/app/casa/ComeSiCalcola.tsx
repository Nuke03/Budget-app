'use client';

import { useId, useState } from 'react';
import { formatEuro, formatNumero } from '@/lib/format';
import type { Spiegazione } from '@/lib/calculations/casa/spiegazioni';

// Conteggi e percentuali non sono euro: gli altri ingredienti sì.
function formatIngrediente(etichetta: string, valore: number): string {
  if (etichetta === 'Numero di persone') return formatNumero(valore);
  if (etichetta === 'Percentuale scelta') return `${formatNumero(valore)}%`;
  return formatEuro(valore);
}

export function ComeSiCalcola({ spiegazione, className }: { spiegazione: Spiegazione; className?: string }) {
  const [aperto, setAperto] = useState(false);
  const pannelloId = useId();

  return (
    <div className={className}>
      <button
        type="button"
        aria-label="Come si calcola?"
        aria-expanded={aperto}
        aria-controls={pannelloId}
        onClick={() => setAperto((a) => !a)}
        className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-black/10 text-xs font-bold text-brand-dark"
      >
        ?
      </button>
      {aperto ? (
        <div id={pannelloId} className="mt-2 flex flex-col gap-2 rounded-[var(--radius-md)] bg-surface-muted p-3 text-sm">
          {spiegazione.formula.split('\n').map((riga, i) => (
            <p key={i}>{riga}</p>
          ))}
          {spiegazione.ingredienti.length > 0 ? (
            <ul className="flex flex-col gap-1">
              {spiegazione.ingredienti.map((ing) => (
                <li key={ing.etichetta} className="flex justify-between gap-3">
                  <span className="text-muted">{ing.etichetta}</span>
                  <span className="font-semibold">{formatIngrediente(ing.etichetta, ing.valore)}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
