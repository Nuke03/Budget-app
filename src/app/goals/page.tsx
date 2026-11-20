'use client';

import { useEffect, useState } from 'react';
import { useThrowToBoundary } from '@/lib/useThrowToBoundary';
import { createClient } from '@/lib/supabase/client';
import { getOpenGoals, createGoal, updateGoal, closeGoal } from '@/lib/data/goals';
import { getCategories } from '@/lib/data/categories';
import { getSpecoCollegato } from '@/lib/data/goalSpending';
import { confermaVersamento, getConfermePerObiettivi, type ConfermeObiettivo } from '@/lib/data/goalVersamenti';
import { computeQuotaMensile, accantonatoObiettivo } from '@/lib/calculations/accantonato';
import { useEliminaConAnnulla } from '../AnnullaProvider';
import { FoglioInferiore } from '../FoglioInferiore';
import type { GoalWithQuotaMensile } from './GoalsList';
import { ObiettiviVista } from './ObiettiviVista';
import { CreateGoalForm, type GoalPayload } from './CreateGoalForm';
import { leggiPrecompilato } from '@/lib/goalPrecompilato';
import type { BudgetGoal, Category } from '@/lib/types';

type GoalConSpeso = BudgetGoal & { specoCollegato: number; versatoNellaFinestra: number | null; confermatoMese: number };

export default function GoalsPage() {
  const fail = useThrowToBoundary();
  const eliminaConAnnulla = useEliminaConAnnulla();
  // Obiettivi tolti alla vista in attesa della scrittura vera: Annulla li rimette al loro posto.
  const [nascosti, setNascosti] = useState<Set<string>>(new Set());
  const [goals, setGoals] = useState<GoalConSpeso[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [editingGoal, setEditingGoal] = useState<GoalWithQuotaMensile | null>(null);
  const [creando, setCreando] = useState(false);
  // Nome e cifra che arrivano dall'indirizzo (la lista d'attesa): riempiono il modulo una volta sola.
  const [precompilato, setPrecompilato] = useState<GoalPayload | null>(null);

  async function refresh() {
    const supabase = createClient();
    const [openGoals, cats] = await Promise.all([getOpenGoals(supabase), getCategories(supabase)]);
    const today = new Date();
    const speseCollegate = await Promise.all(
      openGoals.map((g) => getSpecoCollegato(supabase, g, today))
    );
    // Se i versamenti non si leggono la pagina si apre con il riservato a tempo, come sempre.
    const conferme = await getConfermePerObiettivi(supabase, openGoals, today).catch(
      () => ({}) as Record<string, ConfermeObiettivo>
    );
    setGoals(
      openGoals.map((g, i) => ({
        ...g,
        specoCollegato: speseCollegate[i],
        versatoNellaFinestra: conferme[g.id]?.versato ?? null,
        confermatoMese: conferme[g.id]?.mese ?? 0,
      }))
    );
    setCategories(cats);
  }

  useEffect(() => {
    refresh().catch(fail);
  }, [fail]);

  // /goals?nuovo=1 (dai primi passi) apre subito il modulo del nuovo obiettivo; con nome e importo
  // validi (dalla lista d'attesa) il modulo parte già compilato.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has('nuovo')) {
      setPrecompilato(leggiPrecompilato(window.location.search));
      setCreando(true);
    }
  }, []);

  async function handleCreate(payload: GoalPayload) {
    const supabase = createClient();
    await createGoal(supabase, payload);
    setCreando(false);
    setPrecompilato(null);
    await refresh();
  }

  async function handleUpdate(payload: GoalPayload) {
    if (!editingGoal) return;
    const supabase = createClient();
    await updateGoal(supabase, editingGoal.id, payload);
    setEditingGoal(null);
    await refresh();
  }

  async function handleHoMessoDaParte(goal: GoalWithQuotaMensile, importo: number, data: string) {
    const supabase = createClient();
    await confermaVersamento(supabase, goal.id, importo, data);
    // Dopo la scrittura niente eccezioni: la conferma è fatta, la riga si aggiorna alla prossima apertura.
    await refresh().catch(() => {});
  }

  function handleClose(goal: GoalWithQuotaMensile) {
    const cambia = (nascondi: boolean) =>
      setNascosti((prima) => {
        const dopo = new Set(prima);
        if (nascondi) dopo.add(goal.id);
        else dopo.delete(goal.id);
        return dopo;
      });
    eliminaConAnnulla({
      id: goal.id,
      testo: 'Obiettivo chiuso.',
      nascondi: () => cambia(true),
      ripristina: () => cambia(false),
      esegui: async () => {
        const supabase = createClient();
        await closeGoal(supabase, goal.id);
        // Dopo la scrittura niente eccezioni: un nuovo tentativo ripeterebbe un'azione già fatta.
        await refresh().catch(() => {});
      },
    });
  }

  const goalsConQuota = goals.filter((g) => !nascosti.has(g.id)).map((g) => {
    const oggi = new Date();
    return {
      ...g,
      quotaMensile: computeQuotaMensile(g, oggi),
      accantonato: accantonatoObiettivo(g, oggi),
    };
  });

  return (
    <>
      <ObiettiviVista
        goals={goalsConQuota}
        categories={categories}
        onNuovo={() => {
          setPrecompilato(null);
          setCreando(true);
        }}
        onEdit={setEditingGoal}
        onClose={handleClose}
        onHoMessoDaParte={handleHoMessoDaParte}
      />

      {creando && (
        <FoglioInferiore
          titolo="Nuovo obiettivo"
          onClose={() => {
            setCreando(false);
            setPrecompilato(null);
          }}
        >
          <CreateGoalForm categories={categories} initial={precompilato} onSubmit={handleCreate} />
        </FoglioInferiore>
      )}

      {editingGoal && (
        <FoglioInferiore titolo="Modifica obiettivo" onClose={() => setEditingGoal(null)}>
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
        </FoglioInferiore>
      )}
    </>
  );
}
