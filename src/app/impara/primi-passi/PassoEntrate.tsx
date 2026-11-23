'use client';

import { useState, useTransition } from 'react';
import type { PercorsoUtente } from '@/lib/percorso/tipi';
import { salvaEntrate } from './actions';
import { CAMPO, ERRORE_TESTO, ETICHETTA, PRIMARIO } from './stili';
import { Salvato, useSalvato } from './Salvato';

type Tipo = 'fisse' | 'irregolari' | 'piva';
const SCELTE: { id: Tipo; testo: string }[] = [
  { id: 'fisse', testo: 'Fisse: lo stipendio arriva ogni mese' },
  { id: 'irregolari', testo: 'Irregolari: cambiano da un mese all’altro' },
  { id: 'piva', testo: 'Con partita IVA' },
];

const comeNumero = (s: string): number | null => {
  const n = Number(s.replace(',', '.'));
  return s.trim() !== '' && Number.isFinite(n) && n > 0 ? n : null;
};

export function PassoEntrate({ iniziale }: { iniziale: PercorsoUtente | null }) {
  const { salvato, mostra } = useSalvato();
  const [inCorso, avvia] = useTransition();
  const [errore, setErrore] = useState(false);
  const [tipo, setTipo] = useState<Tipo | null>(iniziale?.entrateTipo ?? null);
  const [importo, setImporto] = useState(iniziale?.entrataAttesa ? String(iniziale.entrataAttesa) : '');
  const [data, setData] = useState(iniziale?.entrataAttesaIl ?? '');
  const [nonSo, setNonSo] = useState(false);
  const [base, setBase] = useState(iniziale?.redditoBase ? String(iniziale.redditoBase) : '');

  function salva() {
    if (!tipo) return;
    setErrore(false);
    avvia(async () => {
      try {
        await salvaEntrate({
          entrateTipo: tipo,
          entrataAttesa: comeNumero(importo),
          entrataAttesaIl: nonSo || !data ? null : data,
          redditoBase: tipo === 'fisse' ? null : comeNumero(base),
        });
        mostra();
      } catch {
        setErrore(true);
      }
    });
  }

  return (
    <div className="mt-5 flex flex-col gap-4">
      <fieldset className="flex flex-col gap-1">
        <legend className={ETICHETTA}>Le tue entrate sono</legend>
        {SCELTE.map((s) => (
          <label key={s.id} className="flex min-h-11 items-center gap-3 text-[15px]">
            <input type="radio" name="entrate" checked={tipo === s.id} onChange={() => setTipo(s.id)} className="size-5" />
            {s.testo}
          </label>
        ))}
      </fieldset>

      <label className="flex flex-col gap-1">
        <span className={ETICHETTA}>Quanto aspetti, più o meno (facoltativo)</span>
        <input inputMode="decimal" value={importo} onChange={(e) => setImporto(e.target.value)} className={CAMPO} />
      </label>

      <div className="flex flex-col gap-1">
        <label htmlFor="quando-arriva" className={ETICHETTA}>Quando arriva (facoltativo)</label>
        <input
          id="quando-arriva"
          type="date"
          value={nonSo ? '' : data}
          disabled={nonSo}
          onChange={(e) => setData(e.target.value)}
          className={CAMPO}
        />
        <label className="flex min-h-11 items-center gap-3 text-[15px]">
          <input type="checkbox" checked={nonSo} onChange={(e) => setNonSo(e.target.checked)} className="size-5" />
          Non so ancora la data
        </label>
      </div>

      {tipo === 'irregolari' || tipo === 'piva' ? (
        <label className="flex flex-col gap-1">
          <span className={ETICHETTA}>Reddito base: quanto entra nei mesi magri (facoltativo)</span>
          <input inputMode="decimal" value={base} onChange={(e) => setBase(e.target.value)} className={CAMPO} />
        </label>
      ) : null}

      <button type="button" disabled={!tipo || inCorso} onClick={salva} className={PRIMARIO}>
        Salva
      </button>
      {errore ? <p role="alert" className="text-sm text-ink-2">{ERRORE_TESTO}</p> : null}
      <Salvato visibile={salvato} />
    </div>
  );
}
