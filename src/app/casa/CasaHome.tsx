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
import type { DebitoMembro } from '@/lib/calculations/casa/debitiMembri';
import type { RigaMese } from '@/lib/calculations/casa/versamenti';
import { computeReminders, statoPromemoria } from '@/lib/calculations/casa/promemoria';
import { riferimentoControllo } from '@/lib/calculations/casa/controlloSaldo';
import { meseRomaISO, oggiRomaISO } from '@/lib/calculations/casa/oggi';
import type { Account, Transaction } from '@/lib/types';
import { ComeSiCalcola } from './ComeSiCalcola';
import { ContoComuneForm } from './ContoComuneForm';
import { CasaFab } from './CasaFab';
import { CasaAzioni, StrisciaPromemoriaCasa } from './CasaAzioni';
import { PannelliVersamenti } from './PannelliVersamenti';

export interface FinanzeCasa {
  disponibile: DisponibileCasa;
  cuscinetto?: { attuale: number; obiettivo: number; quotaMensile: number } | null;
  conti: Account[];
  ultimeSpese: Transaction[];
  nomi: Record<string, string>;
  aggiunta: CasaAggiunta;
  contiPersonali?: Account[];
  righe?: Record<string, RigaMese[]>;
  debiti?: DebitoMembro[];
  crediti?: Record<string, number>;
  // I fondi aperti per le bollette e quante voci del piano non sono ancora messe da parte.
  fondiBollette?: { id: string; nome: string; accantonato: number; importoTarget: number }[];
  bolletteDaMettere?: number;
  // L'ultimo controllo del saldo e le spese che il controllo ha segnato questo mese.
  ultimoControllo?: string | null;
  // Il mese dell'ultimo check-in fatto: serve al promemoria del check-in.
  ultimoCheckinMese?: string | null;
  speseNonRegistrate?: number;
}

export function CasaHome({
  casa,
  piano = null,
  meseCorrente,
  finanze,
  oggi = oggiRomaISO(),
}: {
  casa: CasaCorrente;
  piano?: PlanBundle | null;
  meseCorrente?: string;
  finanze?: FinanzeCasa;
  oggi?: string;
}) {
  const stato = piano ? descriviStatoPiano(piano.shares.filter((s) => s.esceDal === null)) : null;
  // Un piano attivo che parte in un mese futuro non e ancora in corso.
  const partenza =
    piano && meseCorrente && piano.plan.validoDal > meseCorrente
      ? format(parseISO(piano.plan.validoDal), 'LLLL yyyy', { locale: it })
      : null;
  const etichetta = stato?.stato === 'bozza' ? 'Bozza' : partenza ? `Parte da ${partenza}` : 'Attivo';

  const meseVersamenti = meseCorrente ?? meseRomaISO();
  const membri = casa.members.map((m) => ({ userId: m.userId, nome: m.displayName }));
  const nomiMembri = Object.fromEntries(membri.map((m) => [m.userId, m.nome]));
  const promemoria = finanze
    ? computeReminders(
        statoPromemoria({
          piano,
          righe: finanze.righe?.[casa.me.userId] ?? [],
          oggi,
          nomi: nomiMembri,
          crediti: finanze.crediti ?? {},
          debiti: finanze.debiti ?? [],
          controllo: {
            ultimo: finanze.ultimoControllo ?? null,
            riferimento: riferimentoControllo(casa.me.joinedAt, finanze.conti),
            haConto: finanze.conti.length > 0,
          },
          ultimoCheckinMese: finanze.ultimoCheckinMese,
        }),
        { userId: casa.me.userId },
        oggi
      )
    : [];

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 p-5 pt-8">
      <h1 className="text-2xl font-bold">{casa.household.nome}</h1>

      {finanze ? (
        <>
          <CasaAzioni
            householdId={casa.household.id}
            meUserId={casa.me.userId}
            membri={membri}
            contiPersonali={finanze.contiPersonali ?? []}
            contiCasa={finanze.conti}
            meseDefault={meseVersamenti}
            mesiArretrati={(finanze.righe?.[casa.me.userId] ?? []).filter((r) => r.mancano > 0).map((r) => r.mese)}
          >
            <StrisciaPromemoriaCasa
              promemoria={promemoria}
              oggi={oggi}
              meUserId={casa.me.userId}
              debiti={finanze.debiti ?? []}
              nomi={nomiMembri}
            />
            <section className="rounded-[var(--radius-lg)] bg-brand p-7 text-brand-foreground shadow-[var(--shadow-hero)]">
              <p className="text-sm font-medium text-brand-foreground/75">Disponibile casa</p>
              <p className="mt-1 text-5xl font-bold tabular-nums tracking-tight">
                {formatEuro(finanze.disponibile.valore)}
              </p>
              <ComeSiCalcola spiegazione={finanze.disponibile.spiegazione} className="mt-4" />
              {finanze.cuscinetto ? (
                <p className="mt-4 border-t border-brand-foreground/20 pt-4 text-sm font-medium text-brand-foreground/75">
                  Cuscinetto {formatNumero(finanze.cuscinetto.attuale)} di {formatNumero(finanze.cuscinetto.obiettivo)} €
                </p>
              ) : null}
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
              {finanze.conti.length > 0 ? (
                <>
                  {(finanze.speseNonRegistrate ?? 0) > 0 ? (
                    <p className="text-sm text-muted">
                      Spese non registrate questo mese: {formatNumero(finanze.speseNonRegistrate ?? 0)} €
                    </p>
                  ) : null}
                  <Link href="/casa/controllo/conto" className="text-sm font-semibold text-brand-dark">
                    Controlla il conto
                  </Link>
                </>
              ) : null}
            </section>

            {piano ? (
              <PannelliVersamenti
                meUserId={casa.me.userId}
                membri={membri}
                righe={finanze.righe ?? {}}
                debiti={finanze.debiti ?? []}
                crediti={finanze.crediti ?? {}}
                meseCorrente={meseVersamenti}
              />
            ) : null}
          </CasaAzioni>

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

          {(finanze.fondiBollette?.length ?? 0) > 0 || (finanze.bolletteDaMettere ?? 0) > 0 ? (
            <section className="flex flex-col gap-3 rounded-[var(--radius-lg)] bg-surface p-5 shadow-[var(--shadow-card)]">
              <h2 className="text-base font-bold">Da parte per le bollette</h2>
              {(finanze.fondiBollette?.length ?? 0) > 0 ? (
                <ul className="flex flex-col gap-1.5">
                  {finanze.fondiBollette!.map((f) => (
                    <li key={f.id} className="flex justify-between gap-3 text-sm">
                      <span>{f.nome}</span>
                      <span className="font-semibold tabular-nums">
                        {`${formatNumero(f.accantonato)} di ${formatNumero(f.importoTarget)} €`}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
              {(finanze.bolletteDaMettere ?? 0) > 0 ? (
                <p className="text-sm">
                  {finanze.bolletteDaMettere === 1
                    ? '1 bolletta non è ancora messa da parte'
                    : `${finanze.bolletteDaMettere} bollette non sono ancora messe da parte`}
                </p>
              ) : null}
              <Link href="/casa/da-parte" className="text-sm font-semibold text-brand-dark">
                Vai a Da parte
              </Link>
            </section>
          ) : null}
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

      {finanze ? <CasaFab aggiunta={finanze.aggiunta} contiPersonali={finanze.contiPersonali} /> : null}
    </main>
  );
}
