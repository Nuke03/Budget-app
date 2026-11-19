'use client';

import { useState } from 'react';
import { FoglioInferiore } from '../FoglioInferiore';
import { CLASSE_LINK, CLASSE_NEUTRO, CLASSE_PRIMARIO } from '../casa/CampiMovimento';
import { LezioneFoglio } from './LezioneFoglio';
import { euroInFrase } from '../piva/PromptQuota';
import { rispondiAvviso } from '../impara/dopoSalvataggio';
import { lezione } from '@/lib/percorso/lezioni';
import type { AvvisoFondi, SoldiToccati } from '@/lib/calculations/percorso/avviso';
import type { ArgomentoId } from '@/lib/percorso/tipi';

const PER_COSA: Record<Exclude<SoldiToccati, 'obiettivi'>, string> = {
  casa: 'la quota della casa',
  debiti: 'restituire quello che devi in casa',
  tasse: 'le tasse',
};

function titolo(avviso: AvvisoFondi): string {
  const cifra = euroInFrase(avviso.buco);
  const primo = avviso.toccati[0];
  if (!primo || primo === 'obiettivi') return `Questa spesa usa ${cifra} che avevi messo da parte.`;
  return `Questa spesa usa ${cifra} che servono per ${PER_COSA[primo]}.`;
}

type Fase = 'domanda' | 'fondo' | 'normale';

// Dopo una spesa che ha usato soldi già messi da parte: lo dice, senza giudicare. Con il fondo imprevisti
// chiede se è un imprevisto vero; negli altri casi informa soltanto.
export function AvvisoFondiFoglio({
  avviso,
  transactionId,
  lezione: lezioneId,
  onChiudi,
}: {
  avviso: AvvisoFondi;
  transactionId: string;
  lezione: ArgomentoId;
  onChiudi: () => void;
}) {
  const [fase, setFase] = useState<Fase>('domanda');
  const [inCorso, setInCorso] = useState(false);
  const [errore, setErrore] = useState(false);
  const [vediLezione, setVediLezione] = useState(false);

  if (vediLezione) return <LezioneFoglio lezioneId={lezioneId} onChiudi={onChiudi} />;

  const fondo = avviso.fondoImprevisti;
  const prossima = `La prossima entrata copre prima questi ${euroInFrase(avviso.buco)}.`;

  async function rispondi(risposta: 'imprevisto' | 'normale') {
    if (inCorso) return;
    setInCorso(true);
    setErrore(false);
    try {
      await rispondiAvviso(transactionId, risposta, risposta === 'imprevisto' ? fondo?.goalId : undefined);
      setFase(risposta === 'imprevisto' ? 'fondo' : 'normale');
    } catch {
      setErrore(true);
    } finally {
      setInCorso(false);
    }
  }

  const linkLezione = (
    <button type="button" onClick={() => setVediLezione(true)} className={`${CLASSE_LINK} self-start`}>
      {lezione(lezioneId).titolo}
    </button>
  );

  return (
    <FoglioInferiore titolo={titolo(avviso)} onClose={onChiudi}>
      <div className="flex flex-col gap-4 px-5 pb-5">
        {fase === 'fondo' ? (
          <p className="text-[15px]">Il fondo ha fatto il suo lavoro.</p>
        ) : fase === 'normale' ? (
          <>
            <p className="text-[15px]">{`Va bene. ${prossima}`}</p>
            {linkLezione}
          </>
        ) : fondo ? (
          <>
            <p className="text-[15px] text-ink-2">È un imprevisto vero?</p>
            {errore ? (
              <p role="alert" className="text-[15px] text-danger">
                Non sono riuscito a salvare. Riprova.
              </p>
            ) : null}
            <button type="button" disabled={inCorso} onClick={() => rispondi('imprevisto')} className={CLASSE_PRIMARIO}>
              Sì, prendili dal fondo imprevisti
            </button>
            <button type="button" disabled={inCorso} onClick={() => rispondi('normale')} className={CLASSE_NEUTRO}>
              No, è una spesa normale
            </button>
          </>
        ) : (
          <>
            <p className="text-[15px]">{prossima}</p>
            {linkLezione}
          </>
        )}
        {fase !== 'domanda' || !fondo ? (
          <button type="button" onClick={onChiudi} className={CLASSE_NEUTRO}>
            Chiudi
          </button>
        ) : null}
      </div>
    </FoglioInferiore>
  );
}
