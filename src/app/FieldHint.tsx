'use client';

import { useState } from 'react';
import { Info } from 'lucide-react';

export function FieldHint({ testo }: { testo: string }) {
  const [aperto, setAperto] = useState(false);

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        aria-label="Maggiori informazioni"
        onClick={(e) => {
          e.preventDefault();
          setAperto((v) => !v);
        }}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-cat-sky text-white"
      >
        <Info size={12} strokeWidth={2.5} />
      </button>
      {aperto && (
        <span className="absolute left-0 top-5 z-10 w-56 rounded-[var(--radius-sm)] bg-foreground p-2.5 text-xs font-normal normal-case text-surface shadow-[var(--shadow-card)]">
          {testo}
        </span>
      )}
    </span>
  );
}
