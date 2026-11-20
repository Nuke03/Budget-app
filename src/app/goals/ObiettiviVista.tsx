'use client';

import { CoverHeader } from '../CoverHeader';
import { GoalsList, type GoalWithQuotaMensile } from './GoalsList';
import type { Category } from '@/lib/types';

// Il corpo di Obiettivi, senza letture né scritture: la pagina gli passa dati e azioni.
export function ObiettiviVista({
  goals,
  categories,
  onNuovo,
  onEdit,
  onClose,
  onHoMessoDaParte,
}: {
  goals: GoalWithQuotaMensile[];
  categories: Category[];
  onNuovo: () => void;
  onEdit: (goal: GoalWithQuotaMensile) => void;
  onClose: (goal: GoalWithQuotaMensile) => void;
  onHoMessoDaParte?: (goal: GoalWithQuotaMensile, importo: number, data: string) => Promise<void>;
}) {
  return (
    <>
      <CoverHeader titolo="Obiettivi" />
      <main className="mx-auto flex max-w-md flex-col gap-3.5 px-3 pb-28 pt-3.5">
        <button
          type="button"
          onClick={onNuovo}
          className="min-h-12 rounded-[var(--radius-md)] bg-brand px-4 py-3 text-base font-semibold text-brand-foreground"
        >
          Nuovo obiettivo
        </button>
        <GoalsList
          goals={goals}
          categories={categories}
          onEdit={onEdit}
          onClose={onClose}
          onHoMessoDaParte={onHoMessoDaParte}
        />
      </main>
    </>
  );
}
