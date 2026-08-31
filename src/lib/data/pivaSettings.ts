import type { SupabaseClient } from '@supabase/supabase-js';
import type { PivaSettings } from '../types';

interface PivaSettingsRow {
  id: string;
  attivo: boolean;
  data_apertura: string | null;
  categoria_fatturato_id: string | null;
  coefficiente_redditivita: number;
  aliquota_sostitutiva_override: number | null;
  aliquota_contributo_soggettivo: number;
  aliquota_contributo_integrativo: number;
  minimale_contributivo_annuo: number;
  contributi_versati_anno_precedente: number;
}

const SELECT_COLUMNS =
  'id, attivo, data_apertura, categoria_fatturato_id, coefficiente_redditivita, ' +
  'aliquota_sostitutiva_override, aliquota_contributo_soggettivo, aliquota_contributo_integrativo, ' +
  'minimale_contributivo_annuo, contributi_versati_anno_precedente';

function mapRow(row: PivaSettingsRow): PivaSettings {
  return {
    id: row.id,
    attivo: row.attivo,
    dataApertura: row.data_apertura,
    categoriaFatturatoId: row.categoria_fatturato_id,
    coefficienteRedditivita: row.coefficiente_redditivita,
    aliquotaSostitutivaOverride: row.aliquota_sostitutiva_override,
    aliquotaContributoSoggettivo: row.aliquota_contributo_soggettivo,
    aliquotaContributoIntegrativo: row.aliquota_contributo_integrativo,
    minimaleContributivoAnnuo: row.minimale_contributivo_annuo,
    contributiVersatiAnnoPrecedente: row.contributi_versati_anno_precedente,
  };
}

export interface PivaSettingsInput {
  attivo: boolean;
  dataApertura: string | null;
  categoriaFatturatoId: string | null;
  coefficienteRedditivita: number;
  aliquotaSostitutivaOverride: number | null;
  aliquotaContributoSoggettivo: number;
  aliquotaContributoIntegrativo: number;
  minimaleContributivoAnnuo: number;
  contributiVersatiAnnoPrecedente: number;
}

function toRow(input: PivaSettingsInput) {
  return {
    attivo: input.attivo,
    data_apertura: input.dataApertura,
    categoria_fatturato_id: input.categoriaFatturatoId,
    coefficiente_redditivita: input.coefficienteRedditivita,
    aliquota_sostitutiva_override: input.aliquotaSostitutivaOverride,
    aliquota_contributo_soggettivo: input.aliquotaContributoSoggettivo,
    aliquota_contributo_integrativo: input.aliquotaContributoIntegrativo,
    minimale_contributivo_annuo: input.minimaleContributivoAnnuo,
    contributi_versati_anno_precedente: input.contributiVersatiAnnoPrecedente,
  };
}

export async function getPivaSettings(supabase: SupabaseClient): Promise<PivaSettings | null> {
  const { data, error } = await supabase.from('piva_settings').select(SELECT_COLUMNS).maybeSingle();
  if (error) throw error;
  return data ? mapRow(data as PivaSettingsRow) : null;
}

export async function createPivaSettings(
  supabase: SupabaseClient,
  input: PivaSettingsInput
): Promise<PivaSettings> {
  const { data, error } = await supabase
    .from('piva_settings')
    .insert(toRow(input))
    .select(SELECT_COLUMNS)
    .single();

  if (error) throw error;
  return mapRow(data as PivaSettingsRow);
}

export async function updatePivaSettings(
  supabase: SupabaseClient,
  id: string,
  input: PivaSettingsInput
): Promise<PivaSettings> {
  const { data, error } = await supabase
    .from('piva_settings')
    .update(toRow(input))
    .eq('id', id)
    .select(SELECT_COLUMNS)
    .single();

  if (error) throw error;
  return mapRow(data as PivaSettingsRow);
}
