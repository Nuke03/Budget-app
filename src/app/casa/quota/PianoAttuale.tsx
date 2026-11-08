'use client';

import { format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';
import { formatNumero } from '@/lib/format';
import type { PlanBundle } from '@/lib/data/householdPlans';
import { totaleVociMensili } from '@/lib/calculations/casa/mensilizza';
import { fraseVersamento, descriviStatoPiano } from '@/lib/calculations/casa/fraseVersamento';
import { spiegaQuotaPersona, spiegaTotaleMensile, type Spiegazione } from '@/lib/calculations/casa/spiegazioni';
import type { PersonaQuotaInput } from '@/lib/calculations/casa/quota';
import { ComeSiCalcola } from '../ComeSiCalcola';

const carta = 'flex flex-col gap-3 rounded-[var(--radius-lg)] bg-surface p-5 shadow-[var(--shadow-card)]';

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
  const shares = bundle.shares.filter((s) => s.esceDal === null);
  const { stato, frase: fraseBozza } = descriviStatoPiano(shares);

  const sottotot = totaleVociMensili(items);
  const spiegazioneTotale = spiegaTotaleMensile({
    sottotot,
    cuscinettoQuotaMensile: plan.cuscinettoQuotaMensile,
    arrotondamento: plan.arrotondamento,
  });

  // Partecipa alla divisione chi versa o chi è già in casa alla data di questo piano.
  const partecipanti: PersonaQuotaInput[] = shares
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
      });
    } catch {
      return null;
    }
  }

  const parteDopo = plan.validoDal > meseCorrente;

  return (
    <div className="flex flex-col gap-6">
      <section className={carta}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-bold">La nostra quota</h2>
          <span className="rounded-full bg-surface-muted px-3 py-1 text-xs font-semibold">
            {stato === 'bozza' ? 'Bozza' : 'Attivo'}
          </span>
        </div>
        <p className="text-base font-semibold">
          {fraseVersamento({
            quote: shares.map((s) => ({ nome: s.displayName, quota: s.quotaMensile })),
            giorno: plan.giornoVersamento,
          })}
        </p>
        {parteDopo ? (
          <p className="text-sm text-muted">
            Parte da {format(parseISO(plan.validoDal), 'LLLL yyyy', { locale: it })}.
          </p>
        ) : null}
        {fraseBozza ? <p className="text-sm text-muted">{fraseBozza}</p> : null}
      </section>

      <section className={carta} data-testid="totale">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm">
            Totale da versare ogni mese: <span className="font-bold">{formatNumero(plan.totaleMensile)} €</span>
          </p>
          <ComeSiCalcola spiegazione={spiegazioneTotale} />
        </div>
      </section>

      <section className={carta}>
        <h2 className="text-base font-bold">Quote</h2>
        <ul className="flex flex-col gap-3">
          {shares.map((s) => {
            const sp = spiegazione(s.slot);
            return (
              <li key={s.slot} className="flex flex-col gap-1">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm">{s.displayName}</span>
                  {s.quotaMensile > 0 ? (
                    <span className="text-sm font-bold">{formatNumero(s.quotaMensile)} € al mese</span>
                  ) : (
                    <span className="text-sm text-muted">Nessun versamento in questo periodo</span>
                  )}
                </div>
                {sp && s.quotaMensile > 0 ? <ComeSiCalcola spiegazione={sp} /> : null}
              </li>
            );
          })}
        </ul>
      </section>

      <button
        type="button"
        onClick={onRivedi}
        className="rounded-[var(--radius-md)] border border-black/10 px-4 py-3 text-sm font-semibold"
      >
        Rivedi la quota
      </button>
    </div>
  );
}
