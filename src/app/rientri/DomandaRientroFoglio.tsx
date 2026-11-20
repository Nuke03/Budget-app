'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { creaRientro } from '@/lib/data/rientri';
import { MESI_RIENTRO, type MesiRientro } from '@/lib/calculations/rientri';
import { fraseRata } from '@/lib/calculations/rientriTesti';
import { FoglioInferiore } from '../FoglioInferiore';
import { SceltePill } from '../casa/SceltePill';
import { CLASSE_NEUTRO, CLASSE_PRIMARIO } from '../casa/CampiMovimento';
import { euroInFrase } from '../piva/PromptQuota';

const ERRORE = 'Non sono riuscito a salvarlo. Riprova tra poco.';

// Dopo una spesa dal conto risparmio: una domanda sola, due tocchi per rispondere.
export function DomandaRientroFoglio({
  importo,
  conto,
  oggi,
  onChiudi,
}: {
  importo: number;
  conto: { id: string; nome: string };
  oggi: string;
  onChiudi: () => void;
}) {
  const router = useRouter();
  const [mesi, setMesi] = useState<MesiRientro>(3);
  const [inCorso, setInCorso] = useState(false);
  const [errore, setErrore] = useState(false);
  // Blocca il doppio tocco prima che React ridisegni il pulsante.
  const occupato = useRef(false);

  async function si() {
    if (occupato.current) return;
    occupato.current = true;
    setInCorso(true);
    setErrore(false);
    try {
      await creaRientro(createClient(), { goalId: null, accountId: conto.id, importo, mesi, creatoIl: oggi });
    } catch {
      setErrore(true);
      occupato.current = false;
      setInCorso(false);
      return;
    }
    router.refresh();
    onChiudi();
  }

  return (
    <FoglioInferiore titolo="Vuoi rimetterli un po' al mese?" onClose={() => !inCorso && onChiudi()}>
      <div className="flex flex-col gap-4 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <p className="text-[15px]">
          {`Hai preso ${euroInFrase(importo)} dal ${conto.nome}. Puoi riportarli lì un po' alla volta.`}
        </p>
        <SceltePill
          legenda="In quanti mesi?"
          opzioni={MESI_RIENTRO.map((m) => ({ chiave: String(m), etichetta: `${m} mesi` }))}
          valore={String(mesi)}
          onChange={(k) => setMesi(Number(k) as MesiRientro)}
        />
        <p className="num text-[15px] text-foreground">{fraseRata(importo, mesi, oggi)}</p>
        {errore ? (
          <p role="alert" className="text-[15px] font-medium text-danger">
            {ERRORE}
          </p>
        ) : null}
        <button type="button" onClick={() => void si()} disabled={inCorso} className={CLASSE_PRIMARIO}>
          Sì, rimettili
        </button>
        <button type="button" onClick={onChiudi} disabled={inCorso} className={CLASSE_NEUTRO}>
          No, va bene così
        </button>
      </div>
    </FoglioInferiore>
  );
}
