'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check } from 'lucide-react';
import type { PrimiPassi } from '@/lib/calculations/percorso/passi';
import { PASSI_TESTI } from '@/lib/percorso/passiTesti';
import { nascondiPrimiPassi } from '@/app/impara/primi-passi/actions';

// La scheda dei primi passi: prende il posto del consiglio finché l'avvio non è finito.
export function PrimiPassiCard({ primiPassi }: { primiPassi: PrimiPassi }) {
  const router = useRouter();
  const [inCorso, avvia] = useTransition();
  const [errore, setErrore] = useState(false);
  const prossimo = primiPassi.prossimo;

  function piuTardi() {
    setErrore(false);
    avvia(async () => {
      try {
        await nascondiPrimiPassi();
        router.refresh();
      } catch {
        setErrore(true);
      }
    });
  }

  return (
    <section aria-label="Primi passi" className="rounded-[var(--radius-md)] border border-rule bg-surface p-4">
      <div className="flex items-baseline justify-between">
        <h2 className="font-serif text-lg font-semibold">Primi passi</h2>
        <p className="text-sm text-ink-2">{`${primiPassi.fatti} di ${primiPassi.totale}`}</p>
      </div>
      <ul className="mt-2">
        {primiPassi.passi.map((p) => (
          <li key={p.id} className="flex min-h-8 items-center gap-2 text-[15px]">
            {p.fatto ? (
              <Check size={16} aria-hidden="true" className="shrink-0 text-brand-dark" />
            ) : (
              <span aria-hidden="true" className="inline-block size-4 shrink-0 rounded-full border border-rule" />
            )}
            <span className={p.fatto ? 'text-ink-2' : undefined}>{PASSI_TESTI[p.id].titolo}</span>
            <span className="sr-only">{p.fatto ? ', fatto' : ', da fare'}</span>
          </li>
        ))}
      </ul>
      {prossimo ? (
        <Link
          href={`/impara/primi-passi/${prossimo}`}
          className="mt-3 flex min-h-11 items-center justify-center rounded-[var(--radius-md)] bg-brand px-4 text-base font-semibold text-white"
        >
          {PASSI_TESTI[prossimo].titolo}
        </Link>
      ) : null}
      <button
        type="button"
        disabled={inCorso}
        onClick={piuTardi}
        className="-mx-2 mt-1 inline-flex min-h-11 items-center px-2 text-sm font-semibold text-brand-dark disabled:opacity-60"
      >
        Li vedo più tardi
      </button>
      {errore ? <p role="alert" className="text-sm text-ink-2">Non sono riuscito a salvare. Riprova.</p> : null}
    </section>
  );
}
