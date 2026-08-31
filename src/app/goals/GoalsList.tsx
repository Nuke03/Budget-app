import { Lock, Clock } from 'lucide-react';
import { formatEuro, formatDateIt } from '@/lib/format';
import type { BudgetGoal } from '@/lib/types';

export function GoalsList({ goals }: { goals: BudgetGoal[] }) {
  if (goals.length === 0) {
    return (
      <p className="rounded-[var(--radius-md)] bg-surface p-4 text-center text-sm text-muted shadow-[var(--shadow-card)]">
        Nessun obiettivo aperto.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {goals.map((g) => {
        const isBloccato = g.modalita === 'bloccato';
        return (
          <li
            key={g.id}
            className="rounded-[var(--radius-md)] bg-surface p-4 shadow-[var(--shadow-card)]"
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold">{g.nome}</span>
              <span className="tabular-nums font-semibold">{formatEuro(g.importoTarget)}</span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-medium ${
                  isBloccato ? 'bg-brand-tint text-brand-dark' : 'bg-cat-amber/15 text-cat-amber'
                }`}
              >
                {isBloccato ? <Lock size={12} /> : <Clock size={12} />}
                {isBloccato ? 'Bloccato' : 'Dilazionato'}
              </span>
              {g.scadenza && <span>entro il {formatDateIt(g.scadenza)}</span>}
              {g.ricorrente && <span>· ricorrente</span>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
