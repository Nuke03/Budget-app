'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { StatoVoceDaParte } from '@/lib/calculations/casa/fondi';
import type { DaFareCasa } from '@/lib/calculations/supporto/casaHome';
import { formatEuro } from '@/lib/format';
import type { DebitoMembro } from '@/lib/calculations/casa/debitiMembri';
import { azioneDaPromemoria, useCasaAzioni } from './CasaAzioni';
import { dataFraMesi, usePromemoriaRimandati } from './rimandaPromemoria';
import { MESI_DALLA_QUOTA } from '@/lib/calculations/casa/promemoria';
import { useMettiDaParte } from './useMettiDaParte';
import { useSegnalaCasa } from '../CasaSegnale';

const CARD = 'rounded-[var(--radius-md)] border border-rule bg-surface-muted p-4';

// "Da fare": una sola cosa alla volta, la prima dei candidati non rimandata con "Più tardi".
// L'accantonamento si fa qui; il resto apre la sua pagina.
export function DaFareCard({
  daFare: candidati,
  householdId,
  oggi,
  voci,
  meUserId,
  debiti = [],
  nomi = {},
}: {
  daFare: DaFareCasa[];
  householdId: string;
  oggi: string;
  voci: StatoVoceDaParte[];
  meUserId?: string;
  debiti?: DebitoMembro[];
  nomi?: Record<string, string>;
}) {
  const { metti, inCorso, errore, fatte } = useMettiDaParte({ householdId, oggi });
  const { apri } = useCasaAzioni();
  const { rimandati, rimanda, rimandaFino } = usePromemoriaRimandati(
    candidati.flatMap((d) => (d.tipo === 'promemoria' ? [d.id] : [])),
    oggi
  );
  const daFare = candidati.find((d) => d.tipo !== 'promemoria' || !rimandati.has(d.id));
  // La barra segna la Casa finché c'è una cosa da fare non rimandata.
  useSegnalaCasa(Boolean(daFare));
  if (!daFare) return null;
  const piuTardi =
    daFare.tipo === 'promemoria' ? (
      <div className="flex gap-4">
        <button
          type="button"
          onClick={() => rimanda(daFare.id)}
          className="inline-flex min-h-11 items-center self-start text-[15px] font-semibold text-ink-2"
        >
          Più tardi
        </button>
        {daFare.silenzia ? (
          <button
            type="button"
            onClick={() => rimandaFino(daFare.silenzia as string[], dataFraMesi(oggi, MESI_DALLA_QUOTA))}
            className="inline-flex min-h-11 items-center self-start text-[15px] font-semibold text-ink-2"
          >
            Va bene così
          </button>
        ) : null}
      </div>
    ) : null;

  if (daFare.tipo !== 'da_parte') {
    // Versamento, rimborso e restituzione si registrano subito, nel foglio, senza cambiare pagina.
    const az = daFare.tipo === 'promemoria' ? daFare.azione : undefined;
    const azione = az && meUserId ? azioneDaPromemoria(az, meUserId, debiti, nomi) : null;
    if (azione) {
      return (
        <section aria-labelledby="da-fare" className="flex flex-col gap-1.5">
          <h2 id="da-fare" className="font-serif text-lg font-semibold">
            Da fare
          </h2>
          <button
            type="button"
            onClick={() => apri(azione)}
            className={`${CARD} flex min-h-12 w-full items-center justify-between gap-3 text-left text-[15px]`}
          >
            <span>{daFare.testo}</span>
            <ChevronRight size={18} aria-hidden="true" className="shrink-0 text-brand-dark" />
          </button>
          {piuTardi}
        </section>
      );
    }
    // Senza azione e senza pagina propria (un credito in attesa): si guarda nei Dettagli.
    const href = daFare.href === '/casa' ? '/casa/dettagli' : daFare.href;
    return (
      <section aria-labelledby="da-fare" className="flex flex-col gap-1.5">
        <h2 id="da-fare" className="font-serif text-lg font-semibold">
          Da fare
        </h2>
        <Link href={href} className={`${CARD} flex min-h-12 items-center justify-between gap-3 text-[15px]`}>
          <span>{daFare.testo}</span>
          <ChevronRight size={18} aria-hidden="true" className="shrink-0 text-brand-dark" />
        </Link>
        {piuTardi}
      </section>
    );
  }

  const daMettere = voci.filter((v) => v.stato === 'da_mettere' && !fatte.includes(v.item.id));
  return (
    <section aria-labelledby="da-fare" className="flex flex-col gap-1.5">
      <h2 id="da-fare" className="font-serif text-lg font-semibold">
        Da fare
      </h2>
      <div className={`${CARD} flex flex-col gap-3`}>
        <p className="text-[15px]">{daFare.testo}</p>
        <ul className="flex flex-col">
          {daFare.voci.map((v) => (
            <li key={v.nome} className="flex justify-between gap-3 border-t border-rule py-2 text-[15px]">
              <span>{v.nome}</span>
              <span className="num">{formatEuro(v.importo)} al mese</span>
            </li>
          ))}
        </ul>
        {errore ? (
          <p role="alert" className="text-sm text-danger">
            {errore}
          </p>
        ) : null}
        <button
          type="button"
          disabled={inCorso}
          onClick={() => metti(daMettere)}
          className="min-h-12 rounded-[var(--radius-md)] bg-brand px-4 text-base font-semibold text-brand-foreground disabled:opacity-50"
        >
          Fatto
        </button>
      </div>
    </section>
  );
}
