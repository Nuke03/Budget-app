'use client';

import { formatEuro } from '@/lib/format';
import { computeCategoryShares } from '@/lib/calculations/categoryShares';
import { CATEGORY_COLOR_FALLBACK } from '@/lib/categoryColors';

// Spese per categoria: una barra piatta per riga, nel colore della categoria.
export function HistoryChartCard({
  chartData,
  colorByCategoryName,
}: {
  chartData: { nome: string; totale: number }[];
  colorByCategoryName: Map<string, string>;
}) {
  const shares = computeCategoryShares(chartData);
  const massimo = Math.max(0, ...shares.map((s) => s.totale));

  return (
    <section
      data-testid="history-chart-card"
      aria-labelledby="spese-per-categoria"
      className="rounded-[var(--radius-md)] border border-rule bg-surface p-4"
    >
      <h2 id="spese-per-categoria" className="font-serif text-lg font-semibold">
        Per categoria
      </h2>
      {shares.length === 0 ? (
        <p className="mt-2 text-[15px] text-ink-2">Nessuna spesa da mostrare.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-3">
          {shares.map((s) => (
            <li key={s.nome} className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-3 text-[15px]">
                <span className="min-w-0 truncate">{s.nome}</span>
                <span className="num shrink-0 font-semibold">
                  {formatEuro(s.totale)} <span className="font-normal text-ink-2">({s.percentuale.toFixed(0)}%)</span>
                </span>
              </div>
              <div aria-hidden="true" className="h-2 w-full rounded-full bg-brand-tint">
                <div
                  data-barra={s.nome}
                  className="h-2 rounded-full"
                  style={{
                    width: `${massimo > 0 ? (s.totale / massimo) * 100 : 0}%`,
                    backgroundColor: colorByCategoryName.get(s.nome) ?? CATEGORY_COLOR_FALLBACK,
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
