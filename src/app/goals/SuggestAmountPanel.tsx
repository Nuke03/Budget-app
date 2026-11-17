'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getRecentTransactionAmounts } from '@/lib/data/transactions';
import { suggestImportoFromHistory } from '@/lib/calculations/suggestImportoFromHistory';
import { formatEuro } from '@/lib/format';
import { FieldHint } from '@/app/FieldHint';

export function SuggestAmountPanel({
  categoriaId,
  onUseAmount,
}: {
  categoriaId: string;
  onUseAmount: (importo: number) => void;
}) {
  const [limite, setLimite] = useState('3');
  const [margine, setMargine] = useState('10');
  const [nomeTassa, setNomeTassa] = useState('');
  const [importi, setImporti] = useState<number[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const limiteNumerico = Math.floor(Number(limite));
    if (!limiteNumerico || limiteNumerico <= 0) return;

    let cancelled = false;
    setLoading(true);
    setError(null);
    const supabase = createClient();
    getRecentTransactionAmounts(supabase, categoriaId, limiteNumerico, nomeTassa.trim() || null)
      .then((result) => {
        if (!cancelled) {
          setImporti(result);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError('Errore nel recupero delle spese passate. Riprova.');
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [categoriaId, limite, nomeTassa]);

  const margineNumerico = Number(margine);
  const suggerito =
    importi && importi.length > 0 && !Number.isNaN(margineNumerico)
      ? suggestImportoFromHistory(importi, margineNumerico)
      : null;

  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-rule bg-brand-tint p-4 text-[15px]">
      <div className="flex flex-col gap-1 text-[13px] font-medium text-ink-2">
        <span className="flex items-center gap-1">
          <label htmlFor="suggest-nome-tassa">Nome tassa</label>
          <FieldHint testo="Scrivi il nome che usi di solito per questa spesa (es. ENEL, Telepass): la media verrà calcolata solo sulle spese passate di questa categoria la cui descrizione contiene questa parola. Lascia vuoto per usare tutte le spese della categoria." />
        </span>
        <input
          id="suggest-nome-tassa"
          type="text"
          placeholder="Es. ENEL, Telepass..."
          value={nomeTassa}
          onChange={(e) => setNomeTassa(e.target.value)}
          className="min-h-11 rounded-[var(--radius-sm)] border border-rule bg-page px-3 text-[15px] text-foreground focus-visible:border-brand"
        />
      </div>

      <div className="flex gap-3">
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-[13px] font-medium text-ink-2">
          Quante spese passate
          <input
            aria-label="Quante spese passate"
            type="number"
            value={limite}
            onChange={(e) => setLimite(e.target.value)}
            className="min-h-11 rounded-[var(--radius-sm)] border border-rule bg-page px-3 text-[15px] text-foreground focus-visible:border-brand"
          />
        </label>
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-[13px] font-medium text-ink-2">
          Margine %
          <input
            aria-label="Margine %"
            type="number"
            value={margine}
            onChange={(e) => setMargine(e.target.value)}
            className="min-h-11 rounded-[var(--radius-sm)] border border-rule bg-page px-3 text-[15px] text-foreground focus-visible:border-brand"
          />
        </label>
      </div>

      {loading && <p className="text-ink-2">Ricerca spese passate...</p>}

      {error && <p className="text-danger">{error}</p>}

      {!loading && importi && importi.length === 0 && (
        <p className="text-ink-2">
          Non ci sono ancora abbastanza spese in questa categoria per calcolare una media.
        </p>
      )}

      {!loading && importi && importi.length > 0 && (
        <>
          <ul className="flex flex-col gap-1 text-ink-2">
            {importi.map((importo, i) => (
              <li key={i} className="flex justify-between">
                <span>Spesa passata {i + 1}</span>
                <span className="num">{formatEuro(importo)}</span>
              </li>
            ))}
          </ul>
          {suggerito !== null && (
            <div className="flex items-center justify-between border-t border-rule pt-2 font-semibold">
              <span>Importo suggerito</span>
              <span className="num">{formatEuro(suggerito)}</span>
            </div>
          )}
          <button
            type="button"
            disabled={suggerito === null}
            onClick={() => suggerito !== null && onUseAmount(Math.round(suggerito * 100) / 100)}
            className="min-h-11 rounded-[var(--radius-sm)] bg-brand py-2 text-[15px] font-semibold text-brand-foreground disabled:opacity-40"
          >
            Usa questo importo
          </button>
        </>
      )}
    </div>
  );
}
