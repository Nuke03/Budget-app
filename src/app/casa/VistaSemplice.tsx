'use client';

import Link from 'next/link';
import type { CasaCorrente } from '@/lib/data/households';
import { formatEuro, nomeMese } from '@/lib/format';
import type { DebitoMembro } from '@/lib/calculations/casa/debitiMembri';
import type { CasaHomeDati } from '@/lib/calculations/supporto/casaHome';
import type { CasaAggiunta } from '@/lib/loadCasaData';
import type { Account } from '@/lib/types';
import { EVENTO_AGGIUNGI, type DettaglioAggiungi } from '@/lib/eventoAggiungi';
import { CoverHeader } from '../CoverHeader';
import { dividiCifra } from '../home/formati';
import { CasaAzioni, useCasaAzioni } from './CasaAzioni';
import { CasaFab } from './CasaFab';

const euroInFrase = (n: number): string => formatEuro(n).replace(',00', '');
const RIGA = 'flex min-h-11 items-center border-b border-rule py-3 text-[15px]';

function Stato({ casa, stato, debiti }: { casa: CasaCorrente; stato: CasaHomeDati['vistaSemplice']['stato']; debiti: DebitoMembro[] }) {
  const { apri } = useCasaAzioni();
  if (stato.tipo === 'pari') return <p className={RIGA}>Siete in pari</p>;
  if (stato.tipo === 'ti_deve') {
    return (
      <p className={RIGA}>
        {stato.da} ti deve&nbsp;<b className="num font-semibold">{euroInFrase(stato.importo)}</b>
      </p>
    );
  }
  const creditore = casa.members.find((m) => m.displayName === stato.a);
  const debito = creditore
    ? debiti.find((d) => d.debitoreId === casa.me.userId && d.creditoreId === creditore.userId)
    : undefined;
  const testo = (
    <>
      Devi&nbsp;<b className="num font-semibold">{euroInFrase(stato.importo)}</b>&nbsp;a {stato.a}
    </>
  );
  if (!debito) return <p className={RIGA}>{testo}</p>;
  return (
    <button
      type="button"
      onClick={() => apri({ tipo: 'restituisci', debito, nomeCreditore: stato.a })}
      className={`${RIGA} w-full justify-between text-left font-normal text-brand-dark`}
    >
      <span>{testo}</span>
      <span aria-hidden="true">›</span>
    </button>
  );
}

function PulsanteAggiungi() {
  function aggiungi() {
    const dettaglio: DettaglioAggiungi = { gestito: false, casa: true };
    window.dispatchEvent(new CustomEvent(EVENTO_AGGIUNGI, { detail: dettaglio }));
  }
  return (
    <button
      type="button"
      onClick={aggiungi}
      className="flex min-h-14 w-full items-center justify-center rounded-[var(--radius-md)] bg-brand text-base font-semibold text-brand-foreground"
    >
      Aggiungi una spesa di casa
    </button>
  );
}

// La Casa di chi non la gestisce: la quota, chi deve a chi, e un solo gesto.
export function VistaSemplice({
  casa,
  vista,
  aggiunta,
  contiPersonali,
  debiti = [],
  mesiArretrati = [],
  oggi,
}: {
  casa: CasaCorrente;
  vista: CasaHomeDati['vistaSemplice'];
  aggiunta?: CasaAggiunta;
  contiPersonali?: Account[];
  debiti?: DebitoMembro[];
  mesiArretrati?: string[];
  oggi: string;
}) {
  const mese = nomeMese(oggi);
  const membri = casa.members.map((m) => ({ userId: m.userId, nome: m.displayName }));
  const { quota, entroGiorno, versato, stato, creditoVersoCasa } = vista;
  const versata = quota !== null && versato >= quota;
  const cifra = quota !== null ? dividiCifra(formatEuro(quota)) : null;

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
      <CoverHeader titolo="La casa" lato={`${mese} ${oggi.slice(0, 4)}`} />
      <main className="mx-auto flex max-w-md flex-col gap-5 px-5 pb-6 pt-5">
        <section>
          {quota === null ? (
            <p className="text-[15px]">La quota non è ancora stata calcolata.</p>
          ) : versata ? (
            <p className="text-[15px]">Hai già versato la quota di {mese}.</p>
          ) : (
            <>
              <p className="text-[15px] text-ink-2">
                La tua quota di {mese}
              </p>
              <p data-testid="quota" className="num mt-1.5 font-serif text-[56px] font-bold leading-none">
                {cifra?.intero}
                {cifra?.resto ? <span className="text-[28px]">{cifra.resto}</span> : null}
                <span className="text-[28px]"> €</span>
              </p>
              {entroGiorno ? <p className="mt-1.5 text-[15px] text-ink-2">entro il {entroGiorno}</p> : null}
            </>
          )}
        </section>

        <section className="border-t border-rule">
          <Stato casa={casa} stato={stato} debiti={debiti} />
          {creditoVersoCasa > 0 ? (
            <p className={RIGA}>
              La casa ti deve&nbsp;<b className="num font-semibold">{euroInFrase(creditoVersoCasa)}</b>
            </p>
          ) : null}
        </section>

        <PulsanteAggiungi />

        <Link href="/casa?vista=completa" className="flex min-h-11 items-center justify-center text-sm font-semibold text-brand-dark">
          Vedi tutto
        </Link>
      </main>
      {aggiunta ? <CasaFab aggiunta={aggiunta} contiPersonali={contiPersonali} /> : null}
    </CasaAzioni>
  );
}
