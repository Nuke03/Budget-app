'use client';

import { formatEuro, formatDateIt } from '@/lib/format';
import type { RigaNeutra } from '@/lib/calculations/casa/righeNeutre';

export function StoricoCasa({ righe }: { righe: RigaNeutra[] }) {
  if (righe.length === 0) return null;
  return (
    <section aria-labelledby="movimenti-con-la-casa" className="flex flex-col gap-2">
      <h2 id="movimenti-con-la-casa" className="text-sm font-semibold text-muted">
        Movimenti con la casa
      </h2>
      <ul className="flex flex-col gap-2">
        {righe.map((r) => (
          <li
            key={r.id}
            className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] bg-surface-muted p-3"
          >
            <div>
              <p className="text-sm font-medium">{r.etichetta}</p>
              <p className="text-xs text-muted">{formatDateIt(r.data)}</p>
            </div>
            <span className="tabular-nums text-sm text-muted">
              {r.verso === 'entra' ? '+' : '-'}
              {formatEuro(r.importo)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
