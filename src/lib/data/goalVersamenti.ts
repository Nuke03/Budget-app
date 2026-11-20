import type { SupabaseClient } from '@supabase/supabase-js';
import { dataNellaFinestraSpese, finestraSpeseGoal, type FinestraSpese } from '../calculations/accantonato';
import { oggiRomaISO } from '../calculations/casa/oggi';
import type { BudgetGoal } from '../types';

const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;
const arrotonda2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

// Una data 'yyyy-MM-dd' che esiste davvero (niente 30 febbraio).
function dataEsiste(data: string): boolean {
  if (!DATA_ISO.test(data)) return false;
  const d = new Date(`${data}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === data;
}

// "Ho messo da parte": scrive un versamento confermato su un obiettivo personale. I controlli sono
// qui, non solo nel modulo: l'importo deve essere un numero finito fra 0 (escluso) e 1 miliardo
// (escluso); la data deve esistere e non può essere nel futuro (giorno di Roma). Il database
// controlla anche che l'obiettivo sia davvero tuo e personale.
export async function confermaVersamento(
  supabase: SupabaseClient,
  goalId: string,
  importo: number,
  data: string,
  oggi: Date = new Date()
): Promise<void> {
  if (typeof importo !== 'number' || !Number.isFinite(importo) || importo <= 0 || importo >= 1e9) {
    throw new Error('Importo non valido');
  }
  if (typeof data !== 'string' || !dataEsiste(data) || data > oggiRomaISO(oggi)) {
    throw new Error('Data non valida');
  }
  const { error } = await supabase.from('goal_versamenti').insert({
    goal_id: goalId,
    importo: arrotonda2(importo),
    data,
  });
  if (error) throw error;
}

export interface ConfermeObiettivo {
  // null: l'obiettivo non ha mai avuto una conferma (vale il calcolo a tempo). Altrimenti è in "modalità
  // conferma" per sempre, e questo è il totale confermato nella finestra attuale (anche 0, a inizio ciclo).
  versato: number | null;
  // Quanto di quel totale è del mese di calendario in corso (giorno di Roma).
  mese: number;
}

// I versamenti confermati di tutti gli obiettivi con una sola lettura (come getSpecoCollegatoPerObiettivi):
// la query prende i versamenti dal primo inizio finestra in poi, poi si somma in JS dentro la finestra di
// ciascun obiettivo, con la stessa regola delle spese collegate (per i ricorrenti l'inizio è escluso).
// La modalità conferma è per obiettivo, non per finestra: basta una conferma, in qualunque momento, e da lì
// il riservato conta solo i versamenti del ciclo in corso (0 finché non confermi). Per questo la prima lettura
// non filtra per data: la finestra si applica solo alla somma.
// Solo i dilazionati hanno un versato: per gli altri `versato` è sempre null. Se la lettura fallisce lancia.
export async function getConfermePerObiettivi(
  supabase: SupabaseClient,
  goals: BudgetGoal[],
  today: Date
): Promise<Record<string, ConfermeObiettivo>> {
  const risultato: Record<string, ConfermeObiettivo> = {};
  const finestre: (FinestraSpese & { id: string })[] = [];
  for (const g of goals) {
    risultato[g.id] = { versato: null, mese: 0 };
    if (g.modalita !== 'dilazionato') continue;
    try {
      finestre.push({ id: g.id, ...finestraSpeseGoal(g, today) });
    } catch {
      // dati incompleti (nessuna scadenza): quell'obiettivo resta senza conferme
    }
  }
  if (finestre.length === 0) return risultato;

  const ids = finestre.map((f) => f.id);
  // Due letture sottili invece di tutta la storia: chi ha almeno una conferma (solo goal_id) e le righe dal
  // primo inizio finestra in poi. La modalità conferma non dipende dalla finestra, la somma sì.
  const primoInizio = finestre.reduce((min, f) => (f.da < min ? f.da : min), finestre[0].da);
  const [chi, righeLette] = await Promise.all([
    supabase.from('goal_versamenti').select('goal_id').in('goal_id', ids),
    supabase.from('goal_versamenti').select('goal_id, importo, data').in('goal_id', ids).gte('data', primoInizio),
  ]);
  if (chi.error) throw chi.error;
  if (righeLette.error) throw righeLette.error;

  const conferma = new Set(((chi.data ?? []) as { goal_id: string }[]).map((r) => r.goal_id));
  const righe = (righeLette.data ?? []) as { goal_id: string; importo: number; data: string }[];
  const mese = oggiRomaISO(today).slice(0, 7);
  for (const f of finestre) {
    if (!conferma.has(f.id)) continue;
    const sue = righe.filter((r) => r.goal_id === f.id);
    const dentro = sue.filter((r) => dataNellaFinestraSpese(r.data, f));
    risultato[f.id] = {
      versato: arrotonda2(dentro.reduce((s, r) => s + Number(r.importo), 0)),
      mese: arrotonda2(dentro.filter((r) => r.data.slice(0, 7) === mese).reduce((s, r) => s + Number(r.importo), 0)),
    };
  }
  return risultato;
}

// Solo il versato di ogni obiettivo: null = mai confermato (il riservato resta a tempo).
export async function getVersatoNelleFinestre(
  supabase: SupabaseClient,
  goals: BudgetGoal[],
  today: Date
): Promise<Record<string, number | null>> {
  const conferme = await getConfermePerObiettivi(supabase, goals, today);
  return Object.fromEntries(Object.entries(conferme).map(([id, c]) => [id, c.versato]));
}
