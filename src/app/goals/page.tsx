'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getOpenGoals, createGoal } from '@/lib/data/goals';
import { getCategories } from '@/lib/data/categories';
import { computeQuotaMensile } from '@/lib/calculations/accantonato';
import { GoalsList } from './GoalsList';
import { CreateGoalForm } from './CreateGoalForm';
import type { BudgetGoal, Category, GoalModalita } from '@/lib/types';

export default function GoalsPage() {
  const [goals, setGoals] = useState<BudgetGoal[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  async function refresh() {
    const supabase = createClient();
    const [openGoals, cats] = await Promise.all([getOpenGoals(supabase), getCategories(supabase)]);
    setGoals(openGoals);
    setCategories(cats);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleCreate(payload: {
    nome: string;
    importoTarget: number;
    modalita: GoalModalita;
    scadenza: string | null;
    categoriaId: string | null;
    ricorrente: boolean;
    frequenzaMesi: number | null;
  }) {
    const supabase = createClient();
    await createGoal(supabase, payload);
    await refresh();
  }

  const goalsConQuota = goals.map((g) => ({
    ...g,
    quotaMensile: computeQuotaMensile(g, new Date()),
  }));

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 p-5 pt-8">
      <h1 className="text-2xl font-bold">Obiettivi di budget</h1>
      <GoalsList goals={goalsConQuota} categories={categories} />
      <h2 className="text-lg font-bold">Nuovo obiettivo</h2>
      <CreateGoalForm categories={categories} onSubmit={handleCreate} />
    </main>
  );
}
