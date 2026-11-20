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
import { FumettoPrimaVolta } from '@/app/fumetti/FumettoPrimaVolta';
import type { Transaction, Category } from '@/lib/types';

// Uno spostamento fra due conti tuoi: una riga del giorno, senza segno, fuori da totale e categorie.
export interface RigaSpostamento {
  id: string;
  data: string;
  etichetta: string;
  importo: number;
}

// Il corpo dello Storico, senza letture né scritture: la pagina gli passa dati e azioni.
export function StoricoVista({
  transactionsFiltrate,
  transactionsTotali,
  righeNeutreFiltrate,
  righeTasse = [],
  spostamenti = [],
  categories,
  caricato,
  periodo,
  rangePersonalizzato,
  onChangePeriodo,
  onChangeRange,
  onEdit,
  onDelete,
  onEliminaTasse,
  onEliminaSpostamento,
}: {
  transactionsFiltrate: Transaction[];
  transactionsTotali: number;
  righeNeutreFiltrate: RigaNeutra[];
  // Gli spostamenti sul conto tasse (solo per chi ha la P.IVA): fuori da totali e grafici.
  righeTasse?: RigaNeutra[];
  // Gli spostamenti fra i propri conti: righe del giorno, ma non sono spese né entrate.
  spostamenti?: RigaSpostamento[];
  categories: Category[];
  caricato: boolean;
  periodo: Periodo;
  rangePersonalizzato: { da: string; a: string };
  onChangePeriodo: (p: Periodo) => void;
  onChangeRange: (range: { da: string; a: string }) => void;
  onEdit: (t: Transaction) => void;
  onDelete: (t: Transaction) => void;
  onEliminaTasse?: (r: RigaNeutra) => void;
  onEliminaSpostamento?: (r: RigaSpostamento) => void;
}) {
  const chartData = aggregateByCategory(transactionsFiltrate, categories);
  const colorByCategoryName = new Map(
    categories.map((c) => [c.nome, c.colore ?? CATEGORY_COLOR_FALLBACK])
  );
  const colorByCategoryId = new Map(categories.map((c) => [c.id, c.colore ?? CATEGORY_COLOR_FALLBACK]));
  const giorni = raggruppaPerGiorno(transactionsFiltrate);
  const spostamentiDelGiorno = new Map<string, RigaSpostamento[]>();
  for (const sp of spostamenti) spostamentiDelGiorno.set(sp.data, [...(spostamentiDelGiorno.get(sp.data) ?? []), sp]);
  for (const data of spostamentiDelGiorno.keys()) {
    if (!giorni.some((g) => g.data === data)) giorni.push({ data, righe: [], totale: 0 });
  }
  giorni.sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0));
  const annoCorrente = new Date().getFullYear();
  const titoloGiorno = (data: string) =>
    Number(data.slice(0, 4)) === annoCorrente ? giornoEMese(data) : `${giornoEMese(data)} ${data.slice(0, 4)}`;

  const BOTTONE_ICONA =
    'flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-2 hover:bg-brand-tint';

  return (
    <>
      <CoverHeader titolo="Storico" />
      <main className="mx-auto flex max-w-md flex-col gap-3.5 px-3 pb-28 pt-3.5">
        <div data-fumetto="storico">
          <PeriodoFilter
            periodo={periodo}
            onChangePeriodo={onChangePeriodo}
            rangePersonalizzato={rangePersonalizzato}
            onChangeRangePersonalizzato={onChangeRange}
          />
        </div>
        <FumettoPrimaVolta
          id="storico"
          ancora="storico"
          testo="Scegli il periodo. Sotto vedi quanto è andato in ogni categoria."
        />

        <HistoryChartCard chartData={chartData} colorByCategoryName={colorByCategoryName} />

        <section className="overflow-hidden rounded-[var(--radius-md)] border border-rule bg-surface">
          <h2 className="sr-only">Movimenti</h2>
          {giorni.map((g) => (
            <div key={g.data} data-giorno={g.data}>
              <div className="flex items-baseline justify-between gap-3 border-b border-rule px-4 py-2.5">
                <h3 className="text-[13px] font-semibold text-ink-2">{titoloGiorno(g.data)}</h3>
                {g.righe.length > 0 ? (
                  <p className="num text-[13px] font-semibold">
                    <span className="sr-only">Totale del giorno </span>
                    {g.totale === 0 ? '' : g.totale < 0 ? '−' : '+'}
                    {formatEuro(Math.abs(g.totale))}
                  </p>
                ) : null}
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
                    {t.origine === 'riconciliazione' ? null : (
                      <button
                        type="button"
                        onClick={() => onEdit(t)}
                        aria-label="Modifica transazione"
                        className={BOTTONE_ICONA}
                      >
                        <Pencil size={18} aria-hidden="true" />
                      </button>
                    )}
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
                {(spostamentiDelGiorno.get(g.data) ?? []).map((r) => (
                  <li
                    key={r.id}
                    data-riga
                    className="flex min-h-12 items-center gap-2 border-b border-rule py-1 pl-4 pr-1 text-[15px]"
                  >
                    <span className="min-w-0 flex-1 truncate">{r.etichetta}</span>
                    <span className="num shrink-0 text-ink-2">{formatEuro(r.importo)}</span>
                    {onEliminaSpostamento ? (
                      <button
                        type="button"
                        onClick={() => onEliminaSpostamento(r)}
                        aria-label="Elimina spostamento"
                        className={BOTTONE_ICONA}
                      >
                        <Trash2 size={18} aria-hidden="true" />
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {caricato && giorni.length === 0 && (
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
