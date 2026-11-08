'use client';

import { useEffect } from 'react';

export default function AppError({
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
      <h1 className="text-xl font-bold">Non riesco a raggiungere il database</h1>
      <p className="text-sm text-muted">
        Può succedere se il servizio dati è temporaneamente fermo o la connessione è instabile. I tuoi
        dati non sono persi.
      </p>
      <button
        type="button"
        onClick={() => retry()}
        className="rounded-[var(--radius-md)] bg-brand px-4 py-3 font-semibold text-brand-foreground"
      >
        Riprova
      </button>
    </main>
  );
}
