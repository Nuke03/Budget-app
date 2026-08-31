'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getRecentTransactionAmounts } from '@/lib/data/transactions';
import { suggestImportoFromHistory } from '@/lib/calculations/suggestImportoFromHistory';
import { formatEuro } from '@/lib/format';

export function SuggestAmountPanel({
  categoriaId,
  onUseAmount,
}: {
  categoriaId: string;
  onUseAmount: (importo: number) => void;
}) {
  const [limite, setLimite] = useState('3');
  const [margine, setMargine] = useState('10');
  const [importi, setImporti] = useState<number[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const limiteNumerico = Number(limite);
    if (!limiteNumerico || limiteNumerico <= 0) return;

    let cancelled = false;
    setLoading(true);
    const supabase = createClient();
    getRecentTransactionAmounts(supabase, categoriaId, limiteNumerico).then((result) => {
      if (!cancelled) {
        setImporti(result);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [categoriaId, limite]);

  const margineNumerico = Number(margine);
  const suggerito =
    importi && importi.length > 0 && !Number.isNaN(margineNumerico)
      ? suggestImportoFromHistory(importi, margineNumerico)
      : null;

  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius-md)] bg-surface-muted p-4 text-sm">
      <div className="flex gap-3">
        <label className="flex flex-1 flex-col gap-1 text-xs font-medium text-muted">
          Quante spese passate
          <input
            aria-label="Quante spese passate"
            type="number"
            value={limite}
            onChange={(e) => setLimite(e.target.value)}
            className="rounded-[var(--radius-sm)] border border-black/5 bg-surface px-3 py-2 text-sm outline-none"
          />
        </label>
        <label className="flex flex-1 flex-col gap-1 text-xs font-medium text-muted">
          Margine %
          <input
            aria-label="Margine %"
            type="number"
            value={margine}
            onChange={(e) => setMargine(e.target.value)}
            className="rounded-[var(--radius-sm)] border border-black/5 bg-surface px-3 py-2 text-sm outline-none"
          />
        </label>
      </div>

      {loading && <p className="text-muted">Ricerca spese passate...</p>}

      {!loading && importi && importi.length === 0 && (
        <p className="text-muted">
          Non ci sono ancora abbastanza spese in questa categoria per calcolare una media.
        </p>
      )}

      {!loading && importi && importi.length > 0 && (
        <>
          <p className="text-muted">
            Calcolato su {importi.length} {importi.length === 1 ? 'spesa passata' : 'spese passate'}.
          </p>
          {suggerito !== null && (
            <div className="flex items-center justify-between border-t border-black/5 pt-2 font-semibold">
              <span>Importo suggerito</span>
              <span className="tabular-nums">{formatEuro(suggerito)}</span>
            </div>
          )}
          <button
            type="button"
            disabled={suggerito === null}
            onClick={() => suggerito !== null && onUseAmount(Math.round(suggerito * 100) / 100)}
            className="rounded-[var(--radius-sm)] bg-brand py-2 text-sm font-semibold text-brand-foreground disabled:opacity-40"
          >
            Usa questo importo
          </button>
        </>
      )}
    </div>
  );
}
