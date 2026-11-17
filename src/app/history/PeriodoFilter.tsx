'use client';

import type { Periodo } from '@/lib/calculations/filterTransactionsByPeriodo';
import { SceltePill } from '../casa/SceltePill';

const PRESETS: { chiave: Periodo; etichetta: string }[] = [
  { chiave: 'mese', etichetta: 'Questo mese' },
  { chiave: '3mesi', etichetta: 'Ultimi 3 mesi' },
  { chiave: '6mesi', etichetta: 'Ultimi 6 mesi' },
  { chiave: 'anno', etichetta: 'Ultimo anno' },
  { chiave: 'personalizzato', etichetta: 'Personalizzato' },
];

const CAMPO =
  'min-h-12 rounded-[var(--radius-md)] border border-rule bg-surface px-3 py-2 text-[15px] text-foreground focus-visible:border-brand';

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
    <div className="flex flex-col gap-3">
      <SceltePill
        legenda="Periodo"
        scorrevole
        opzioni={PRESETS}
        valore={periodo}
        onChange={(chiave) => onChangePeriodo(chiave as Periodo)}
      />

      {periodo === 'personalizzato' && (
        <div className="flex gap-2">
          <div className="flex min-w-0 flex-1 flex-col gap-1 text-[13px] text-ink-2">
            <label htmlFor="periodo-da">Data inizio</label>
            <input
              id="periodo-da"
              type="date"
              value={rangePersonalizzato.da}
              onChange={(e) => onChangeRangePersonalizzato({ ...rangePersonalizzato, da: e.target.value })}
              className={CAMPO}
            />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1 text-[13px] text-ink-2">
            <label htmlFor="periodo-a">Data fine</label>
            <input
              id="periodo-a"
              type="date"
              value={rangePersonalizzato.a}
              onChange={(e) => onChangeRangePersonalizzato({ ...rangePersonalizzato, a: e.target.value })}
              className={CAMPO}
            />
          </div>
        </div>
      )}
    </div>
  );
}
