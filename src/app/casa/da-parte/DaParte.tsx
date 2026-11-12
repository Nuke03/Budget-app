'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  anteprimaDaParte,
  scadenzeProposte,
  ultimaScadenza,
  type ObiettivoCasa,
  type StatoVoceDaParte,
} from '@/lib/calculations/casa/fondi';
import { formatDateIt, formatNumero } from '@/lib/format';
import type { PlanItem } from '@/lib/types';
import { GoalsList } from '@/app/goals/GoalsList';
import { closeGoal } from '@/lib/data/goals';
import { CoverHeader } from '../../CoverHeader';
import { CLASSE_CAMPO, CLASSE_LINK, CLASSE_PRIMARIO, CLASSE_SCHEDA } from '../CampiMovimento';
import { ComeSiCalcola } from '../ComeSiCalcola';
import { CostiIngresso } from './CostiIngresso';
import { NuovaCosa } from './NuovaCosa';
import { ERRORE_DA_PARTE as ERRORE, useMettiDaParte } from '../useMettiDaParte';

function testoFrequenza(mesi: number): string {
  return mesi === 12 ? "l'anno" : `ogni ${mesi} mesi`;
}

function nomeMeseAnno(dataISO: string): string {
  return new Intl.DateTimeFormat('it-IT', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(`${dataISO}T12:00:00Z`)
  );
}

export function DaParte({
  householdId,
  oggi,
  haPiano,
  voci,
  fondi,
  unaVolta,
  canonePiano = 0,
}: {
  householdId: string;
  oggi: string;
  haPiano: boolean;
  voci: StatoVoceDaParte[];
  fondi: ObiettivoCasa[];
  unaVolta: ObiettivoCasa[];
  canonePiano?: number;
}) {
  const router = useRouter();
  const [scelte, setScelte] = useState<Record<string, string>>({});
  const [aperte, setAperte] = useState<Record<string, boolean>>({});
  const { metti: mettiVoci, inCorso, errore, fatte } = useMettiDaParte({ householdId, oggi });
  const [chiedePagato, setChiedePagato] = useState<string | null>(null);
  const [chiudendo, setChiudendo] = useState(false);
  const [errorePagato, setErrorePagato] = useState<string | null>(null);
  const chiudeRef = useRef(false);

  async function pagato(id: string) {
    if (chiudeRef.current) return;
    chiudeRef.current = true;
    setChiudendo(true);
    setErrorePagato(null);
    try {
      await closeGoal(createClient(), id);
      setChiedePagato(null);
      router.refresh();
    } catch {
      setErrorePagato(ERRORE);
    } finally {
      chiudeRef.current = false;
      setChiudendo(false);
    }
  }

  const daMettere = voci.filter((v) => v.stato === 'da_mettere' && !fatte.includes(v.item.id));
  const scadenzaDi = (item: PlanItem) => scelte[item.id] ?? ultimaScadenza(item, oggi);

  const metti = (elenco: StatoVoceDaParte[]) => mettiVoci(elenco, scadenzaDi);

  if (!haPiano) {
    return (
      <>
        <CoverHeader titolo="Da parte per le bollette" />
        <main className="mx-auto flex max-w-md flex-col gap-3.5 px-3 pb-6 pt-3.5">
          <section className={CLASSE_SCHEDA}>
            <p className="text-[15px]">Prima calcolate la quota: servono le voci per sapere cosa mettere da parte.</p>
            <Link href="/casa/quota" className={CLASSE_LINK}>
              Calcolate la nostra quota
            </Link>
          </section>
        </main>
      </>
    );
  }

  return (
    <>
    <CoverHeader titolo="Da parte per le bollette" />
    <main className="mx-auto flex max-w-md flex-col gap-3.5 px-3 pb-6 pt-3.5">
      <section className="flex flex-col gap-3">
        <h2 className="font-serif text-lg font-semibold">Da parte, mese per mese</h2>
        {voci.length === 0 ? (
          <p className="text-[15px] text-ink-2">Nel piano non ci sono bollette da mettere da parte.</p>
        ) : null}

        {daMettere.map(({ item }) => {
          const scadenza = scadenzaDi(item);
          const a = anteprimaDaParte({
            importoRicorrenza: item.importoRicorrenza,
            frequenzaMesi: item.frequenzaMesi,
            scadenza,
            oggi,
          });
          const tutto = a.allaPrimaScadenza >= item.importoRicorrenza;
          return (
            <div key={item.id} className={CLASSE_SCHEDA}>
              <p className="text-[15px] font-semibold">
                {`${item.nome}, circa ${formatNumero(item.importoRicorrenza)} € ${testoFrequenza(item.frequenzaMesi)}: ${formatNumero(a.quotaMensile)} € al mese da ora.`}
              </p>
              <p className="flex flex-wrap items-center gap-x-2 text-[13px] text-ink-2">
                {`La prossima rata è entro il ${formatDateIt(scadenza)}. `}
                {!aperte[item.id] ? (
                  <button
                    type="button"
                    onClick={() => setAperte((x) => ({ ...x, [item.id]: true }))}
                    className="inline-flex min-h-11 items-center px-1 text-[15px] font-semibold text-brand-dark"
                  >
                    Cambia
                  </button>
                ) : null}
              </p>
              {aperte[item.id] ? (
                <label className="flex flex-col gap-1.5 text-[13px] text-ink-2">
                  Quando arriva la prossima rata?
                  <select
                    value={scadenza}
                    onChange={(e) => setScelte((s) => ({ ...s, [item.id]: e.target.value }))}
                    className={CLASSE_CAMPO}
                  >
                    {scadenzeProposte({ oggi, frequenzaMesi: item.frequenzaMesi }).map((d) => (
                      <option key={d} value={d}>
                        {nomeMeseAnno(d)}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <p className="text-[13px] text-ink-2">
                {tutto
                  ? 'Entro la prima scadenza avrete messo da parte tutto.'
                  : `Per questa prima volta avrete messo da parte ${formatNumero(a.allaPrimaScadenza)} di ${formatNumero(item.importoRicorrenza)} €; il resto verrà dal cuscinetto. Dalla seconda, ${formatNumero(item.importoRicorrenza)} su ${formatNumero(item.importoRicorrenza)}.`}
              </p>
              <button
                type="button"
                disabled={inCorso}
                onClick={() => metti([{ item, goal: null, stato: 'da_mettere' }])}
                className={CLASSE_PRIMARIO}
              >
                Metti da parte
              </button>
            </div>
          );
        })}

        {daMettere.length > 1 ? (
          <button
            type="button"
            disabled={inCorso}
            onClick={() => metti(daMettere)}
            className={CLASSE_PRIMARIO}
          >
            Metti da parte tutto
          </button>
        ) : null}
        {errore ? (
          <p role="alert" className="text-[15px] text-danger">
            {errore}
          </p>
        ) : null}

        <GoalsList goals={fondi} categories={[]} variante="casa" />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-serif text-lg font-semibold">Da pagare una volta</h2>
        {unaVolta.length === 0 ? (
          <p className="text-[15px] text-ink-2">Ancora niente da pagare una volta.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {unaVolta.map((g) => (
              <li
                key={g.id}
                className="flex flex-col gap-1 rounded-[var(--radius-md)] border border-rule bg-surface p-4"
              >
                <p className="num text-[15px] font-semibold">{`${g.nome}: ${formatNumero(g.importoTarget)} €`}</p>
                <p className="num text-[13px] text-ink-2">
                  {`Messi da parte ${formatNumero(g.accantonato)} €${g.scadenza ? `, entro il ${formatDateIt(g.scadenza)}` : ''}.`}
                </p>
                <ComeSiCalcola spiegazione={g.spiegazione} />
                <button
                  type="button"
                  onClick={() => setChiedePagato(g.id)}
                  className={`${CLASSE_LINK} self-start`}
                >
                  L&apos;ho pagato
                </button>
                {chiedePagato === g.id ? (
                  <p className="flex flex-wrap items-center gap-x-3 text-[13px]">
                    Prima registra la spesa nei movimenti della casa, collegata a questo fondo. Poi tocca &quot;L&apos;ho pagato&quot;: il fondo si chiude e i soldi tornano disponibili. Non si può annullare da qui.
                    <button
                      type="button"
                      disabled={chiudendo}
                      onClick={() => pagato(g.id)}
                      className="inline-flex min-h-11 items-center text-[15px] font-semibold text-brand-dark disabled:opacity-50"
                    >
                      Conferma
                    </button>
                    <button type="button" onClick={() => setChiedePagato(null)} className="inline-flex min-h-11 items-center text-[15px] font-semibold text-ink-2">
                      Annulla
                    </button>
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {errorePagato ? (
          <p role="alert" className="text-[15px] text-danger">
            {errorePagato}
          </p>
        ) : null}
        <NuovaCosa householdId={householdId} oggi={oggi} />
      </section>

      <CostiIngresso
        householdId={householdId}
        oggi={oggi}
        canonePiano={canonePiano}
        esistenti={unaVolta.map((g) => g.nome)}
      />
    </main>
    </>
  );
}
