'use client';

import { useEffect } from 'react';
import Link from 'next/link';

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
    <main className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center gap-4 p-6 text-center">
      <h1 className="text-xl font-bold">Non riesco a leggere la casa</h1>
      <p className="text-sm text-muted">I tuoi dati personali non sono toccati. Riprova tra un attimo.</p>
      <button
        type="button"
        onClick={() => retry()}
        className="rounded-[var(--radius-md)] bg-brand px-4 py-3 font-semibold text-brand-foreground"
      >
        Riprova
      </button>
      <Link href="/" className="text-sm font-semibold text-brand-dark">
        Torna alla home
      </Link>
    </main>
  );
}
