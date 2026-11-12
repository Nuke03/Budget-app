'use client';

import Link from 'next/link';
import type { StatoVoceDaParte } from '@/lib/calculations/casa/fondi';
import type { DaFareCasa } from '@/lib/calculations/supporto/casaHome';
import { formatEuro } from '@/lib/format';
import { useMettiDaParte } from './useMettiDaParte';

const CARD = 'rounded-[var(--radius-md)] border border-rule bg-surface-muted p-4';

// "Da fare": una sola cosa alla volta. L'accantonamento si fa qui; il resto apre la sua pagina.
export function DaFareCard({
  daFare,
  householdId,
  oggi,
  voci,
}: {
  daFare: DaFareCasa;
  householdId: string;
  oggi: string;
  voci: StatoVoceDaParte[];
}) {
  const { metti, inCorso, errore, fatte } = useMettiDaParte({ householdId, oggi });

  if (daFare.tipo !== 'da_parte') {
    // Il promemoria di un versamento non ha una pagina sua: si registra dai Dettagli.
    const href = daFare.href === '/casa' ? '/casa/dettagli' : daFare.href;
    return (
      <section aria-labelledby="da-fare" className="flex flex-col gap-1.5">
        <h2 id="da-fare" className="font-serif text-lg font-semibold">
          Da fare
        </h2>
        <Link href={href} className={`${CARD} flex min-h-12 items-center justify-between gap-3 text-[15px]`}>
          <span>{daFare.testo}</span>
          <span aria-hidden="true" className="text-brand-dark">
            ›
          </span>
        </Link>
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
