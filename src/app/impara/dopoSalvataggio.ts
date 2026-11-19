'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { utenteOLogin } from '@/lib/utenteOLogin';
import { loadPercorsoData } from '@/lib/loadPercorsoData';
import { getOpenGoals } from '@/lib/data/goals';
import { avvisoGiaDato, collegaAObiettivo, rispostaAvviso, segnaProposta } from '@/lib/data/percorso';
import { valutaAvvisoFondi, type AvvisoFondi } from '@/lib/calculations/percorso/avviso';
import { lezioneDopoSalvataggio } from '@/lib/calculations/percorso/regole';
import type { ArgomentoId } from '@/lib/percorso/tipi';

export type DopoSalvataggio =
  | { tipo: 'avviso'; avviso: AvvisoFondi; transactionId: string; lezione: ArgomentoId }
  | { tipo: 'lezione'; lezione: ArgomentoId }
  | null;

const ID = /^[0-9a-fA-F-]{8,64}$/;

// Dopo il salvataggio di una transazione personale: un avviso se la spesa ha usato soldi già messi
// da parte, altrimenti al più una lezione. Ogni errore dà null: il salvataggio vale comunque.
export async function valutaDopoSalvataggio(transactionId: string): Promise<DopoSalvataggio> {
  if (typeof transactionId !== 'string' || !ID.test(transactionId)) return null;
  try {
    const supabase = await createClient();
    const user = await utenteOLogin(supabase);
    const d = await loadPercorsoData(supabase, new Date(), user.id);
    // Le transazioni lette sono quelle personali: una riga di casa non si trova qui.
    const t = d.transazioni.find((x) => x.id === transactionId);
    if (!t || t.data > d.oggi) return null;

    if (t.tipo === 'expense' && !(await avvisoGiaDato(supabase, transactionId))) {
      // Senza conto (contanti) la spesa non tocca il disponibile.
      const conto = t.accountId ? d.conti.find((c) => c.id === t.accountId) : undefined;
      const goalFondo = d.goals.find((g) => g.ruolo === 'imprevisti' && g.stato === 'aperto');
      const avviso = valutaAvvisoFondi({
        importo: t.importo,
        contaInDisponibile: conto?.contaInDisponibile ?? false,
        // La spesa è già nel saldo: il disponibile letto adesso è quello "dopo".
        disponibileDopo: d.disponibileReale,
        riservati: d.riservati,
        fondoImprevisti: goalFondo ? { goalId: goalFondo.id, accantonato: goalFondo.accantonato } : null,
      });
      if (avviso) {
        // Prima si ricorda che l'avviso è scattato: non si ripete per la stessa spesa.
        await rispostaAvviso(supabase, transactionId, 'visto');
        return {
          tipo: 'avviso',
          avviso,
          transactionId,
          lezione: goalFondo ? 'prima-da-parte' : 'imprevisti',
        };
      }
    }

    const lezione = lezioneDopoSalvataggio(t, d);
    if (!lezione) return null;
    await segnaProposta(supabase, lezione, d.oggi);
    return { tipo: 'lezione', lezione };
  } catch {
    return null;
  }
}

// La risposta dell'utente all'avviso. "imprevisto" collega la spesa al fondo imprevisti, che deve
// essere un obiettivo aperto dell'utente con quel ruolo; la spesa deve essere una sua spesa personale.
export async function rispondiAvviso(
  transactionId: string,
  risposta: 'imprevisto' | 'normale',
  goalId?: string
): Promise<void> {
  if (typeof transactionId !== 'string' || !ID.test(transactionId)) throw new Error('Spesa non valida');
  if (risposta !== 'imprevisto' && risposta !== 'normale') throw new Error('Risposta non valida');
  if (risposta === 'imprevisto') {
    if (typeof goalId !== 'string' || !ID.test(goalId)) throw new Error('Obiettivo non valido');
  } else if (goalId !== undefined) {
    throw new Error('Obiettivo non previsto');
  }

  const supabase = await createClient();
  const user = await utenteOLogin(supabase);

  const { data: riga, error } = await supabase
    .from('transactions')
    .select('id, tipo, user_id, household_id, goal_id')
    .eq('id', transactionId)
    .maybeSingle();
  if (error) throw error;
  if (!riga || riga.tipo !== 'expense' || riga.household_id !== null || riga.user_id !== user.id) {
    throw new Error('Spesa non valida');
  }

  if (risposta === 'imprevisto') {
    // Una spesa già collegata a un altro obiettivo non si sposta.
    if (riga.goal_id !== null && riga.goal_id !== goalId) throw new Error('Spesa già collegata');
    const fondo = (await getOpenGoals(supabase)).find((g) => g.id === goalId);
    if (!fondo || fondo.ruolo !== 'imprevisti') throw new Error('Obiettivo non valido');
    await collegaAObiettivo(supabase, transactionId, fondo.id);
  }
  await rispostaAvviso(supabase, transactionId, risposta);
  revalidatePath('/');
}
