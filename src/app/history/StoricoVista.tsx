'use client';

import { Pencil, Trash2 } from 'lucide-react';
import { aggregateByCategory } from '@/lib/calculations/aggregateByCategory';
import type { Periodo } from '@/lib/calculations/filterTransactionsByPeriodo';
import type { RigaNeutra } from '@/lib/calculations/casa/righeNeutre';
import { formatEuro } from '@/lib/format';
import { CATEGORY_COLOR_FALLBACK } from '@/lib/categoryColors';
import { CoverHeader } from '../CoverHeader';
import { PallinoCategoria } from '../home/PallinoCategoria';
import { giornoEMese } from '../home/formati';
import { raggruppaPerGiorno } from './raggruppaPerGiorno';
import { HistoryChartCard } from './HistoryChartCard';
import { StoricoCasa } from './StoricoCasa';
import { PeriodoFilter } from './PeriodoFilter';
import type { Transaction, Category } from '@/lib/types';

// Il corpo dello Storico, senza letture né scritture: la pagina gli passa dati e azioni.
export function StoricoVista({
  transactionsFiltrate,
  transactionsTotali,
  righeNeutreFiltrate,
  righeTasse = [],
  categories,
  caricato,
  periodo,
  rangePersonalizzato,
  onChangePeriodo,
  onChangeRange,
  onEdit,
  onDelete,
  onEliminaTasse,
}: {
  transactionsFiltrate: Transaction[];
  transactionsTotali: number;
  righeNeutreFiltrate: RigaNeutra[];
  // Gli spostamenti sul conto tasse (solo per chi ha la P.IVA): fuori da totali e grafici.
  righeTasse?: RigaNeutra[];
  categories: Category[];
  caricato: boolean;
  periodo: Periodo;
  rangePersonalizzato: { da: string; a: string };
  onChangePeriodo: (p: Periodo) => void;
  onChangeRange: (range: { da: string; a: string }) => void;
  onEdit: (t: Transaction) => void;
  onDelete: (t: Transaction) => void;
  onEliminaTasse?: (r: RigaNeutra) => void;
}) {
  const chartData = aggregateByCategory(transactionsFiltrate, categories);
  const colorByCategoryName = new Map(
    categories.map((c) => [c.nome, c.colore ?? CATEGORY_COLOR_FALLBACK])
  );
  const colorByCategoryId = new Map(categories.map((c) => [c.id, c.colore ?? CATEGORY_COLOR_FALLBACK]));
  const giorni = raggruppaPerGiorno(transactionsFiltrate);
  const annoCorrente = new Date().getFullYear();
  const titoloGiorno = (data: string) =>
    Number(data.slice(0, 4)) === annoCorrente ? giornoEMese(data) : `${giornoEMese(data)} ${data.slice(0, 4)}`;

  const BOTTONE_ICONA =
    'flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-2 hover:bg-brand-tint';

  return (
    <>
      <CoverHeader titolo="Storico" />
      <main className="mx-auto flex max-w-md flex-col gap-3.5 px-3 pb-28 pt-3.5">
        <PeriodoFilter
          periodo={periodo}
          onChangePeriodo={onChangePeriodo}
          rangePersonalizzato={rangePersonalizzato}
          onChangeRangePersonalizzato={onChangeRange}
        />

        <HistoryChartCard chartData={chartData} colorByCategoryName={colorByCategoryName} />

        <section className="overflow-hidden rounded-[var(--radius-md)] border border-rule bg-surface">
          <h2 className="sr-only">Movimenti</h2>
          {giorni.map((g) => (
            <div key={g.data} data-giorno={g.data}>
              <div className="flex items-baseline justify-between gap-3 border-b border-rule px-4 py-2.5">
                <h3 className="text-[13px] font-semibold text-ink-2">{titoloGiorno(g.data)}</h3>
                <p className="num text-[13px] font-semibold">
                  <span className="sr-only">Totale del giorno </span>
                  {g.totale === 0 ? '' : g.totale < 0 ? '−' : '+'}
                  {formatEuro(Math.abs(g.totale))}
                </p>
              </div>
              <ul>
                {g.righe.map((t) => (
                  <li
                    key={t.id}
                    data-riga
                    className="flex min-h-12 items-center gap-2 border-b border-rule py-1 pl-4 pr-1 text-[15px]"
                  >
                    <PallinoCategoria colore={t.categoriaId ? (colorByCategoryId.get(t.categoriaId) ?? null) : null} />
                    <span className="min-w-0 flex-1 truncate">{t.descrizione || '(senza descrizione)'}</span>
                    <span className={`num shrink-0 ${t.tipo === 'income' ? 'font-semibold text-brand-dark' : ''}`}>
                      {t.tipo === 'income' ? '+' : '−'}
                      {formatEuro(t.importo)}
                    </span>
                    <button
                      type="button"
                      onClick={() => onEdit(t)}
                      aria-label="Modifica transazione"
                      className={BOTTONE_ICONA}
                    >
                      <Pencil size={18} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(t)}
                      aria-label="Elimina transazione"
                      className={BOTTONE_ICONA}
                    >
                      <Trash2 size={18} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {caricato && transactionsFiltrate.length === 0 && (
            <p className="px-4 py-5 text-[15px] text-ink-2">
              {transactionsTotali === 0
                ? 'Il libretto è vuoto: la prima spesa che segni compare qui.'
                : 'Nessun movimento in questo periodo.'}
            </p>
          )}
        </section>

        <StoricoCasa righe={righeNeutreFiltrate} />
        <StoricoCasa
          righe={righeTasse}
          titolo="Tasse messe da parte"
          id="tasse-messe-da-parte"
          nota="Sono sempre soldi tuoi: cambiano solo conto."
          onElimina={onEliminaTasse}
        />
      </main>
    </>
  );
}
