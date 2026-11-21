'use client';

import { useState } from 'react';
import { FoglioInferiore } from '../FoglioInferiore';
import { Campo, CLASSE_CAMPO, CLASSE_LINK, CLASSE_NEUTRO, CLASSE_PRIMARIO } from '../casa/CampiMovimento';
import { formatEuro, giornoEMeseScadenza } from '@/lib/format';
import type { Account } from '@/lib/types';
import { PercheScadenza } from './PerchePiva';

// Nelle frasi gli importi tondi si scrivono senza decimali: "600 €".
export const euroInFrase = (n: number): string => formatEuro(n).replace(',00', '');

// Da quale conto personale si sposta la quota: quello dell'incasso; senza conto (contanti),
// il primo conto che conta nel disponibile. null: non c'è un conto da cui spostare.
export function contoDaCuiSpostare(accountId: string | null, conti: Account[], contoTasseId: string): string | null {
  if (accountId && accountId !== contoTasseId && conti.some((c) => c.id === accountId)) return accountId;
  return conti.find((c) => c.contaInDisponibile && c.id !== contoTasseId)?.id ?? null;
}

// A ogni incasso del lavoro: quanto mettere da parte, con un tocco per dirlo fatto.
// Con inPiu la proposta include anche il pezzo per una scadenza vicina.
export function PromptQuota({
  importo,
  quota,
  contoTasse,
  inPiu,
  onFatto,
  onPiuTardi,
}: {
  importo: number;
  quota: number;
  contoTasse: string;
  inPiu?: { importo: number; data: string } | null;
  onFatto: (importoSpostato: number) => Promise<void>;
  onPiuTardi: () => void;
}) {
  const totale = inPiu ? Math.round(quota + inPiu.importo) : quota;
  const [spostato, setSpostato] = useState(String(totale));
  const [inCorso, setInCorso] = useState(false);
  const [errore, setErrore] = useState(false);
  const [diversa, setDiversa] = useState(false);

  const valore = Number(spostato);
  const valido = spostato.trim() !== '' && Number.isFinite(valore) && valore > 0;

  async function fatto() {
    if (!valido || inCorso) return;
    setInCorso(true);
    setErrore(false);
    try {
      await onFatto(valore);
    } catch {
      setErrore(true);
      setInCorso(false);
    }
  }

  return (
    <FoglioInferiore titolo="Metti da parte le tasse" onClose={onPiuTardi}>
      <div className="flex flex-col gap-4 px-5 pb-5">
        <div>
          <p className="num font-serif text-[40px] font-bold leading-none">{euroInFrase(totale)}</p>
          <p className="mt-1 text-[15px]">
            da mettere da parte sul conto tasse (su {euroInFrase(importo)} incassati)
          </p>
          {inPiu ? (
            <>
              <p className="mt-1 text-[15px] text-ink-2">
                {euroInFrase(quota)} di quota e {euroInFrase(inPiu.importo)} per la scadenza del{' '}
                {giornoEMeseScadenza(inPiu.data, Number(inPiu.data.slice(8, 10)))} {inPiu.data.slice(0, 4)}.
              </p>
              <div className="mt-1">
                <PercheScadenza />
              </div>
            </>
          ) : null}
        </div>
        <p className="text-[15px] text-ink-2">Il conto è «{contoTasse}». Sposta i soldi con la tua banca, poi tocca il pulsante.</p>
        {diversa ? (
          <Campo etichetta="Importo spostato (€)">
            <input
              type="number"
              inputMode="decimal"
              step="any"
              value={spostato}
              onChange={(e) => setSpostato(e.target.value)}
              className={CLASSE_CAMPO}
            />
          </Campo>
        ) : (
          <button type="button" onClick={() => setDiversa(true)} className={`${CLASSE_LINK} self-start`}>
            Ho spostato una cifra diversa
          </button>
        )}
        {errore ? (
          <p role="alert" className="text-[15px] text-danger">
            Non è riuscito. Riprova.
          </p>
        ) : null}
        <button type="button" onClick={fatto} disabled={!valido || inCorso} className={CLASSE_PRIMARIO}>
          Fatto, li ho spostati
        </button>
        <button type="button" onClick={onPiuTardi} disabled={inCorso} className={CLASSE_NEUTRO}>
          Più tardi
        </button>
      </div>
    </FoglioInferiore>
  );
}
