'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getOpenGoals, createGoal } from '@/lib/data/goals';
import { GoalsList } from './GoalsList';
import { CreateGoalForm } from './CreateGoalForm';
import type { BudgetGoal, GoalModalita } from '@/lib/types';

export default function GoalsPage() {
  const [goals, setGoals] = useState<BudgetGoal[]>([]);

  async function refresh() {
    const supabase = createClient();
    setGoals(await getOpenGoals(supabase));
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleCreate(payload: {
    nome: string;
    importoTarget: number;
    modalita: GoalModalita;
    scadenza: string | null;
    ricorrente: boolean;
    frequenzaMesi: number | null;
  }) {
    const supabase = createClient();
    await createGoal(supabase, { ...payload, categoriaId: null });
    await refresh();
  }

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 p-5 pt-8">
      <h1 className="text-2xl font-bold">Obiettivi di budget</h1>
      <GoalsList goals={goals} />
      <h2 className="text-lg font-bold">Nuovo obiettivo</h2>
      <CreateGoalForm onSubmit={handleCreate} />
    </main>
  );
}
