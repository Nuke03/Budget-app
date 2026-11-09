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
      <p className="rounded-[var(--radius-md)] bg-surface p-4 text-center text-sm text-muted shadow-[var(--shadow-card)]">
        {casa ? 'Ancora niente messo da parte.' : 'Nessun obiettivo aperto.'}
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {goals.map((g) => {
        const isBloccato = g.modalita === 'bloccato';
        const categoriaNome = g.categoriaId
          ? categories.find((c) => c.id === g.categoriaId)?.nome
          : null;
        return (
          <li
            key={g.id}
            className="rounded-[var(--radius-md)] bg-surface p-4 shadow-[var(--shadow-card)]"
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold">{g.nome}</span>
              <div className="flex items-center gap-2">
                {!casa && <span className="tabular-nums font-semibold">{formatEuro(g.importoTarget)}</span>}
                {onEdit && (
                  <button
                    type="button"
                    onClick={() => onEdit(g)}
                    aria-label="Modifica obiettivo"
                    className="rounded-full p-1 text-muted hover:bg-surface-muted hover:text-foreground"
                  >
                    <Pencil size={14} />
                  </button>
                )}
                {onClose && (
                  <button
                    type="button"
                    onClick={() => onClose(g)}
                    aria-label="Chiudi obiettivo"
                    className="rounded-full p-1 text-muted hover:bg-surface-muted hover:text-danger"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
              {casa ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-brand-tint px-2.5 py-1 font-medium text-brand-dark">
                  <PiggyBank size={12} />
                  Da parte
                </span>
              ) : (
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-medium ${
                    isBloccato ? 'bg-brand-tint text-brand-dark' : 'bg-cat-amber/15 text-cat-amber'
                  }`}
                >
                  {isBloccato ? <Lock size={12} /> : <Clock size={12} />}
                  {isBloccato ? 'Bloccato' : 'Dilazionato'}
                </span>
              )}
              {g.scadenza && <span>entro il {formatDateIt(g.scadenza)}</span>}
              {g.ricorrente && g.frequenzaMesi && <span>· {frequenzaLabel(g.frequenzaMesi)}</span>}
              {categoriaNome && <span>· {categoriaNome}</span>}
            </div>
            {casa ? (
              <div className="mt-2 flex items-center justify-between gap-3 text-sm">
                <span className="font-semibold tabular-nums">
                  {`${formatNumero(g.accantonato)} di ${formatNumero(g.importoTarget)} €`}
                </span>
                {g.quotaMensile !== null && (
                  <span className="text-muted tabular-nums">{`${formatNumero(g.quotaMensile)} € al mese`}</span>
                )}
              </div>
            ) : null}
            {casa && g.spiegazione ? <ComeSiCalcola spiegazione={g.spiegazione} className="mt-2" /> : null}
            {!casa && g.quotaMensile !== null && (
              <div className="mt-2 flex items-center justify-between rounded-[var(--radius-sm)] bg-cat-sky/10 px-2.5 py-1.5 text-xs font-medium text-cat-sky">
                <span>Sposta questo mese</span>
                <span className="tabular-nums">{formatEuro(g.quotaMensile)}</span>
              </div>
            )}
            {!casa && g.accantonato !== g.importoTarget && (
              <div className="mt-2 flex items-center justify-between text-xs text-muted">
                <span>Ancora riservato</span>
                <span className="tabular-nums font-medium">{formatEuro(g.accantonato)}</span>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
