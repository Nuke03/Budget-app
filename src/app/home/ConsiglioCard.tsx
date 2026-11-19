'use client';

import { useId, useState } from 'react';
import Link from 'next/link';
import type { Consiglio } from '@/lib/calculations/supporto/consiglio';

export function ConsiglioCard({ consiglio }: { consiglio: Consiglio }) {
  const [aperto, setAperto] = useState(false);
  const id = useId();
  return (
    <section className="rounded-[var(--radius-md)] border border-rule bg-surface p-4">
      <p className="text-[15px]">{consiglio.testo}</p>
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
        <div id={id}>
          <p className="text-sm text-ink-2">{consiglio.perche}</p>
          <Link
            href={`/impara/${consiglio.lezione}`}
            className="-mx-2 inline-flex min-h-11 items-center px-2 text-sm font-semibold text-brand-dark underline"
          >
            Leggi la lezione
          </Link>
        </div>
      ) : null}
    </section>
  );
}
