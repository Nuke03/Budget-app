import type { SupabaseClient } from '@supabase/supabase-js';
import type { Transfer, TransferCausale } from '../types';
import { applyScope, PERSONALE, type Scope } from './scope';

const COLONNE =
  'id, household_id, user_id, da_account_id, a_account_id, importo, data, causale, beneficiario_user_id, per_conto_di_user_id, mese_competenza, solo_registrazione, nota, created_at';

interface TransferRow {
  id: string;
  household_id: string | null;
  user_id: string;
  da_account_id: string | null;
  a_account_id: string | null;
  importo: number | string;
  data: string;
  causale: TransferCausale;
  beneficiario_user_id: string | null;
  per_conto_di_user_id: string | null;
  mese_competenza: string | null;
  solo_registrazione: boolean;
  nota: string | null;
  created_at: string;
}

function mapRow(r: TransferRow): Transfer {
  return {
    id: r.id,
    householdId: r.household_id,
    userId: r.user_id,
    daAccountId: r.da_account_id,
    aAccountId: r.a_account_id,
    importo: Number(r.importo),
    data: r.data,
    causale: r.causale,
    beneficiarioUserId: r.beneficiario_user_id,
    perContoDiUserId: r.per_conto_di_user_id,
    meseCompetenza: r.mese_competenza,
    soloRegistrazione: r.solo_registrazione,
    nota: r.nota,
    createdAt: r.created_at,
  };
}

export async function getTransfers(supabase: SupabaseClient, scope: Scope = PERSONALE): Promise<Transfer[]> {
  const { data, error } = await applyScope(supabase.from('transfers').select(COLONNE), scope)
    .order('data', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as TransferRow[]).map(mapRow);
}

export interface RecordTransferInput {
  householdId: string | null;
  causale: TransferCausale;
  importo: number;
  data: string;
  daAccountId?: string | null;
  aAccountId?: string | null;
  beneficiarioUserId?: string | null;
  perContoDiUserId?: string | null;
  meseCompetenza?: string | null;
  soloRegistrazione?: boolean;
  nota?: string | null;
}

export async function recordTransfer(supabase: SupabaseClient, input: RecordTransferInput): Promise<string> {
  const { data, error } = await supabase.rpc('record_transfer', {
    p_household: input.householdId,
    p_causale: input.causale,
    p_importo: input.importo,
    p_data: input.data,
    p_da_account: input.daAccountId ?? null,
    p_a_account: input.aAccountId ?? null,
    p_beneficiario: input.beneficiarioUserId ?? null,
    p_per_conto_di: input.perContoDiUserId ?? null,
    p_mese_competenza: input.meseCompetenza ?? null,
    p_solo_registrazione: input.soloRegistrazione ?? false,
    p_nota: input.nota ?? null,
  });
  if (error) throw error;
  return data as string;
}

export async function deleteTransfer(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.rpc('delete_transfer', { p_id: id });
  if (error) throw error;
}

export function messaggioErroreTrasferimento(e: unknown): string {
  const testo = (e as { message?: string } | null)?.message ?? '';
  if (testo.includes('il beneficiario non ha conti')) {
    return "Chi riceve il rimborso non ha ancora un conto nell'app: scegliete \"Già riflesso nei saldi\".";
  }
  if (testo.includes('membro non valido')) return 'Quella persona non è più in casa.';
  return 'Salvataggio fallito, controlla la connessione e riprova.';
}
