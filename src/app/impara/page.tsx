import Link from 'next/link';
import { Check, ChevronRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { conUtente } from '@/lib/utenteOLogin';
import { loadPercorsoData } from '@/lib/loadPercorsoData';
import { LEZIONI } from '@/lib/percorso/lezioni';
import { CoverHeader } from '../CoverHeader';

const linkClasse = 'flex min-h-[44px] items-center gap-3 px-4 py-3 text-base text-brand-dark';

export default async function ImparaPage() {
  const supabase = await createClient();
  const { dati } = await conUtente(supabase, () => loadPercorsoData(supabase));
  return (
    <>
      <CoverHeader titolo="Impara" />
      <main className="mx-auto max-w-xl px-4 pb-28 pt-5">
        <ul className="mb-4 overflow-hidden rounded-[var(--radius-lg)] border border-rule bg-surface">
          {dati.primiPassi.visibile ? (
            <li className="border-b border-rule">
              <Link href="/impara/primi-passi" className={linkClasse}>
                <span className="flex-1 font-semibold">Primi passi</span>
                <ChevronRight size={18} className="shrink-0 text-ink-2" />
              </Link>
            </li>
          ) : null}
          <li>
            <Link href="/impara/lista-attesa" className={linkClasse}>
              <span className="flex-1 font-semibold">Lista d&apos;attesa</span>
              <ChevronRight size={18} className="shrink-0 text-ink-2" />
            </Link>
          </li>
        </ul>
        <ol className="overflow-hidden rounded-[var(--radius-lg)] border border-rule bg-page">
          {LEZIONI.map((l) => {
            const letta = !!dati.lezioni[l.id]?.vistaIl;
            return (
              <li key={l.id} className="border-b border-rule last:border-b-0">
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
      </main>
    </>
  );
}
