'use client';

import { useRef, useState } from 'react';
import { BarChart, Bar, PieChart, Pie, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { formatEuro } from '@/lib/format';
import { computeCategoryShares } from '@/lib/calculations/categoryShares';
import { CATEGORY_COLOR_FALLBACK } from '@/lib/categoryColors';

const SWIPE_THRESHOLD_PX = 50;

const tooltipStyle = {
  borderRadius: 12,
  border: 'none',
  boxShadow: '0 4px 16px -4px rgb(15 23 42 / 0.15)',
};

export function HistoryChartCard({
  chartData,
  colorByCategoryName,
}: {
  chartData: { nome: string; totale: number }[];
  colorByCategoryName: Map<string, string>;
}) {
  const [view, setView] = useState<'barre' | 'torta'>('barre');
  const touchStartX = useRef<number | null>(null);
  const shares = computeCategoryShares(chartData);

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    if (deltaX < -SWIPE_THRESHOLD_PX) setView('torta');
    else if (deltaX > SWIPE_THRESHOLD_PX) setView('barre');
    touchStartX.current = null;
  }

  return (
    <div
      data-testid="history-chart-card"
      className="rounded-[var(--radius-lg)] bg-surface p-4 shadow-[var(--shadow-card)]"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="h-56 w-full">
        {view === 'barre' ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <XAxis dataKey="nome" tick={{ fontSize: 10, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--muted)' }} axisLine={false} tickLine={false} width={36} />
              <Tooltip formatter={(value) => formatEuro(Number(value))} contentStyle={tooltipStyle} />
              <Bar dataKey="totale" radius={[6, 6, 0, 0]}>
                {chartData.map((entry) => (
                  <Cell
                    key={entry.nome}
                    fill={colorByCategoryName.get(entry.nome) ?? CATEGORY_COLOR_FALLBACK}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={chartData} dataKey="totale" nameKey="nome" innerRadius={40} outerRadius={72}>
                {chartData.map((entry) => (
                  <Cell
                    key={entry.nome}
                    fill={colorByCategoryName.get(entry.nome) ?? CATEGORY_COLOR_FALLBACK}
                  />
                ))}
              </Pie>
              <Tooltip formatter={(value) => formatEuro(Number(value))} contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="mt-2 flex justify-center gap-2">
        <button
          type="button"
          aria-label="Mostra grafico a barre"
          onClick={() => setView('barre')}
          className={`h-2 w-2 rounded-full transition-colors duration-150 ${
            view === 'barre' ? 'bg-brand' : 'bg-black/15'
          }`}
        />
        <button
          type="button"
          aria-label="Mostra grafico a torta"
          onClick={() => setView('torta')}
          className={`h-2 w-2 rounded-full transition-colors duration-150 ${
            view === 'torta' ? 'bg-brand' : 'bg-black/15'
          }`}
        />
      </div>

      {view === 'torta' && (
        <ul className="mt-3 flex flex-col gap-2">
          {shares.map((s) => (
            <li key={s.nome} className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: colorByCategoryName.get(s.nome) ?? CATEGORY_COLOR_FALLBACK }}
                />
                {s.nome}
              </span>
              <span className="tabular-nums font-medium">
                {formatEuro(s.totale)}{' '}
                <span className="text-muted">({s.percentuale.toFixed(0)}%)</span>
              </span>
            </li>
          ))}
          {shares.length === 0 && (
            <p className="text-center text-sm text-muted">Nessuna spesa da mostrare.</p>
          )}
        </ul>
      )}
    </div>
  );
}
