import Link from 'next/link';
import type { CasaCorrente } from '@/lib/data/households';
import { formatEuro, nomeMese } from '@/lib/format';
import type { StatoVoceDaParte } from '@/lib/calculations/casa/fondi';
import type { Spiegazione } from '@/lib/calculations/casa/spiegazioni';
import type { CasaAggiunta } from '@/lib/loadCasaData';
import type { CasaHomeDati } from '@/lib/calculations/supporto/casaHome';
import { oggiRomaISO } from '@/lib/calculations/casa/oggi';
import type { Account } from '@/lib/types';
import { CoverHeader } from '../CoverHeader';
import { cifra, dividiCifra, giornoMese } from '../home/formati';
import { PallinoCategoria } from '../home/PallinoCategoria';
import { CasaFab } from './CasaFab';
import { ComeSiCalcola } from './ComeSiCalcola';
import type { DebitoMembro } from '@/lib/calculations/casa/debitiMembri';
import { CasaAzioni } from './CasaAzioni';
import { DaFareCard } from './DaFareCard';

const COLONNE = 'grid grid-cols-[2.75rem_minmax(0,1fr)_3.5rem_4.5rem] items-center gap-x-2 px-4';
const LINK_RIGA =
  'flex min-h-12 items-center justify-between rounded-[var(--radius-md)] border border-rule bg-surface px-4 text-[15px] font-semibold text-brand-dark';

// Nelle frasi gli importi tondi si scrivono senza decimali: "1.200 €".
const euroInFrase = (n: number): string => formatEuro(n).replace(',00', '');

export function CasaHome({
  casa,
  libretto,
  spiegazione,
  vociDaParte = [],
  aggiunta,
  contiPersonali,
  debiti = [],
  mesiArretrati = [],
  oggi = oggiRomaISO(),
}: {
  casa: CasaCorrente;
  libretto?: CasaHomeDati;
  spiegazione?: Spiegazione;
  // Le voci del piano non ancora messe da parte: servono al pulsante "Fatto" della card Da fare.
  vociDaParte?: StatoVoceDaParte[];
  aggiunta?: CasaAggiunta;
  contiPersonali?: Account[];
  // Servono ai fogli che si aprono dalla card Da fare: versamento, rimborso, restituzione.
  debiti?: DebitoMembro[];
  mesiArretrati?: string[];
  oggi?: string;
}) {
  if (!libretto) {
    return (
      <>
        <CoverHeader titolo="La casa" lato={`${nomeMese(oggi)} ${oggi.slice(0, 4)}`} />
        <main className="mx-auto flex max-w-md flex-col gap-3.5 px-3 pb-6 pt-3.5">
          <section className="rounded-[var(--radius-md)] border border-rule bg-surface p-4">
            <p className="text-[15px]">Non riesco a leggere conti e spese della casa. Riprova tra poco.</p>
          </section>
          <Link href="/casa/quota" className={LINK_RIGA}>
            Calcolate la nostra quota
          </Link>
          <Link href="/casa/impostazioni" className={LINK_RIGA}>
            Impostazioni
          </Link>
        </main>
      </>
    );
  }

  const { intero, resto } = dividiCifra(formatEuro(libretto.disponibile));
  const membri = casa.members.map((m) => ({ userId: m.userId, nome: m.displayName }));
  const nomi = Object.fromEntries(membri.map((m) => [m.userId, m.nome]));

  return (
    <CasaAzioni
      householdId={casa.household.id}
      meUserId={casa.me.userId}
      membri={membri}
      contiPersonali={contiPersonali ?? []}
      contiCasa={aggiunta?.conti ?? []}
      meseDefault={`${oggi.slice(0, 7)}-01`}
      mesiArretrati={mesiArretrati}
    >
      <CoverHeader titolo="La casa" lato={`${nomeMese(oggi)} ${oggi.slice(0, 4)}`} />

      <main className="mx-auto flex max-w-md flex-col gap-3.5 px-3 pb-6">
        <section className="rounded-b-[var(--radius-md)] border border-t-0 border-rule bg-page px-[18px] pb-4 pt-5">
          <p className="text-[13px] text-ink-2">Disponibile di casa</p>
          <p data-testid="disponibile" className="num mt-1.5 font-serif text-[56px] font-bold leading-none">
            {intero}
            {resto ? <span className="text-[28px]">{resto}</span> : null}
          </p>
          <p className="mt-2 text-[15px] text-ink-2">
            Spese di casa questo mese: <b className="num font-semibold text-foreground">{euroInFrase(libretto.spesoMese)}</b>
            {libretto.previstoMese !== null ? (
              <>
                {' '}su <span className="num">{euroInFrase(libretto.previstoMese)}</span> previsti
              </>
            ) : null}
          </p>
          {spiegazione ? <ComeSiCalcola spiegazione={spiegazione} className="mt-2" /> : null}
        </section>

        {libretto.daFare ? (
          <DaFareCard daFare={libretto.daFare} householdId={casa.household.id} oggi={oggi} voci={vociDaParte}
            meUserId={casa.me.userId}
            debiti={debiti}
            nomi={nomi}
          />
        ) : null}

        <section className="overflow-hidden rounded-[var(--radius-md)] border border-rule bg-surface">
          <h2 className="sr-only">Ultime spese di casa</h2>
          <div
            className={`${COLONNE} border-b-2 border-brand py-2.5 text-[11px] uppercase tracking-[0.1em] text-ink-2`}
            aria-hidden="true"
          >
            <span>Data</span>
            <span>Spesa</span>
            <span>Chi</span>
            <span className="text-right">Importo</span>
          </div>
          {libretto.ultime.length === 0 ? (
            <p className="px-4 py-5 text-[15px] text-ink-2">
              Ancora nessuna spesa di casa. Appena ne aggiungete una, la vede tutta la casa.
            </p>
          ) : (
            <ul>
              {libretto.ultime.map((r) => (
                <li key={r.id} className={`${COLONNE} min-h-12 border-b border-rule py-3 text-[15px]`}>
                  <span className="num text-[13px] text-ink-2">{giornoMese(r.data)}</span>
                  <span className="flex min-w-0 items-center gap-2">
                    <PallinoCategoria colore={r.colore} />
                    <span className="block truncate">{r.descrizione}</span>
                  </span>
                  <span className="truncate text-[13px] text-ink-2">{r.chi}</span>
                  <span className="num text-right">−{cifra(r.importo)}</span>
                </li>
              ))}
            </ul>
          )}
          <Link
            href="/casa/movimenti"
            className="flex min-h-11 items-center justify-center text-sm font-semibold text-brand-dark"
          >
            Tutti i movimenti
          </Link>
        </section>

        <Link href="/casa/dettagli" className={LINK_RIGA}>
          <span>Dettagli</span>
          <span aria-hidden="true">›</span>
        </Link>
      </main>

      {aggiunta ? <CasaFab aggiunta={aggiunta} contiPersonali={contiPersonali} /> : null}
    </CasaAzioni>
  );
}
