'use client';

import { useEffect, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Lezione } from '@/lib/percorso/lezioni';
import { apriLezione, lezioneFatta, rimandaLezione } from './actions';

// `anteprima`: nella pagina di prova non si scrive niente, nemmeno il visto.
export function SchedaLezione({
  lezione,
  numeri,
  anteprima = false,
}: {
  lezione: Lezione;
  numeri: string | null;
  anteprima?: boolean;
}) {
  const router = useRouter();
  const [inCorso, avvia] = useTransition();

  // La lezione si segna come vista all'apertura.
  useEffect(() => {
    if (!anteprima) void apriLezione(lezione.id);
  }, [lezione.id, anteprima]);

  function provaOra() {
    if (!lezione.prova) return;
    const href = lezione.prova.href;
    avvia(async () => {
      try {
        await lezioneFatta(lezione.id);
      } catch {
        // segnare il fatto è una comodità: si va avanti lo stesso
      }
      router.push(href);
    });
  }

  function piuTardi() {
    avvia(async () => {
      try {
        await rimandaLezione(lezione.id);
      } catch {
        // rimandare è una comodità: si torna all'elenco lo stesso
      }
      router.push('/impara');
    });
  }

  const bottone =
    'inline-flex min-h-11 items-center justify-center rounded-[var(--radius-md)] px-4 text-base font-semibold disabled:opacity-60';

  return (
    <main className="mx-auto max-w-xl px-4 pb-28 pt-5">
      <h2 className="font-serif text-xl font-semibold text-foreground">{lezione.titolo}</h2>

      <section className="mt-4">
        <h3 className="text-sm font-semibold text-ink-2">In breve</h3>
        <p className="mt-1 text-[15px]">{lezione.inBreve}</p>
      </section>

      <section className="mt-4 rounded-[var(--radius-md)] border border-rule bg-surface p-4">
        <h3 className="text-sm font-semibold text-ink-2">{numeri ? 'Con i tuoi numeri' : 'Per esempio'}</h3>
        <p className="mt-1 text-[15px]">{numeri ?? lezione.esempio}</p>
      </section>

      <div className="mt-5 flex flex-col gap-2">
        {lezione.prova ? (
          <button type="button" disabled={inCorso} onClick={provaOra} className={`${bottone} bg-brand text-white`}>
            {lezione.prova.etichetta}
          </button>
        ) : null}
        <button type="button" disabled={inCorso} onClick={piuTardi} className={`${bottone} border border-rule text-brand-dark`}>
          Più tardi
        </button>
      </div>

      {lezione.link.length > 0 ? (
        <section className="mt-6">
          <h3 className="text-sm font-semibold text-ink-2">Per saperne di più</h3>
          <ul className="mt-1">
            {lezione.link.map((k) => (
              <li key={k.url}>
                <a
                  href={k.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center text-[15px] text-brand-dark underline"
                >
                  {k.etichetta}
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
