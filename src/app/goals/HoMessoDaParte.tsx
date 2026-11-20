'use client';

import { useState } from 'react';

const fieldClass =
  'min-h-12 rounded-[var(--radius-md)] border border-rule bg-page px-3 text-[15px] text-foreground focus-visible:border-brand';

// "Ho messo da parte": un tocco per confermare che i soldi della quota del mese sono davvero spostati.
// Importo e data sono già scritti (la quota e oggi) e si possono cambiare; la data non può essere nel futuro.
// La scrittura la fa chi usa il componente: se non riesce, la conferma resta aperta con una frase.
export function HoMessoDaParte({
  quota,
  oggi,
  onConferma,
}: {
  quota: number;
  // 'yyyy-MM-dd'
  oggi: string;
  onConferma: (importo: number, data: string) => Promise<void>;
}) {
  const [aperto, setAperto] = useState(false);
  const [importo, setImporto] = useState('');
  const [data, setData] = useState(oggi);
  const [inCorso, setInCorso] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  const valore = Number(importo);
  const importoOk = importo.trim() !== '' && Number.isFinite(valore) && valore > 0 && valore < 1e9;
  const dataOk = /^\d{4}-\d{2}-\d{2}$/.test(data) && data <= oggi;
  const valido = importoOk && dataOk;

  function apri() {
    setImporto(String(Math.round(quota * 100) / 100));
    setData(oggi);
    setErrore(null);
    setAperto(true);
  }

  async function conferma() {
    if (!valido || inCorso) return;
    setInCorso(true);
    setErrore(null);
    try {
      await onConferma(Math.round(valore * 100) / 100, data);
      setAperto(false);
    } catch {
      setErrore('Non sono riuscito a segnarlo. Riprova tra poco.');
    } finally {
      setInCorso(false);
    }
  }

  if (!aperto) {
    return (
      <button
        type="button"
        onClick={apri}
        className="mt-2 min-h-11 w-full rounded-[var(--radius-md)] bg-brand-tint px-3 py-2 text-[15px] font-semibold text-brand-dark"
      >
        Ho messo da parte
      </button>
    );
  }

  return (
    <div className="mt-2 flex flex-col gap-2.5 rounded-[var(--radius-sm)] bg-surface-muted p-3">
      <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink-2">
        Importo
        <input
          aria-label="Importo"
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          value={importo}
          onChange={(e) => setImporto(e.target.value)}
          className={fieldClass}
        />
      </label>
      <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink-2">
        Data
        <input
          aria-label="Data"
          type="date"
          max={oggi}
          value={data}
          onChange={(e) => setData(e.target.value)}
          className={fieldClass}
        />
      </label>
      {errore ? (
        <p role="alert" className="text-[13px] text-danger">
          {errore}
        </p>
      ) : null}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={conferma}
          disabled={!valido || inCorso}
          className="min-h-11 flex-1 rounded-[var(--radius-md)] bg-brand px-3 py-2 text-[15px] font-semibold text-brand-foreground disabled:opacity-40"
        >
          Conferma
        </button>
        <button
          type="button"
          onClick={() => setAperto(false)}
          className="min-h-11 rounded-[var(--radius-md)] bg-brand-tint px-4 py-2 text-[15px] font-semibold text-foreground"
        >
          Annulla
        </button>
      </div>
    </div>
  );
}
