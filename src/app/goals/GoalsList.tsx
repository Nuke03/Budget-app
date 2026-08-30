import { formatEuro, formatDateIt } from '@/lib/format';
import type { BudgetGoal } from '@/lib/types';

export function GoalsList({ goals }: { goals: BudgetGoal[] }) {
  if (goals.length === 0) {
    return <p className="text-sm text-slate-500">Nessun obiettivo aperto.</p>;
  }

  return (
    <ul className="flex flex-col gap-3">
      {goals.map((g) => (
        <li key={g.id} className="rounded border p-3">
          <div className="flex justify-between font-medium">
            <span>{g.nome}</span>
            <span>{formatEuro(g.importoTarget)}</span>
          </div>
          <p className="text-sm text-slate-500">
            {g.modalita === 'bloccato' ? 'Bloccato' : 'Dilazionato'}
            {g.scadenza && ` · entro il ${formatDateIt(g.scadenza)}`}
            {g.ricorrente && ' · ricorrente'}
          </p>
        </li>
      ))}
    </ul>
  );
}
