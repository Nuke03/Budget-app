import type { SupabaseClient } from '@supabase/supabase-js';
import { MESI_RIENTRO, type MesiRientro, type Rientro, type StatoRientro } from '../calculations/rientri';
import { applyScope, PERSONALE, scopeHouseholdId, type Scope } from './scope';

const COLONNE =
  'id, user_id, household_id, goal_id, account_id, importo, mesi, creato_il, stato, fermato_il';
const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;
const arrotonda2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

interface RientroRow {
  id: string;
  user_id: string;
  household_id: string | null;
  goal_id: string | null;
  account_id: string | null;
  importo: number | string;
  mesi: number;
  creato_il: string;
  stato: StatoRientro;
  fermato_il: string | null;
}

function mapRow(row: RientroRow): Rientro {
  return {
    id: row.id,
    userId: row.user_id,
    householdId: row.household_id,
    goalId: row.goal_id,
    accountId: row.account_id,
    importo: Number(row.importo),
    mesi: row.mesi as MesiRientro,
    creatoIl: row.creato_il,
    stato: row.stato,
    fermatoIl: row.fermato_il,
  };
}

function dataEsiste(data: unknown): data is string {
  if (typeof data !== 'string' || !DATA_ISO.test(data)) return false;
  const d = new Date(`${data}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === data;
}

// Personali per default; con `casa(id)` quelli della casa.
export async function getRientri(supabase: SupabaseClient, scope: Scope = PERSONALE): Promise<Rientro[]> {
  const { data, error } = await applyScope(supabase.from('rientri').select(COLONNE), scope).order('creato_il', {
    ascending: true,
  });
  if (error) throw error;
  return ((data ?? []) as RientroRow[]).map(mapRow);
}

// Controlli qui, non solo nel modulo: importo, mesi, date, e un solo "dove" (obiettivo oppure conto).
export async function creaRientro(
  supabase: SupabaseClient,
  input: { goalId: string | null; accountId: string | null; importo: number; mesi: MesiRientro; creatoIl: string },
  scope: Scope = PERSONALE
): Promise<string> {
  if (typeof input.importo !== 'number' || !Number.isFinite(input.importo) || input.importo <= 0 || input.importo >= 1e9) {
    throw new Error('Importo non valido');
  }
  const importo = arrotonda2(input.importo);
  if (importo <= 0) throw new Error('Importo non valido');
  if (!MESI_RIENTRO.includes(input.mesi)) throw new Error('Mesi non validi');
  if (!dataEsiste(input.creatoIl)) throw new Error('Data non valida');
  if ((input.goalId === null) === (input.accountId === null)) {
    throw new Error('Serve un obiettivo oppure un conto, non entrambi');
  }
  const { data, error } = await supabase
    .from('rientri')
    .insert({
      goal_id: input.goalId,
      account_id: input.accountId,
      importo,
      mesi: input.mesi,
      creato_il: input.creatoIl,
      household_id: scopeHouseholdId(scope),
    })
    .select('id')
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

async function aggiornaStato(supabase: SupabaseClient, id: string, stato: StatoRientro, oggi: string) {
  if (!dataEsiste(oggi)) throw new Error('Data non valida');
  const { error } = await supabase.from('rientri').update({ stato, fermato_il: oggi }).eq('id', id);
  if (error) throw error;
}

export function fermaRientro(supabase: SupabaseClient, id: string, oggi: string): Promise<void> {
  return aggiornaStato(supabase, id, 'fermato', oggi);
}

// "Lascia stare"
export function chiudiRientro(supabase: SupabaseClient, id: string, oggi: string): Promise<void> {
  return aggiornaStato(supabase, id, 'chiuso', oggi);
}

export async function eliminaRientro(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from('rientri').delete().eq('id', id);
  if (error) throw error;
}
