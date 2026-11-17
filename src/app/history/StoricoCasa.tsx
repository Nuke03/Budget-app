'use client';

import { formatEuro, formatDateIt } from '@/lib/format';
import type { RigaNeutra } from '@/lib/calculations/casa/righeNeutre';

export function StoricoCasa({ righe }: { righe: RigaNeutra[] }) {
  if (righe.length === 0) return null;
  return (
    <section
      aria-labelledby="movimenti-con-la-casa"
      className="overflow-hidden rounded-[var(--radius-md)] border border-rule bg-surface"
    >
      <h2 id="movimenti-con-la-casa" className="px-4 pb-2 pt-4 font-serif text-lg font-semibold">
        Movimenti con la casa
      </h2>
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
            <span className="num shrink-0 text-[15px] text-ink-2">
              {r.verso === 'entra' ? '+' : '−'}
              {formatEuro(r.importo)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
