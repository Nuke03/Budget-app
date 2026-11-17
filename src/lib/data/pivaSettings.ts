import type { SupabaseClient } from '@supabase/supabase-js';
import type { PivaSettings } from '../types';

const COLONNE =
  'id, attivo, data_apertura, categoria_fatturato_id, coefficiente_redditivita, aliquota_sostitutiva_override, aliquota_contributo_soggettivo, aliquota_contributo_integrativo, minimale_contributivo_annuo, contributi_versati_anno_precedente, conto_tasse_id, preset, guidata_dal, stipendio_mensile, stipendio_rivisto_il, incasso_mese_magro';

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
  conto_tasse_id: string | null;
  preset: 'enpap' | 'altro' | null;
  guidata_dal: string | null;
  stipendio_mensile: number | null;
  stipendio_rivisto_il: string | null;
  incasso_mese_magro: number | null;
}

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
    contoTasseId: row.conto_tasse_id,
    preset: row.preset,
    guidataDal: row.guidata_dal,
    stipendioMensile: row.stipendio_mensile,
    stipendioRivistoIl: row.stipendio_rivisto_il,
    incassoMeseMagro: row.incasso_mese_magro,
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
  contoTasseId: string | null;
  preset: 'enpap' | 'altro' | null;
  guidataDal: string | null;
  stipendioMensile: number | null;
  stipendioRivistoIl: string | null;
  incassoMeseMagro: number | null;
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
    conto_tasse_id: input.contoTasseId,
    preset: input.preset,
    guidata_dal: input.guidataDal,
    stipendio_mensile: input.stipendioMensile,
    stipendio_rivisto_il: input.stipendioRivistoIl,
    incasso_mese_magro: input.incassoMeseMagro,
  };
}

export async function getPivaSettings(supabase: SupabaseClient): Promise<PivaSettings | null> {
  const { data, error } = await supabase.from('piva_settings').select(COLONNE).maybeSingle();
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
    .select(COLONNE)
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
    .select(COLONNE)
    .single();

  if (error) throw error;
  return mapRow(data as PivaSettingsRow);
}
