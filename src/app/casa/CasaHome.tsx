import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';
import type { CasaCorrente } from '@/lib/data/households';
import type { PlanBundle } from '@/lib/data/householdPlans';
import { formatEuro, formatNumero } from '@/lib/format';
import { descriviStatoPiano } from '@/lib/calculations/casa/fraseVersamento';
import { etichettaChiHaPagato } from '@/lib/calculations/casa/etichette';
import type { DisponibileCasa } from '@/lib/calculations/casa/disponibileCasa';
import type { CasaAggiunta } from '@/lib/loadCasaData';
import type { Account, Transaction } from '@/lib/types';
import { ComeSiCalcola } from './ComeSiCalcola';
import { ContoComuneForm } from './ContoComuneForm';
import { CasaFab } from './CasaFab';

export interface FinanzeCasa {
  disponibile: DisponibileCasa;
  conti: Account[];
  ultimeSpese: Transaction[];
  nomi: Record<string, string>;
  aggiunta: CasaAggiunta;
}

export function CasaHome({
  casa,
  piano = null,
  meseCorrente,
  finanze,
}: {
  casa: CasaCorrente;
  piano?: PlanBundle | null;
  meseCorrente?: string;
  finanze?: FinanzeCasa;
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

      {finanze ? (
        <>
          <section className="rounded-[var(--radius-lg)] bg-brand p-7 text-brand-foreground shadow-[var(--shadow-hero)]">
            <p className="text-sm font-medium text-brand-foreground/75">Disponibile casa</p>
            <p className="mt-1 text-5xl font-bold tabular-nums tracking-tight">
              {formatEuro(finanze.disponibile.valore)}
            </p>
            <ComeSiCalcola spiegazione={finanze.disponibile.spiegazione} className="mt-4" />
          </section>

          <section className="flex flex-col gap-3 rounded-[var(--radius-lg)] bg-surface p-5 shadow-[var(--shadow-card)]">
            <h2 className="text-base font-bold">Conto comune</h2>
            {finanze.conti.length > 0 ? (
              <ul className="flex flex-col gap-1.5">
                {finanze.conti.map((c) => (
                  <li key={c.id} className="flex justify-between text-sm">
                    <span>{c.nome}</span>
                    <span className="font-semibold tabular-nums">{formatEuro(c.saldoAttuale)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <ContoComuneForm householdId={casa.household.id} />
            )}
          </section>

          <section className="flex flex-col gap-3 rounded-[var(--radius-lg)] bg-surface p-5 shadow-[var(--shadow-card)]">
            <h2 className="text-base font-bold">Ultime spese di casa</h2>
            {finanze.ultimeSpese.length > 0 ? (
              <ul className="flex flex-col gap-2">
                {finanze.ultimeSpese.slice(0, 5).map((t) => (
                  <li key={t.id} className="flex justify-between gap-3 text-sm">
                    <span className="flex flex-col">
                      <span>{t.descrizione}</span>
                      <span className="text-xs text-muted">
                        {etichettaChiHaPagato(t, finanze.conti, finanze.nomi)}
                      </span>
                    </span>
                    <span className="font-semibold tabular-nums">-{formatEuro(t.importo)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">Ancora nessuna spesa di casa.</p>
            )}
            <Link href="/casa/movimenti" className="text-sm font-semibold text-brand-dark">
              Vedi tutte
            </Link>
          </section>
        </>
      ) : null}

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

      {finanze ? <CasaFab aggiunta={finanze.aggiunta} /> : null}
    </main>
  );
}
