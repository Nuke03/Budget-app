'use client';

import Link from 'next/link';
import { FoglioInferiore } from '../FoglioInferiore';
import { CLASSE_NEUTRO, CLASSE_PRIMARIO } from '../casa/CampiMovimento';
import { lezione } from '@/lib/percorso/lezioni';
import type { ArgomentoId } from '@/lib/percorso/tipi';

// Una lezione proposta dopo un salvataggio: il riassunto, e la strada per aprirla o rimandarla.
export function LezioneFoglio({ lezioneId, onChiudi }: { lezioneId: ArgomentoId; onChiudi: () => void }) {
  const l = lezione(lezioneId);
  return (
    <FoglioInferiore titolo={l.titolo} onClose={onChiudi}>
      <div className="flex flex-col gap-4 px-5 pb-5">
        <section>
          <h3 className="text-sm font-semibold text-ink-2">In breve</h3>
          <p className="mt-1 text-[15px]">{l.inBreve}</p>
        </section>
        <Link href={`/impara/${l.id}`} onClick={onChiudi} className={CLASSE_PRIMARIO}>
          Apri la lezione
        </Link>
        <button type="button" onClick={onChiudi} className={CLASSE_NEUTRO}>
          Più tardi
        </button>
      </div>
    </FoglioInferiore>
  );
}
