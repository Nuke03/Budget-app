'use client';

import type { Periodo } from '@/lib/calculations/filterTransactionsByPeriodo';

const PRESETS: { value: Periodo; label: string }[] = [
  { value: 'mese', label: 'Questo mese' },
  { value: '3mesi', label: 'Ultimi 3 mesi' },
  { value: '6mesi', label: 'Ultimi 6 mesi' },
  { value: 'anno', label: 'Ultimo anno' },
  { value: 'personalizzato', label: 'Personalizzato' },
];

export function PeriodoFilter({
  periodo,
  onChangePeriodo,
  rangePersonalizzato,
  onChangeRangePersonalizzato,
}: {
  periodo: Periodo;
  onChangePeriodo: (periodo: Periodo) => void;
  rangePersonalizzato: { da: string; a: string };
  onChangeRangePersonalizzato: (range: { da: string; a: string }) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
        {PRESETS.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => onChangePeriodo(p.value)}
            className={`shrink-0 rounded-full px-3.5 py-2 text-sm font-semibold transition-colors duration-150 ${
              periodo === p.value
                ? 'bg-brand text-brand-foreground'
                : 'bg-surface-muted text-muted'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {periodo === 'personalizzato' && (
        <div className="flex gap-2">
          <div className="flex flex-1 flex-col gap-1 text-xs font-medium text-muted">
            <label htmlFor="periodo-da">Data inizio</label>
            <input
              id="periodo-da"
              type="date"
              value={rangePersonalizzato.da}
              onChange={(e) =>
                onChangeRangePersonalizzato({ ...rangePersonalizzato, da: e.target.value })
              }
              className="rounded-[var(--radius-sm)] border border-black/5 bg-surface px-3 py-2 text-sm outline-none"
            />
          </div>
          <div className="flex flex-1 flex-col gap-1 text-xs font-medium text-muted">
            <label htmlFor="periodo-a">Data fine</label>
            <input
              id="periodo-a"
              type="date"
              value={rangePersonalizzato.a}
              onChange={(e) =>
                onChangeRangePersonalizzato({ ...rangePersonalizzato, a: e.target.value })
              }
              className="rounded-[var(--radius-sm)] border border-black/5 bg-surface px-3 py-2 text-sm outline-none"
            />
          </div>
        </div>
      )}
    </div>
  );
}
