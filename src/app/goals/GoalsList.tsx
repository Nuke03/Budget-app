import { Lock, Clock, Pencil, Archive, PiggyBank } from 'lucide-react';
import { formatEuro, formatDataLunga, formatNumero } from '@/lib/format';
import type { Spiegazione } from '@/lib/calculations/casa/spiegazioni';
import { ComeSiCalcola } from '@/app/casa/ComeSiCalcola';
import { computeAccantonatoFinora } from '@/lib/calculations/accantonato';
import { oggiRomaISO } from '@/lib/calculations/casa/oggi';
import { HoMessoDaParte } from './HoMessoDaParte';
import type { BudgetGoal, Category } from '@/lib/types';

function frequenzaLabel(mesi: number | null): string {
  if (mesi === 1) return 'mensile';
  if (mesi === 3) return 'trimestrale';
  if (mesi === 6) return 'semestrale';
  if (mesi === 12) return 'annuale';
  if (mesi) return `ogni ${mesi} mesi`;
  return '';
}

export interface GoalWithQuotaMensile extends BudgetGoal {
  quotaMensile: number | null;
  accantonato: number;
  // Quanto hai confermato con "Ho messo da parte" nel mese in corso (assente/0 = niente).
  confermatoMese?: number;
  // Quanto hai confermato nella finestra corrente (null/assente = nessuna conferma ancora).
  versatoNellaFinestra?: number | null;
  spiegazione?: Spiegazione;
}

export function GoalsList({
  goals,
  categories,
  onEdit,
  onClose,
  onHoMessoDaParte,
  versaId = null,
  variante,
  ancoraPrimo,
}: {
  goals: GoalWithQuotaMensile[];
  categories: Category[];
  onEdit?: (goal: GoalWithQuotaMensile) => void;
  onClose?: (goal: GoalWithQuotaMensile) => void;
  // Solo gli obiettivi personali a rate: la pagina passa la scrittura del versamento.
  onHoMessoDaParte?: (goal: GoalWithQuotaMensile, importo: number, data: string) => Promise<void>;
  // Il cassetto con questo id (dall'indirizzo ?versa=) si apre già sulla conferma.
  versaId?: string | null;
  variante?: 'casa';
  // Se c'è, il primo cassetto della lista porta questo data-fumetto.
  ancoraPrimo?: string;
}) {
  const casa = variante === 'casa';
  const oggi = oggiRomaISO();
  if (goals.length === 0) {
    return (
      <p
        className="rounded-[var(--radius-md)] border border-rule bg-surface p-4 text-center text-[15px] text-ink-2"
      >
        {casa ? 'Ancora niente messo da parte.' : 'Nessun obiettivo aperto.'}
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3.5">
      {goals.map((g, i) => {
        const tuttoSubito = g.modalita === 'bloccato';
        const categoriaNome = g.categoriaId
          ? categories.find((c) => c.id === g.categoriaId)?.nome
          : null;
        return (
          <li
            key={g.id}
            id={`goal-${g.id}`}
            data-fumetto={i === 0 ? ancoraPrimo : undefined}
            className="scroll-mt-20 rounded-[var(--radius-md)] border border-rule bg-surface p-4"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0 break-words text-[15px] font-semibold">{g.nome}</span>
              <div className="flex shrink-0 items-center">
                {!casa && <span className="num mr-2 font-serif text-lg font-semibold">{formatEuro(g.importoTarget)}</span>}
                {onEdit && (
                  <button
                    type="button"
                    onClick={() => onEdit(g)}
                    aria-label="Modifica obiettivo"
                    className="flex h-11 w-11 items-center justify-center rounded-full text-ink-2 hover:bg-brand-tint"
                  >
                    <Pencil size={18} aria-hidden="true" />
                  </button>
                )}
                {onClose && (
                  <button
                    type="button"
                    onClick={() => onClose(g)}
                    aria-label="Chiudi obiettivo"
                    className="flex h-11 w-11 items-center justify-center rounded-full text-ink-2 hover:bg-brand-tint hover:text-danger"
                  >
                    <Archive size={18} aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[13px] text-ink-2">
              {casa ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-brand-tint px-2.5 py-1 font-medium text-brand-dark">
                  <PiggyBank size={14} aria-hidden="true" />
                  Da parte
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-brand-tint px-2.5 py-1 font-medium text-brand-dark">
                  {tuttoSubito ? <Lock size={14} aria-hidden="true" /> : <Clock size={14} aria-hidden="true" />}
                  {tuttoSubito ? 'tutto messo da parte' : 'messo da parte finora'}
                </span>
              )}
              {g.scadenza && <span className="num">entro il {formatDataLunga(g.scadenza)}</span>}
              {g.ricorrente && g.frequenzaMesi && <span>· {frequenzaLabel(g.frequenzaMesi)}</span>}
              {categoriaNome && <span>· {categoriaNome}</span>}
            </div>
            {casa ? (
              <div className="mt-2 flex items-center justify-between gap-3 text-[15px]">
                <span className="num font-semibold">
                  {`${formatNumero(g.accantonato)} di ${formatNumero(g.importoTarget)} €`}
                </span>
                {g.quotaMensile !== null && (
                  <span className="num text-ink-2">{`${formatNumero(g.quotaMensile)} € al mese`}</span>
                )}
              </div>
            ) : null}
            {casa && g.spiegazione ? <ComeSiCalcola spiegazione={g.spiegazione} className="mt-2" /> : null}
            {!casa && g.quotaMensile !== null && (
              <div className="mt-2 flex items-center justify-between rounded-[var(--radius-sm)] bg-brand-tint px-3 py-2 text-[13px] font-medium text-brand-dark">
                <span>Da mettere da parte questo mese</span>
                <span className="num">{formatEuro(g.quotaMensile)}</span>
              </div>
            )}
            {!casa && g.accantonato !== g.importoTarget && (
              <div className="mt-2 flex items-center justify-between gap-3 text-[13px] text-ink-2">
                {tuttoSubito ? (
                  <span>
                    {g.accantonato > 0
                      ? `Già spesi ${formatEuro(g.importoTarget - g.accantonato)}, restano ${formatEuro(g.accantonato)} da parte`
                      : `Già spesi ${formatEuro(g.importoTarget)}, niente più da parte`}
                  </span>
                ) : (
                  <>
                    <span>Ancora riservato</span>
                    <span className="num font-medium">{formatEuro(g.accantonato)}</span>
                  </>
                )}
              </div>
            )}
            {!casa && onHoMessoDaParte && g.modalita === 'dilazionato' && g.quotaMensile !== null && (
              <>
                {(g.confermatoMese ?? 0) > 0 && (
                  <p className="num mt-2 text-[13px] text-ink-2">
                    Confermato questo mese: {formatEuro(g.confermatoMese as number)}
                  </p>
                )}
                <HoMessoDaParte
                  quota={g.quotaMensile}
                  finora={g.versatoNellaFinestra == null ? g.accantonato : null}
                  primoMese={g.versatoNellaFinestra == null && computeAccantonatoFinora(g, new Date()) === 0}
                  oggi={oggi}
                  apertoIniziale={versaId === g.id}
                  onConferma={(importo, data) => onHoMessoDaParte(g, importo, data)}
                />
              </>
            )}
          </li>
        );
      })}
    </ul>
  );
}
