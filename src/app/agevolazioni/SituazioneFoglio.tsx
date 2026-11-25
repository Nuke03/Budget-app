'use client';

import { useState } from 'react';
import { SceltePill } from '../casa/SceltePill';
import { Campo, CLASSE_CAMPO, CLASSE_PRIMARIO } from '../casa/CampiMovimento';
import { salvaSituazione } from './actions';
import type { Situazione } from '@/lib/agevolazioni/tipi';

type Dati = Omit<Situazione, 'piva'>;

const OPZIONI = [
  { chiave: 'si', etichetta: 'Sì' },
  { chiave: 'no', etichetta: 'No' },
  { chiave: 'boh', etichetta: 'Non so' },
];

const aChiave = (v: boolean | null): string => (v === true ? 'si' : v === false ? 'no' : 'boh');
const daChiave = (k: string): boolean | null => (k === 'si' ? true : k === 'no' ? false : null);

// Il foglio con le quattro domande. Tutto facoltativo: "Non so" e i campi vuoti restano senza risposta.
export function SituazioneFoglio({
  iniziale,
  oggi,
  onSalvato,
}: {
  iniziale: Dati;
  oggi: string;
  onSalvato: () => void;
}) {
  const [isee, setIsee] = useState(iniziale.isee === null ? '' : String(iniziale.isee).replace('.', ','));
  const [dsuData, setDsuData] = useState(iniziale.dsuData ?? '');
  const [comune, setComune] = useState(iniziale.comune ?? '');
  const [inAffitto, setInAffitto] = useState<boolean | null>(iniziale.inAffitto);
  const [studente, setStudente] = useState<boolean | null>(iniziale.studente);
  const [errore, setErrore] = useState<string | null>(null);
  const [inCorso, setInCorso] = useState(false);

  async function salva() {
    if (inCorso) return;
    let valoreIsee: number | null = null;
    const testo = isee.trim().replace(/\s/g, '').replace(',', '.');
    if (testo !== '') {
      valoreIsee = Number(testo);
      if (!Number.isFinite(valoreIsee) || valoreIsee < 0) {
        setErrore("L'ISEE va scritto come un numero, per esempio 8500.");
        return;
      }
    }
    setErrore(null);
    setInCorso(true);
    try {
      await salvaSituazione({
        isee: valoreIsee,
        dsuData: dsuData === '' ? null : dsuData,
        comune: comune.trim() === '' ? null : comune.trim(),
        inAffitto,
        studente,
      });
      onSalvato();
    } catch {
      setErrore('Non sono riuscito a salvare. Riprova fra poco.');
    } finally {
      setInCorso(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Campo etichetta="ISEE (facoltativo)">
        <input
          inputMode="decimal"
          placeholder="Per esempio 8500"
          value={isee}
          onChange={(e) => setIsee(e.target.value)}
          className={CLASSE_CAMPO}
        />
      </Campo>
      <Campo etichetta="Data della DSU">
        <input type="date" max={oggi} value={dsuData} onChange={(e) => setDsuData(e.target.value)} className={CLASSE_CAMPO} />
      </Campo>
      <Campo etichetta="Comune">
        <input value={comune} onChange={(e) => setComune(e.target.value)} maxLength={80} className={CLASSE_CAMPO} />
      </Campo>
      <div className="flex flex-col gap-1.5">
        <p className="text-[13px] text-ink-2">Sei in affitto?</p>
        <SceltePill legenda="Sei in affitto?" opzioni={OPZIONI} valore={aChiave(inAffitto)} onChange={(k) => setInAffitto(daChiave(k))} />
      </div>
      <div className="flex flex-col gap-1.5">
        <p className="text-[13px] text-ink-2">Studi?</p>
        <SceltePill legenda="Studi?" opzioni={OPZIONI} valore={aChiave(studente)} onChange={(k) => setStudente(daChiave(k))} />
      </div>
      {errore ? (
        <p role="alert" className="text-[15px] text-foreground">
          {errore}
        </p>
      ) : null}
      <button type="button" onClick={salva} disabled={inCorso} className={CLASSE_PRIMARIO}>
        Salva
      </button>
    </div>
  );
}
