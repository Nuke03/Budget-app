import type { SupabaseClient } from '@supabase/supabase-js';
import type { Household, HouseholdInvite, HouseholdMember } from '../types';

export interface CasaCorrente {
  household: Household;
  members: HouseholdMember[];
  invite: HouseholdInvite | null;
  me: HouseholdMember;
}

interface MemberRow {
  household_id: string;
  user_id: string;
  display_name: string;
  joined_at: string;
  slot: number;
  attivo: boolean;
}

interface HouseholdRow {
  id: string;
  nome: string;
  created_at: string;
  archiviata_il: string | null;
}

interface InviteRow {
  id: string;
  household_id: string;
  codice: string;
  created_at: string;
  scade_il: string;
  revocato_il: string | null;
}

function mapMember(r: MemberRow): HouseholdMember {
  return {
    householdId: r.household_id,
    userId: r.user_id,
    displayName: r.display_name,
    joinedAt: r.joined_at,
    slot: r.slot,
    attivo: r.attivo,
  };
}

function mapInvite(r: InviteRow): HouseholdInvite {
  return {
    id: r.id,
    householdId: r.household_id,
    codice: r.codice,
    createdAt: r.created_at,
    scadeIl: r.scade_il,
    revocatoIl: r.revocato_il,
  };
}

export async function getMyHousehold(supabase: SupabaseClient, userId: string): Promise<CasaCorrente | null> {
  const { data: membri, error: membriError } = await supabase
    .from('household_members')
    .select('household_id, user_id, display_name, joined_at, slot, attivo');
  if (membriError) throw membriError;

  const righe = (membri ?? []) as MemberRow[];
  const mia = righe.find((r) => r.user_id === userId && r.attivo);
  if (!mia) return null;

  const { data: caseRows, error: casaError } = await supabase
    .from('households')
    .select('id, nome, created_at, archiviata_il')
    .eq('id', mia.household_id);
  if (casaError) throw casaError;
  const casaRow = ((caseRows ?? []) as HouseholdRow[])[0];
  if (!casaRow || casaRow.archiviata_il !== null) return null;

  const { data: inviti, error: invitiError } = await supabase
    .from('household_invites')
    .select('id, household_id, codice, created_at, scade_il, revocato_il')
    .eq('household_id', mia.household_id);
  if (invitiError) throw invitiError;

  const adesso = Date.now();
  const validi = ((inviti ?? []) as InviteRow[])
    .filter((i) => i.household_id === mia.household_id && i.revocato_il === null && Date.parse(i.scade_il) > adesso)
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));

  const members = righe
    .filter((r) => r.household_id === mia.household_id && r.attivo)
    .map(mapMember)
    .sort((a, b) => a.slot - b.slot);

  return {
    household: {
      id: casaRow.id,
      nome: casaRow.nome,
      createdAt: casaRow.created_at,
      archiviataIl: casaRow.archiviata_il,
    },
    members,
    invite: validi[0] ? mapInvite(validi[0]) : null,
    me: mapMember(mia),
  };
}

export async function createHousehold(
  supabase: SupabaseClient,
  input: { nome: string; displayName: string }
): Promise<string> {
  const { data, error } = await supabase.rpc('create_household', {
    p_nome: input.nome,
    p_display_name: input.displayName,
  });
  if (error) throw error;
  return data as string;
}

export async function createInvite(supabase: SupabaseClient, householdId: string): Promise<string> {
  const { data, error } = await supabase.rpc('create_invite', { p_household: householdId });
  if (error) throw error;
  return data as string;
}

export async function revokeInvite(supabase: SupabaseClient, householdId: string): Promise<void> {
  const { error } = await supabase.rpc('revoke_invite', { p_household: householdId });
  if (error) throw error;
}

export async function joinHousehold(
  supabase: SupabaseClient,
  input: { codice: string; displayName: string }
): Promise<string> {
  const { data, error } = await supabase.rpc('join_household', {
    p_codice: input.codice.trim(),
    p_display_name: input.displayName,
  });
  if (error) throw error;
  return data as string;
}

export type MotivoBlocco = 'credito' | 'debito' | 'arretrati' | 'ultimo_membro' | 'non_ultimo_membro';

export class CasaBloccataError extends Error {
  reason: MotivoBlocco;
  constructor(reason: MotivoBlocco) {
    super(reason);
    this.name = 'CasaBloccataError';
    this.reason = reason;
  }
}

const MESSAGGI_BLOCCO: Record<string, MotivoBlocco> = {
  CREDITO_APERTO: 'credito',
  DEBITO_APERTO: 'debito',
  ARRETRATI_APERTI: 'arretrati',
  ULTIMO_MEMBRO: 'ultimo_membro',
  NON_ULTIMO_MEMBRO: 'non_ultimo_membro',
};

function traduciErrore(error: { message: string }): never {
  const motivo = MESSAGGI_BLOCCO[error.message];
  if (motivo) throw new CasaBloccataError(motivo);
  throw error;
}

export async function leaveHousehold(supabase: SupabaseClient): Promise<void> {
  const { error } = await supabase.rpc('leave_household');
  if (error) traduciErrore(error);
}

export async function closeHousehold(supabase: SupabaseClient): Promise<void> {
  const { error } = await supabase.rpc('close_household');
  if (error) traduciErrore(error);
}

export function formatCodiceInvito(codice: string): string {
  const meta = Math.ceil(codice.length / 2);
  return `${codice.slice(0, meta)}-${codice.slice(meta)}`;
}
