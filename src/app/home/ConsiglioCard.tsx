'use client';

import { useId, useState } from 'react';
import type { Consiglio } from '@/lib/calculations/supporto/consiglio';

export function ConsiglioCard({ consiglio }: { consiglio: Consiglio }) {
  const [aperto, setAperto] = useState(false);
  const id = useId();
  return (
    <section className="rounded-[var(--radius-md)] bg-surface p-4 shadow-[var(--shadow-card)]">
      <p className="text-xs font-semibold uppercase tracking-[0.1em] text-brand-dark">Un consiglio</p>
      <p className="mt-1 text-[15px]">{consiglio.testo}</p>
      <button
        type="button"
        aria-expanded={aperto}
        aria-controls={id}
        onClick={() => setAperto((a) => !a)}
        className="-mx-2 mt-1 inline-flex min-h-11 items-center px-2 text-sm font-semibold text-brand-dark"
      >
        Perché?
      </button>
      {aperto ? (
        <p id={id} className="text-sm text-ink-2">
          {consiglio.perche}
        </p>
      ) : null}
    </section>
  );
}
