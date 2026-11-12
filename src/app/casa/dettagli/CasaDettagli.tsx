import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';
import type { CasaCorrente } from '@/lib/data/households';
import type { PlanBundle } from '@/lib/data/householdPlans';
import { formatEuro, formatNumero } from '@/lib/format';
import { descriviStatoPiano } from '@/lib/calculations/casa/fraseVersamento';
import { meseRomaISO } from '@/lib/calculations/casa/oggi';
import { CoverHeader } from '../../CoverHeader';
import { ComeSiCalcola } from '../ComeSiCalcola';
import { CodiceInvito } from '../CodiceInvito';
import { ContoComuneForm } from '../ContoComuneForm';
import { CasaAzioni } from '../CasaAzioni';
import { PannelliVersamenti } from '../PannelliVersamenti';
import type { FinanzeCasa } from '../finanzeCasa';

const SEZIONE = 'flex flex-col gap-3 rounded-[var(--radius-md)] border border-rule bg-surface p-4';
const TITOLO = 'font-serif text-lg font-semibold';
const LINK = 'inline-flex min-h-11 items-center text-[15px] font-semibold text-brand-dark';

// Tutto quello che sta sotto la Casa: il conto comune, i versamenti, chi c'è, la quota.
export function CasaDettagli({
  casa,
  piano = null,
  meseCorrente,
  finanze,
  origin,
  gestisce = false,
  mostraTricount = false,
}: {
  casa: CasaCorrente;
  piano?: PlanBundle | null;
  meseCorrente?: string;
  finanze?: FinanzeCasa;
  origin?: string;
  // Il codice di invito lo vede solo chi gestisce la casa.
  gestisce?: boolean;
  // Almeno due persone in casa e nessun saldo da Tricount ancora inserito.
  mostraTricount?: boolean;
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

  const corpo = finanze ? (
    <>
      <section className={SEZIONE}>
        <h2 className={TITOLO}>Conto comune</h2>
        {finanze.conti.length > 0 ? (
          <ul className="flex flex-col gap-1.5">
            {finanze.conti.map((c) => (
              <li key={c.id} className="flex justify-between text-[15px]">
                <span>{c.nome}</span>
                <span className="num font-semibold">{formatEuro(c.saldoAttuale)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <ContoComuneForm householdId={casa.household.id} />
        )}
        {finanze.cuscinetto ? (
          <div className="flex items-center justify-between gap-3 border-t border-rule pt-2 text-[15px]">
            <span className="num">
              Cuscinetto: {formatNumero(finanze.cuscinetto.attuale)} € di {formatNumero(finanze.cuscinetto.obiettivo)} €
            </span>
            <ComeSiCalcola spiegazione={finanze.disponibile.spiegazione} />
          </div>
        ) : null}
        {finanze.conti.length > 0 ? (
          <>
            {(finanze.speseNonRegistrate ?? 0) > 0 ? (
              <p className="text-sm text-ink-2">
                Spese non registrate questo mese: {formatNumero(finanze.speseNonRegistrate ?? 0)} €
              </p>
            ) : null}
            <Link href="/casa/controllo/conto" className={LINK}>
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

      {(finanze.fondiBollette?.length ?? 0) > 0 || (finanze.bolletteDaMettere ?? 0) > 0 ? (
        <section className={SEZIONE}>
          <h2 className={TITOLO}>Da parte per le bollette</h2>
          {(finanze.fondiBollette?.length ?? 0) > 0 ? (
            <ul className="flex flex-col gap-1.5">
              {finanze.fondiBollette!.map((f) => (
                <li key={f.id} className="flex justify-between gap-3 text-[15px]">
                  <span>{f.nome}</span>
                  <span className="num font-semibold">
                    {`${formatNumero(f.accantonato)} di ${formatNumero(f.importoTarget)} €`}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
          {(finanze.bolletteDaMettere ?? 0) > 0 ? (
            <p className="text-[15px]">
              {finanze.bolletteDaMettere === 1
                ? '1 bolletta non è ancora messa da parte'
                : `${finanze.bolletteDaMettere} bollette non sono ancora messe da parte`}
            </p>
          ) : null}
          <Link href="/casa/da-parte" className={LINK}>
            Vai a Da parte
          </Link>
        </section>
      ) : null}
    </>
  ) : (
    <section className={SEZIONE}>
      <p className="text-[15px]">Non riesco a leggere conti e spese della casa. Riprova tra poco.</p>
    </section>
  );

  return (
    <>
      <CoverHeader titolo="Dettagli della casa" />
      <main className="mx-auto flex max-w-md flex-col gap-3.5 px-3 pb-6 pt-3.5">
        <Link href="/casa" className={LINK}>
          ‹ La casa
        </Link>

        {finanze ? (
          <CasaAzioni
            householdId={casa.household.id}
            meUserId={casa.me.userId}
            membri={membri}
            contiPersonali={finanze.contiPersonali ?? []}
            contiCasa={finanze.conti}
            meseDefault={meseVersamenti}
            mesiArretrati={(finanze.righe?.[casa.me.userId] ?? []).filter((r) => r.mancano > 0).map((r) => r.mese)}
          >
            {corpo}
          </CasaAzioni>
        ) : (
          corpo
        )}

        <section className={SEZIONE}>
          <h2 className={TITOLO}>Chi c&apos;è in casa</h2>
          <ul className="flex flex-col gap-1.5">
            {casa.members.map((m) => (
              <li key={m.userId} className="text-[15px]">
                {m.displayName}
                {m.userId === casa.me.userId ? <span className="text-ink-2"> (tu)</span> : null}
              </li>
            ))}
          </ul>
          {gestisce && casa.invite ? <CodiceInvito codice={casa.invite.codice} origin={origin} /> : null}
        </section>

        <section className={SEZIONE}>
          <h2 className={TITOLO}>La nostra quota</h2>
          {piano && stato ? (
            <>
              <p className="text-[15px]">
                {etichetta}: totale da versare ogni mese{' '}
                <span className="num font-bold">{formatNumero(piano.plan.totaleMensile)} €</span>
              </p>
              {stato.frase ? <p className="text-sm text-ink-2">{stato.frase}</p> : null}
              <Link href="/casa/quota" className={LINK}>
                Vedi la quota
              </Link>
            </>
          ) : (
            <Link href="/casa/quota" className={LINK}>
              Calcolate la nostra quota
            </Link>
          )}
        </section>

        {mostraTricount ? (
          <Link
            href="/casa/impostazioni#saldo-tricount"
            className="flex min-h-12 items-center justify-between rounded-[var(--radius-md)] border border-rule bg-surface px-4 text-[15px] font-semibold text-brand-dark"
          >
            Venite da Tricount? Inserisci il saldo di oggi
            <span aria-hidden="true">›</span>
          </Link>
        ) : null}

        <Link href="/casa/impostazioni" className={LINK}>
          Impostazioni
        </Link>
      </main>
    </>
  );
}
