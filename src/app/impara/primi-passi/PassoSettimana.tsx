'use client';

import { useState, useTransition } from 'react';
import { euroInFrase } from '@/lib/format';
import { piuGiorni } from '@/lib/data/percorso';
import { GIORNI_SETTIMANA, PICCOLA_SPESA } from '@/lib/calculations/percorso/soglie';
import type { FaseSettimana, RiepilogoSettimana } from '@/lib/calculations/percorso/primiPassiFondi';
import { avviaSettimana, chiudiSettimana, ripartiSettimana } from './actions';
import { ERRORE_TESTO, PRIMARIO } from './stili';
import { Salvato, useSalvato } from './Salvato';

const giornoEMese = (iso: string): string =>
  new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(
    new Date(`${iso}T12:00:00Z`)
  );

export function PassoSettimana({
  fase,
  dal,
  riepilogo,
}: {
  fase: FaseSettimana;
  dal: string | null;
  riepilogo: RiepilogoSettimana | null;
}) {
  const { salvato, mostra } = useSalvato();
  const [inCorso, avvia] = useTransition();
  const [errore, setErrore] = useState(false);

  function esegui(azione: () => Promise<void>) {
    setErrore(false);
    avvia(async () => {
      try {
        await azione();
        mostra();
      } catch {
        setErrore(true);
      }
    });
  }

  let corpo;
  if (fase === 'da-avviare' || !dal) {
    corpo = (
      <>
        <p className="text-[15px]">Per sette giorni segna le spese man mano che arrivano. Poi le guardiamo insieme.</p>
        <button type="button" disabled={inCorso} onClick={() => esegui(avviaSettimana)} className={PRIMARIO}>
          Parto oggi
        </button>
      </>
    );
  } else if (fase === 'in-corso') {
    corpo = (
      <p className="text-[15px]">
        {`Segna le spese, il resto lo guardiamo il ${giornoEMese(piuGiorni(dal, GIORNI_SETTIMANA))}.`}
      </p>
    );
  } else if (!riepilogo || riepilogo.numeroSpese === 0) {
    corpo = (
      <>
        <p className="text-[15px]">
          In questi giorni non c’è niente di segnato. Ripartiamo da oggi: per altri sette giorni segna le spese e poi le guardiamo.
        </p>
        <button type="button" disabled={inCorso} onClick={() => esegui(ripartiSettimana)} className={PRIMARIO}>
          Ripartiamo da oggi
        </button>
      </>
    );
  } else {
    corpo = (
      <>
        <section className="rounded-[var(--radius-md)] border border-rule bg-surface p-4">
          <h3 className="text-sm font-semibold text-ink-2">La tua settimana</h3>
          <p className="mt-1 text-[15px]">{`In sette giorni hai speso ${euroInFrase(riepilogo.totale)}.`}</p>
          <ul className="mt-2 text-[15px]">
            {riepilogo.grandi.map((g) => (
              <li key={g.nome}>{`${g.nome}: ${euroInFrase(g.totale)}`}</li>
            ))}
          </ul>
          {riepilogo.piccole.numero > 0 ? (
            <p className="mt-2 text-[15px] text-ink-2">
              {`Le spese sotto i ${PICCOLA_SPESA} € sono ${riepilogo.piccole.numero}, in tutto ${euroInFrase(riepilogo.piccole.totale)}.`}
            </p>
          ) : null}
        </section>
        <button type="button" disabled={inCorso} onClick={() => esegui(chiudiSettimana)} className={PRIMARIO}>
          Ho visto, avanti
        </button>
      </>
    );
  }

  return (
    <div className="mt-5 flex flex-col gap-3">
      {corpo}
      {errore ? <p role="alert" className="text-sm text-ink-2">{ERRORE_TESTO}</p> : null}
      <Salvato visibile={salvato} />
    </div>
  );
}
