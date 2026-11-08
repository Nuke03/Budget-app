import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';
import type { CasaCorrente } from '@/lib/data/households';
import type { PlanBundle } from '@/lib/data/householdPlans';
import { formatNumero } from '@/lib/format';
import { descriviStatoPiano } from '@/lib/calculations/casa/fraseVersamento';

export function CasaHome({
  casa,
  piano = null,
  meseCorrente,
}: {
  casa: CasaCorrente;
  piano?: PlanBundle | null;
  meseCorrente?: string;
}) {
  const stato = piano ? descriviStatoPiano(piano.shares.filter((s) => s.esceDal === null)) : null;
  // Un piano attivo che parte in un mese futuro non e ancora in corso.
  const partenza =
    piano && meseCorrente && piano.plan.validoDal > meseCorrente
      ? format(parseISO(piano.plan.validoDal), 'LLLL yyyy', { locale: it })
      : null;
  const etichetta = stato?.stato === 'bozza' ? 'Bozza' : partenza ? `Parte da ${partenza}` : 'Attivo';

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

      <section className="flex flex-col gap-3 rounded-[var(--radius-lg)] bg-surface p-5 shadow-[var(--shadow-card)]">
        <h2 className="text-base font-bold">La nostra quota</h2>
        {piano && stato ? (
          <>
            <p className="text-sm">
              {etichetta}: totale da versare ogni mese{' '}
              <span className="font-bold">{formatNumero(piano.plan.totaleMensile)} €</span>
            </p>
            {stato.frase ? <p className="text-sm text-muted">{stato.frase}</p> : null}
            <Link href="/casa/quota" className="text-sm font-semibold text-brand-dark">
              Vedi la quota
            </Link>
          </>
        ) : (
          <Link href="/casa/quota" className="text-sm font-semibold text-brand-dark">
            Calcolate la nostra quota
          </Link>
        )}
      </section>

      <Link href="/casa/impostazioni" className="text-sm font-semibold text-brand-dark">
        Impostazioni
      </Link>
    </main>
  );
}
