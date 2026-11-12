'use client';

import { format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';
import { formatNumero } from '@/lib/format';
import type { PlanBundle } from '@/lib/data/householdPlans';
import { totaleVociMensili } from '@/lib/calculations/casa/mensilizza';
import { fraseVersamento, descriviStatoPiano } from '@/lib/calculations/casa/fraseVersamento';
import { spiegaQuotaPersona, spiegaTotaleMensile, type Spiegazione } from '@/lib/calculations/casa/spiegazioni';
import type { PersonaQuotaInput } from '@/lib/calculations/casa/quota';
import { CLASSE_SCHEDA, CLASSE_SECONDARIO } from '../CampiMovimento';
import { ComeSiCalcola } from '../ComeSiCalcola';

const carta = CLASSE_SCHEDA;

export function PianoAttuale({
  bundle,
  meseCorrente,
  onRivedi,
}: {
  bundle: PlanBundle;
  meseCorrente: string;
  onRivedi: () => void;
}) {
  const { plan, items } = bundle;
  // Chi esce resta in elenco fino all'inizio del mese di uscita: finche e in casa la sua quota conta.
  const shares = bundle.shares.filter((s) => s.esceDal === null || s.esceDal > meseCorrente);
  const { stato, frase: fraseBozza } = descriviStatoPiano(shares);

  const sottotot = totaleVociMensili(items);
  const spiegazioneTotale = spiegaTotaleMensile({
    sottotot,
    cuscinettoQuotaMensile: plan.cuscinettoQuotaMensile,
    arrotondamento: plan.arrotondamento,
  });

  // Partecipa alla divisione chi versa o chi è già in casa alla data di questo piano.
  // Chi esce dopo l'inizio di questo piano versa una parte fissa: gli altri dividono il resto.
  const fisse = shares.filter((s) => s.esceDal !== null && s.esceDal > plan.validoDal && s.quotaMensile > 0);
  const partecipanti: PersonaQuotaInput[] = shares
    .filter((s) => !fisse.includes(s))
    .filter((s) => s.quotaMensile > 0 || s.inCasaDal === null || s.inCasaDal <= plan.validoDal)
    .map((s) => ({
      slot: s.slot,
      nome: s.displayName,
      redditoNetto: s.redditoNettoMensile,
      percentuale: s.percentuale,
    }));

  function spiegazione(slot: number): Spiegazione | null {
    if (!partecipanti.some((p) => p.slot === slot)) return null;
    try {
      return spiegaQuotaPersona({
        regola: plan.regola,
        sottotot,
        cuscinettoQuotaMensile: plan.cuscinettoQuotaMensile,
        arrotondamento: plan.arrotondamento,
        persone: partecipanti,
        slot,
        quoteFisse: fisse.map((f) => ({ nome: f.displayName, quota: f.quotaMensile })),
      });
    } catch {
      return null;
    }
  }

  const parteDopo = plan.validoDal > meseCorrente;

  return (
    <div className="flex flex-col gap-3.5">
      <section className={carta}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-serif text-lg font-semibold">La nostra quota</h2>
          <span className="rounded-full bg-brand-tint px-3 py-1 text-[13px] font-semibold text-brand-dark">
            {stato === 'bozza' ? 'Bozza' : 'Attivo'}
          </span>
        </div>
        <p className="text-[15px] font-semibold">
          {fraseVersamento({
            quote: shares.map((s) => ({ nome: s.displayName, quota: s.quotaMensile })),
            giorno: plan.giornoVersamento,
          })}
        </p>
        {parteDopo ? (
          <p className="text-[15px] text-ink-2">
            Parte da {format(parseISO(plan.validoDal), 'LLLL yyyy', { locale: it })}.
          </p>
        ) : null}
        {fraseBozza ? <p className="text-[15px] text-ink-2">{fraseBozza}</p> : null}
      </section>

      <section className={carta} data-testid="totale">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[15px]">
            Totale da versare ogni mese: <span className="num font-serif text-lg font-semibold">{formatNumero(plan.totaleMensile)} €</span>
          </p>
          <ComeSiCalcola spiegazione={spiegazioneTotale} />
        </div>
      </section>

      <section className={carta}>
        <h2 className="font-serif text-lg font-semibold">Quote</h2>
        <ul className="flex flex-col gap-3">
          {shares.map((s) => {
            const sp = spiegazione(s.slot);
            return (
              <li key={s.slot} className="flex flex-col gap-1">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[15px]">{s.displayName}</span>
                  {s.quotaMensile > 0 ? (
                    <span className="num text-[15px] font-semibold">{formatNumero(s.quotaMensile)} € al mese</span>
                  ) : (
                    <span className="text-[15px] text-ink-2">Nessun versamento in questo periodo</span>
                  )}
                </div>
                {sp && s.quotaMensile > 0 ? <ComeSiCalcola spiegazione={sp} /> : null}
              </li>
            );
          })}
        </ul>
      </section>

      <button type="button" onClick={onRivedi} className={CLASSE_SECONDARIO}>
        Rivedi la quota
      </button>
    </div>
  );
}
