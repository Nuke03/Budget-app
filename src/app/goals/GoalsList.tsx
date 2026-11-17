import { Lock, Clock, Pencil, Trash2, PiggyBank } from 'lucide-react';
import { formatEuro, formatDateIt, formatNumero } from '@/lib/format';
import type { Spiegazione } from '@/lib/calculations/casa/spiegazioni';
import { ComeSiCalcola } from '@/app/casa/ComeSiCalcola';
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
  spiegazione?: Spiegazione;
}

export function GoalsList({
  goals,
  categories,
  onEdit,
  onClose,
  variante,
}: {
  goals: GoalWithQuotaMensile[];
  categories: Category[];
  onEdit?: (goal: GoalWithQuotaMensile) => void;
  onClose?: (goal: GoalWithQuotaMensile) => void;
  variante?: 'casa';
}) {
  const casa = variante === 'casa';
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
      {goals.map((g) => {
        const tuttoSubito = g.modalita === 'bloccato';
        const categoriaNome = g.categoriaId
          ? categories.find((c) => c.id === g.categoriaId)?.nome
          : null;
        return (
          <li
            key={g.id}
            className="rounded-[var(--radius-md)] border border-rule bg-surface p-4"
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
                    <Trash2 size={18} aria-hidden="true" />
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
              {g.scadenza && <span className="num">entro il {formatDateIt(g.scadenza)}</span>}
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
                <span>Sposta questo mese</span>
                <span className="num">{formatEuro(g.quotaMensile)}</span>
              </div>
            )}
            {!casa && g.accantonato !== g.importoTarget && (
              <div className="mt-2 flex items-center justify-between text-[13px] text-ink-2">
                <span>Ancora riservato</span>
                <span className="num font-medium">{formatEuro(g.accantonato)}</span>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
