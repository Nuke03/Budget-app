import type { SupabaseClient } from '@supabase/supabase-js';
import { oggiRomaISO } from '../calculations/casa/oggi';
import type { Spostamento } from '../calculations/rientri';

const COLONNE = 'id, da_account_id, a_account_id, importo, data, created_at';
const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;
const arrotonda2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

interface SpostamentoRow {
  id: string;
  da_account_id: string | null;
  a_account_id: string | null;
  importo: number | string;
  data: string;
  created_at: string;
}

// Dal più recente; `da` ('yyyy-MM-dd') tiene solo gli spostamenti da quel giorno in poi.
export async function getSpostamenti(supabase: SupabaseClient, da?: string): Promise<Spostamento[]> {
  let q = supabase.from('spostamenti').select(COLONNE);
  if (da) q = q.gte('data', da);
  const { data, error } = await q.order('data', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as SpostamentoRow[]).map((r) => ({
    id: r.id,
    daAccountId: r.da_account_id,
    aAccountId: r.a_account_id,
    importo: Number(r.importo),
    data: r.data,
    createdAt: r.created_at,
  }));
}

export async function sposta(
  supabase: SupabaseClient,
  input: { daAccountId: string; aAccountId: string; importo: number; data: string },
  oggi: Date = new Date()
): Promise<string> {
  if (typeof input.importo !== 'number' || !Number.isFinite(input.importo) || input.importo <= 0 || input.importo >= 1e9) {
    throw new Error('Importo non valido');
  }
  const importo = arrotonda2(input.importo);
  if (importo <= 0) throw new Error('Importo non valido');
  const d = typeof input.data === 'string' && DATA_ISO.test(input.data) ? new Date(`${input.data}T00:00:00Z`) : null;
  if (!d || Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== input.data || input.data > oggiRomaISO(oggi)) {
    throw new Error('Data non valida');
  }
  if (input.daAccountId === input.aAccountId) throw new Error('I due conti devono essere diversi');
  const { data, error } = await supabase.rpc('sposta_soldi', {
    p_da: input.daAccountId,
    p_a: input.aAccountId,
    p_importo: importo,
    p_data: input.data,
  });
  if (error) throw error;
  return data as string;
}

export async function annullaSpostamento(supabase: SupabaseClient, id: string): Promise<number> {
  const { data, error } = await supabase.rpc('annulla_spostamento', { p_id: id });
  if (error) throw error;
  return (data as number) ?? 0;
}
