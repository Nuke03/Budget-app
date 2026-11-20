import type { SupabaseClient } from '@supabase/supabase-js';
import { incassiPerMese, speseDelMese } from '@/lib/calculations/stipendio';
import type { RigaMese } from '@/lib/calculations/casa/versamenti';
import { getOpenGoals } from '@/lib/data/goals';
import { getSpecoCollegatoPerObiettivi } from '@/lib/data/goalSpending';
import { getVersatoNelleFinestre } from '@/lib/data/goalVersamenti';
import { getMyHousehold } from '@/lib/data/households';
import { PERSONALE } from '@/lib/data/scope';
import { loadCasaStato, type CasaStato } from '@/lib/loadCasaStato';
import type { BudgetGoal, Transaction } from '@/lib/types';

const MESI_INCASSI = 6;
const MESI_SPESE = 3;

// Primo giorno del mese di `mesi` mesi fa (YYYY-MM-DD), da un giorno YYYY-MM-DD.
export function inizioMesiFa(oggi: string, mesi: number): string {
  const totale = Number(oggi.slice(0, 4)) * 12 + (Number(oggi.slice(5, 7)) - 1) - mesi;
  return `${Math.floor(totale / 12)}-${String((totale % 12) + 1).padStart(2, '0')}-01`;
}

// Gli anni di scadenze che la Home legge: dopo il 15 dicembre anche l'anno dopo, perché le scadenze
// di gennaio-marzo entrano nel "Da fare" a 15 giorni.
export function anniScadenzeHome(oggi: string): number[] {
  const anno = Number(oggi.slice(0, 4));
  return oggi > `${anno}-12-15` ? [anno, anno + 1] : [anno];
}

// Da dove leggere gli incassi: dal giorno della guida o, se prima, dall'inizio della finestra di 6 mesi.
export function inizioLetturaIncassi(guidataDal: string, oggi: string): string {
  const finestra = inizioMesiFa(oggi, MESI_INCASSI);
  return guidataDal < finestra ? guidataDal : finestra;
}

// Toglie i mesi vuoti iniziali: prima che l'app fosse usata la media non va diluita.
function dalPrimoMeseConDati(valori: number[]): number[] {
  const i = valori.findIndex((v) => v > 0);
  return i === -1 ? [] : valori.slice(i);
}

// Gli incassi netti dei mesi interi, dal primo mese con incassi in poi.
export function finestraIncassi(
  incassi: Transaction[],
  categoriaFatturatoId: string,
  oggi: string
): { incassiMensili: number[]; mesiConIncassi: number } {
  const incassiMensili = dalPrimoMeseConDati(incassiPerMese(incassi, categoriaFatturatoId, oggi, MESI_INCASSI));
  return { incassiMensili, mesiConIncassi: incassiMensili.length };
}

// Le spese dagli ultimi 3 mesi interi (conti del disponibile, personali), dal primo mese con spese.
export function speseUltimiMesi(t: Transaction[], contiDisponibile: Set<string>, oggi: string): number[] {
  const mesi: number[] = [];
  const anno = Number(oggi.slice(0, 4));
  const mese0 = Number(oggi.slice(5, 7)) - 1;
  for (let k = MESI_SPESE; k >= 1; k--) {
    const totale = anno * 12 + mese0 - k;
    const prefisso = `${Math.floor(totale / 12)}-${String((totale % 12) + 1).padStart(2, '0')}`;
    mesi.push(speseDelMese(t, contiDisponibile, prefisso));
  }
  return dalPrimoMeseConDati(mesi);
}

// La quota di casa del mese in corso e quanto è già stato versato: 0 senza casa o senza piano.
export function casaDelMese(
  righe: RigaMese[] | null,
  oggi: string
): { quotaCasaMensile: number; versatoCasaMese: number } {
  const riga = righe?.find((r) => r.mese.slice(0, 7) === oggi.slice(0, 7));
  return { quotaCasaMensile: riga?.atteso ?? 0, versatoCasaMese: riga?.versato ?? 0 };
}

// Per la pagina P.IVA (lato client): lo stato della casa di chi guarda, null se non ha una casa.
// Se non si legge lancia: lo stipendio non si calcola con una quota di casa sbagliata.
export async function leggiCasaPerStipendio(supabase: SupabaseClient, now: Date): Promise<CasaStato | null> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw error ?? new Error('Utente non trovato');
  const corrente = await getMyHousehold(supabase, data.user.id);
  return corrente ? loadCasaStato(supabase, corrente, now) : null;
}

// Per la pagina P.IVA (lato client): gli obiettivi aperti con quanto è già stato speso, come li legge la home.
export async function leggiGoalsConSpeso(
  supabase: SupabaseClient,
  now: Date
): Promise<(BudgetGoal & { specoCollegato: number; versatoNellaFinestra: number | null })[]> {
  const goals = await getOpenGoals(supabase);
  const [speso, versato] = await Promise.all([
    getSpecoCollegatoPerObiettivi(supabase, goals, now, PERSONALE),
    // I versamenti confermati contano come nella Home; se non si leggono, il riservato resta a tempo.
    getVersatoNelleFinestre(supabase, goals, now).catch(() => ({}) as Record<string, number | null>),
  ]);
  return goals.map((g) => ({ ...g, specoCollegato: speso[g.id] ?? 0, versatoNellaFinestra: versato[g.id] ?? null }));
}
