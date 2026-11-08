import Link from 'next/link';
import type { CasaCorrente } from '@/lib/data/households';

export function CasaHome({ casa }: { casa: CasaCorrente }) {
  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 p-5 pt-8">
      <h1 className="text-2xl font-bold">{casa.household.nome}</h1>

      <section className="flex flex-col gap-3 rounded-[var(--radius-lg)] bg-surface p-5 shadow-[var(--shadow-card)]">
        <h2 className="text-base font-bold">Chi c&apos;è in casa</h2>
        <ul className="flex flex-col gap-1.5">
          {casa.members.map((m) => (
            <li key={m.userId} className="text-sm">
              {m.displayName}
              {m.userId === casa.me.userId ? <span className="text-muted"> (tu)</span> : null}
            </li>
          ))}
        </ul>
      </section>

      <Link href="/casa/impostazioni" className="text-sm font-semibold text-brand-dark">
        Impostazioni
      </Link>
    </main>
  );
}
