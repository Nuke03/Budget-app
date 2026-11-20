'use client';

import { useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { sposta } from '@/lib/data/spostamenti';
import { oggiRomaISO } from '@/lib/calculations/casa/oggi';
import { FoglioInferiore } from '../FoglioInferiore';
import { SceltePill } from '../casa/SceltePill';
import { CLASSE_CAMPO, CLASSE_PRIMARIO } from '../casa/CampiMovimento';
import type { Account } from '@/lib/types';

export const ERRORE_SPOSTA = 'Non sono riuscito a spostarli. Riprova tra poco.';

const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

// "Sposta tra i tuoi conti": i soldi restano tuoi, cambiano solo conto. Un invio alla volta.
export function SpostaFoglio({
  conti,
  iniziale,
  onFatto,
  onClose,
}: {
  conti: Account[];
  iniziale?: { daAccountId?: string; aAccountId?: string; importo?: number };
  onFatto: () => void;
  onClose: () => void;
}) {
  const personali = conti.filter((c) => !c.archiviato);
  const [oggi] = useState(() => oggiRomaISO());
  const [da, setDa] = useState<string | null>(iniziale?.daAccountId ?? null);
  const [aScelto, setAScelto] = useState<string | null>(iniziale?.aAccountId ?? null);
  const [importo, setImporto] = useState(iniziale?.importo ? String(iniziale.importo).replace('.', ',') : '');
  const [data, setData] = useState(oggi);
  const [inCorso, setInCorso] = useState(false);
  const [errore, setErrore] = useState(false);
  // Blocca il doppio tocco prima ancora che React ridisegni il pulsante.
  const occupato = useRef(false);

  const opzioniA = personali.filter((c) => c.id !== da);
  // Con un solo conto possibile, "A" si sceglie da sola.
  const a = aScelto && opzioniA.some((c) => c.id === aScelto) ? aScelto : opzioniA.length === 1 ? opzioniA[0].id : null;

  const valore = Number(importo.trim().replace(',', '.'));
  const importoValido = importo.trim() !== '' && Number.isFinite(valore) && valore > 0 && valore < 1e9;
  const dataValida = DATA_ISO.test(data) && data <= oggi;
  const pronto = !!da && !!a && importoValido && dataValida;

  async function invia() {
    if (!pronto || occupato.current) return;
    occupato.current = true;
    setInCorso(true);
    setErrore(false);
    try {
      await sposta(createClient(), { daAccountId: da!, aAccountId: a!, importo: valore, data });
    } catch {
      setErrore(true);
      occupato.current = false;
      setInCorso(false);
      return;
    }
    occupato.current = false;
    setInCorso(false);
    onFatto();
  }

  const opzioni = (elenco: Account[]) => elenco.map((c) => ({ chiave: c.id, etichetta: c.nome }));

  return (
    <FoglioInferiore titolo="Sposta tra i tuoi conti" onClose={() => !inCorso && onClose()}>
      <div className="flex flex-col gap-4 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <p className="text-[15px] text-ink-2">Sono sempre soldi tuoi: cambiano solo conto.</p>
        <SceltePill legenda="Da" opzioni={opzioni(personali)} valore={da} onChange={setDa} />
        <SceltePill legenda="A" opzioni={opzioni(opzioniA)} valore={a} onChange={setAScelto} />
        <label className="flex flex-col gap-1.5 text-[13px] text-ink-2">
          Importo
          <input
            inputMode="decimal"
            placeholder="0"
            value={importo}
            onChange={(e) => setImporto(e.target.value)}
            className="num min-h-16 rounded-[var(--radius-md)] border border-rule bg-surface px-3 py-2 font-serif text-[40px] font-bold leading-none text-foreground outline-none focus-visible:border-brand"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-[13px] text-ink-2">
          Data
          <input type="date" value={data} max={oggi} onChange={(e) => setData(e.target.value)} className={CLASSE_CAMPO} />
        </label>
        {!dataValida && data ? <p className="text-[13px] text-ink-2">La data non può essere futura.</p> : null}
        {errore ? (
          <p role="alert" className="text-[15px] font-medium text-danger">
            {ERRORE_SPOSTA}
          </p>
        ) : null}
        <button type="button" onClick={() => void invia()} disabled={!pronto || inCorso} className={CLASSE_PRIMARIO}>
          Sposta
        </button>
      </div>
    </FoglioInferiore>
  );
}
