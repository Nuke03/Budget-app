import Link from 'next/link';
import { Check, ChevronRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { conUtente } from '@/lib/utenteOLogin';
import { loadPercorsoLeggero } from '@/lib/loadPercorsoData';
import { PASSI_TESTI } from '@/lib/percorso/passiTesti';
import { CoverHeader } from '../../CoverHeader';

export default async function PrimiPassiPage() {
  const supabase = await createClient();
  const { dati } = await conUtente(supabase, (id) => loadPercorsoLeggero(supabase, new Date(), id));
  const { passi, fatti, totale } = dati.primiPassi;
  return (
    <>
      <CoverHeader titolo="Impara" lato={`${fatti} di ${totale}`} />
      <main className="mx-auto max-w-xl px-4 pb-28 pt-5">
        <h2 className="font-serif text-xl font-semibold text-foreground">Primi passi</h2>
        <ol className="mt-4 overflow-hidden rounded-[var(--radius-lg)] border border-rule bg-surface">
          {passi.map((p) => (
            <li key={p.id} className="border-b border-rule last:border-b-0">
              <Link
                href={`/impara/primi-passi/${p.id}`}
                className="flex min-h-[44px] items-center gap-3 px-4 py-3 text-base text-foreground"
              >
                <span className="flex-1">
                  <span className="block font-semibold">{PASSI_TESTI[p.id].titolo}</span>
                  <span className="block text-sm text-ink-2">{PASSI_TESTI[p.id].riga}</span>
                </span>
                {p.fatto ? (
                  <span className="inline-flex items-center gap-1 text-sm text-ink-2">
                    <Check size={16} aria-hidden="true" />
                    fatto
                  </span>
                ) : (
                  <ChevronRight size={18} className="shrink-0 text-ink-2" aria-hidden="true" />
                )}
              </Link>
            </li>
          ))}
        </ol>
      </main>
    </>
  );
}
