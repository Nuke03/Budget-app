'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { CoverHeader } from '../CoverHeader';
import { CLASSE_LINK, CLASSE_PRIMARIO } from './CampiMovimento';

export default function CasaError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <>
      <CoverHeader titolo="Casa" />
      <main className="mx-auto flex max-w-md flex-col gap-3.5 px-3 pb-6 pt-3.5">
        <section className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-rule bg-surface p-4">
          <h2 className="font-serif text-lg font-semibold">Non riesco a leggere la casa</h2>
          <p className="text-[15px] text-ink-2">I tuoi dati personali non sono toccati. Riprova tra un attimo.</p>
          <button type="button" onClick={() => retry()} className={CLASSE_PRIMARIO}>
            Riprova
          </button>
        </section>
        <Link href="/" className={CLASSE_LINK}>
          Torna alla home
        </Link>
      </main>
    </>
  );
}
