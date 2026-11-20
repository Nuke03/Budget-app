import Link from 'next/link';
import { Check, ChevronRight } from 'lucide-react';
import { LEZIONI } from '@/lib/percorso/lezioni';
import type { StatiLezioni } from '@/lib/percorso/tipi';
import { FumettoPrimaVolta } from '@/app/fumetti/FumettoPrimaVolta';

const linkClasse = 'flex min-h-[44px] items-center gap-3 px-4 py-3 text-base text-brand-dark';

// L'elenco della pagina Impara: le due porte in alto e le lezioni, con la spunta su quelle lette.
export function ElencoImpara({ primiPassiDaFinire, lezioni }: { primiPassiDaFinire: boolean; lezioni: StatiLezioni }) {
  return (
    <>
      <FumettoPrimaVolta
        id="impara"
        ancora="impara"
        testo="Lezioni da un minuto, con i tuoi numeri. Non c'è un ordine da seguire."
      />
      <ul className="mb-4 overflow-hidden rounded-[var(--radius-lg)] border border-rule bg-surface">
        {primiPassiDaFinire ? (
          <li className="border-b border-rule">
            <Link href="/impara/primi-passi" className={linkClasse}>
              <span className="flex-1 font-semibold">Primi passi</span>
              <ChevronRight size={18} className="shrink-0 text-ink-2" />
            </Link>
          </li>
        ) : null}
        <li>
          <Link href="/impara/attesa" className={linkClasse}>
            <span className="flex-1 font-semibold">Lista d&apos;attesa</span>
            <ChevronRight size={18} className="shrink-0 text-ink-2" />
          </Link>
        </li>
      </ul>
      <ol className="overflow-hidden rounded-[var(--radius-lg)] border border-rule bg-page">
        {LEZIONI.map((l, i) => {
          const letta = !!lezioni[l.id]?.vistaIl;
          return (
            <li key={l.id} data-fumetto={i === 0 ? 'impara' : undefined} className="border-b border-rule last:border-b-0">
              <Link href={`/impara/${l.id}`} className="flex min-h-[44px] items-center gap-3 px-4 py-3 text-base text-foreground">
                <span className="w-6 shrink-0 text-sm text-ink-2">{l.numero}</span>
                <span className="flex-1">{l.titolo}</span>
                {letta ? (
                  <span className="inline-flex items-center gap-1 text-sm text-ink-2">
                    <Check size={16} aria-hidden="true" />
                    letta
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ol>
    </>
  );
}
