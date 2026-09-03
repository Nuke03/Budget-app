'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { getOpenGoals, createGoal, updateGoal } from '@/lib/data/goals';
import { getCategories } from '@/lib/data/categories';
import { getSpecoCollegato } from '@/lib/data/goalSpending';
import { computeQuotaMensile, computeAccantonatoFinora } from '@/lib/calculations/accantonato';
import { GoalsList, type GoalWithQuotaMensile } from './GoalsList';
import { CreateGoalForm, type GoalPayload } from './CreateGoalForm';
import type { BudgetGoal, Category } from '@/lib/types';

type GoalConSpeso = BudgetGoal & { specoCollegato: number };

export default function GoalsPage() {
  const [goals, setGoals] = useState<GoalConSpeso[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [editingGoal, setEditingGoal] = useState<GoalWithQuotaMensile | null>(null);

  async function refresh() {
    const supabase = createClient();
    const [openGoals, cats] = await Promise.all([getOpenGoals(supabase), getCategories(supabase)]);
    const today = new Date();
    const speseCollegate = await Promise.all(
      openGoals.map((g) => getSpecoCollegato(supabase, g, today))
    );
    setGoals(openGoals.map((g, i) => ({ ...g, specoCollegato: speseCollegate[i] })));
    setCategories(cats);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleCreate(payload: GoalPayload) {
    const supabase = createClient();
    await createGoal(supabase, payload);
    await refresh();
  }

  async function handleUpdate(payload: GoalPayload) {
    if (!editingGoal) return;
    const supabase = createClient();
    await updateGoal(supabase, editingGoal.id, payload);
    setEditingGoal(null);
    await refresh();
  }

  const goalsConQuota = goals.map((g) => {
    const oggi = new Date();
    return {
      ...g,
      quotaMensile: computeQuotaMensile(g, oggi),
      accantonato: computeAccantonatoFinora(g, oggi, g.specoCollegato),
    };
  });

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 p-5 pt-8">
      <h1 className="text-2xl font-bold">Obiettivi di budget</h1>
      <GoalsList goals={goalsConQuota} categories={categories} onEdit={setEditingGoal} />
      <h2 className="text-lg font-bold">Nuovo obiettivo</h2>
      <CreateGoalForm categories={categories} onSubmit={handleCreate} />

      {editingGoal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <button
            type="button"
            aria-label="Chiudi"
            onClick={() => setEditingGoal(null)}
            className="animate-backdrop-in absolute inset-0 bg-black/40 backdrop-blur-sm"
          />
          <div className="animate-sheet-in relative w-full max-w-md rounded-t-[var(--radius-lg)] bg-surface pt-3 shadow-2xl">
            <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-black/10" />
            <div className="flex items-center justify-between px-5 pb-2">
              <h2 className="text-lg font-bold">Modifica obiettivo</h2>
              <button
                type="button"
                aria-label="Chiudi"
                onClick={() => setEditingGoal(null)}
                className="rounded-full p-1.5 text-muted hover:bg-surface-muted"
              >
                <X size={20} />
              </button>
            </div>
            <div className="max-h-[75vh] overflow-y-auto">
              <CreateGoalForm
                categories={categories}
                initial={{
                  nome: editingGoal.nome,
                  importoTarget: editingGoal.importoTarget,
                  modalita: editingGoal.modalita,
                  scadenza: editingGoal.scadenza,
                  categoriaId: editingGoal.categoriaId,
                  ricorrente: editingGoal.ricorrente,
                  frequenzaMesi: editingGoal.frequenzaMesi,
                }}
                submitLabel="Salva modifiche"
                onCancel={() => setEditingGoal(null)}
                onSubmit={handleUpdate}
              />
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
