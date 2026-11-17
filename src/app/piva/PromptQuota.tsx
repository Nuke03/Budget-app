'use client';

import { useState } from 'react';
import { FoglioInferiore } from '../FoglioInferiore';
import { Campo, CLASSE_CAMPO, CLASSE_NEUTRO, CLASSE_PRIMARIO } from '../casa/CampiMovimento';
import { formatEuro } from '@/lib/format';
import type { Account } from '@/lib/types';

// Nelle frasi gli importi tondi si scrivono senza decimali: "600 €".
export const euroInFrase = (n: number): string => formatEuro(n).replace(',00', '');

// Da quale conto personale si sposta la quota: quello dell'incasso; senza conto (contanti),
// il primo conto che conta nel disponibile. null: non c'è un conto da cui spostare.
export function contoDaCuiSpostare(accountId: string | null, conti: Account[], contoTasseId: string): string | null {
  if (accountId && accountId !== contoTasseId && conti.some((c) => c.id === accountId)) return accountId;
  return conti.find((c) => c.contaInDisponibile && c.id !== contoTasseId)?.id ?? null;
}

// A ogni incasso del lavoro: quanto mettere da parte, con un tocco per dirlo fatto.
export function PromptQuota({
  importo,
  quota,
  contoTasse,
  onFatto,
  onPiuTardi,
}: {
  importo: number;
  quota: number;
  contoTasse: string;
  onFatto: (importoSpostato: number) => Promise<void>;
  onPiuTardi: () => void;
}) {
  const [spostato, setSpostato] = useState(String(quota));
  const [inCorso, setInCorso] = useState(false);
  const [errore, setErrore] = useState(false);

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
        <p className="font-serif text-[20px] font-semibold">
          Di {euroInFrase(importo)} metti da parte {euroInFrase(quota)} sul conto tasse
        </p>
        <p className="text-[15px] text-ink-2">Il conto è «{contoTasse}». Sposta i soldi con la tua banca, poi tocca il pulsante.</p>
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
