'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { utenteOLogin } from '@/lib/utenteOLogin';
import { loadPercorsoData } from '@/lib/loadPercorsoData';
import { closeGoal, createGoal, getOpenGoals, reopenGoal, updateGoalPiano } from '@/lib/data/goals';
import { avvisoGiaDato, collegaAObiettivo, rispostaAvviso, segnaProposta } from '@/lib/data/percorso';
import { valutaAvvisoFondi, type AvvisoFondi } from '@/lib/calculations/percorso/avviso';
import { lezioneDopoSalvataggio } from '@/lib/calculations/percorso/regole';
import { rifondaImprevisti } from '@/lib/calculations/percorso/rifondaImprevisti';
import type { BudgetGoal } from '@/lib/types';
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
        // Una spesa già collegata a un obiettivo non si può spostare sul fondo: niente "Sì".
        fondoImprevisti: goalFondo && !t.goalId ? { goalId: goalFondo.id, accantonato: goalFondo.accantonato } : null,
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

export interface RispostaAvviso {
  // Quanto il fondo imprevisti ha coperto della spesa, e quanto resta da coprire con la prossima entrata.
  coperto: number;
  resto: number;
}

const arrotonda2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

// La risposta dell'utente all'avviso. "imprevisto" collega la spesa al fondo imprevisti, che deve
// essere un obiettivo aperto dell'utente con quel ruolo; la spesa deve essere una sua spesa personale.
// Il collegamento non basta: tenerlo com'è azzererebbe il fondo per mesi (vedi rifondaImprevisti),
// quindi il fondo si allunga oppure ricomincia, con la stessa quota mensile.
export async function rispondiAvviso(
  transactionId: string,
  risposta: 'imprevisto' | 'normale',
  goalId?: string
): Promise<RispostaAvviso> {
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
    .select('id, tipo, importo, user_id, household_id, goal_id')
    .eq('id', transactionId)
    .maybeSingle();
  if (error) throw error;
  if (!riga || riga.tipo !== 'expense' || riga.household_id !== null || riga.user_id !== user.id) {
    throw new Error('Spesa non valida');
  }

  let esito: RispostaAvviso = { coperto: 0, resto: 0 };
  if (risposta === 'imprevisto') {
    // Una spesa già collegata a un altro obiettivo non si sposta.
    if (riga.goal_id !== null && riga.goal_id !== goalId) throw new Error('Spesa già collegata');
    const fondo = (await getOpenGoals(supabase)).find((g) => g.id === goalId);
    if (!fondo || fondo.ruolo !== 'imprevisti') throw new Error('Obiettivo non valido');
    // Già collegata a questo fondo: il fondo è già stato sistemato, non si rifà.
    if (riga.goal_id === null) {
      const spesa = Number(riga.importo);
      if (!Number.isFinite(spesa) || spesa <= 0) throw new Error('Spesa non valida');
      esito = await usaFondoImprevisti(supabase, user.id, transactionId, fondo, spesa);
    }
  }
  await rispostaAvviso(supabase, transactionId, risposta);
  revalidatePath('/');
  return esito;
}

type Db = Awaited<ReturnType<typeof createClient>>;

// Prova a rimediare e non nasconde l'errore vero: chi chiama rilancia quello.
async function provaARimediare(azione: () => Promise<void>): Promise<void> {
  try {
    await azione();
  } catch {
    // meglio che niente
  }
}

async function usaFondoImprevisti(
  supabase: Db,
  userId: string,
  transactionId: string,
  fondo: BudgetGoal,
  spesa: number
): Promise<RispostaAvviso> {
  const d = await loadPercorsoData(supabase, new Date(), userId);
  const letto = d.goals.find((g) => g.id === fondo.id && g.stato === 'aperto');
  if (!letto) throw new Error('Obiettivo non valido');
  const accantonato = letto.accantonato;
  const piano = rifondaImprevisti({ goal: fondo, accantonato, spesa, oggi: d.oggi });
  const coperto = arrotonda2(Math.min(accantonato, spesa));
  const esito = { coperto, resto: arrotonda2(spesa - coperto) };

  if (piano.azione === 'estendi') {
    const prima = { importoTarget: fondo.importoTarget, scadenza: fondo.scadenza as string };
    await updateGoalPiano(supabase, fondo.id, { importoTarget: piano.importoTarget, scadenza: piano.scadenza });
    try {
      await collegaAObiettivo(supabase, transactionId, fondo.id);
    } catch (e) {
      await provaARimediare(() => updateGoalPiano(supabase, fondo.id, prima));
      throw e;
    }
    return esito;
  }

  // Ricomincia: la spesa va al vecchio fondo, che si chiude; poi ne nasce uno nuovo. Un solo cuscinetto
  // aperto per utente: la chiusura viene prima della creazione.
  await collegaAObiettivo(supabase, transactionId, fondo.id);
  try {
    await closeGoal(supabase, fondo.id);
  } catch (e) {
    await provaARimediare(() => collegaAObiettivo(supabase, transactionId, null));
    throw e;
  }
  try {
    await createGoal(supabase, {
      nome: fondo.nome,
      importoTarget: piano.nuovo.importoTarget,
      modalita: 'dilazionato',
      scadenza: piano.nuovo.scadenza,
      categoriaId: null,
      ricorrente: false,
      frequenzaMesi: null,
      accantonaDa: piano.nuovo.accantonaDa,
      ruolo: 'imprevisti',
    });
  } catch (e) {
    await provaARimediare(() => reopenGoal(supabase, fondo.id));
    await provaARimediare(() => collegaAObiettivo(supabase, transactionId, null));
    throw e;
  }
  return esito;
}
