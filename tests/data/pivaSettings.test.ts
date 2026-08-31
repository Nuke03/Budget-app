import { describe, it, expect } from 'vitest';
import { getPivaSettings, createPivaSettings, updatePivaSettings } from '@/lib/data/pivaSettings';
import { fakeSelectClient, fakeMutationClient } from '../helpers/fakeSupabase';

const row = {
  id: '1',
  attivo: true,
  data_apertura: '2024-01-15',
  categoria_fatturato_id: 'cat-fatt',
  coefficiente_redditivita: 78,
  aliquota_sostitutiva_override: null,
  aliquota_contributo_soggettivo: 10,
  aliquota_contributo_integrativo: 4,
  minimale_contributivo_annuo: 856,
  contributi_versati_anno_precedente: 0,
};

const input = {
  attivo: true,
  dataApertura: '2024-01-15',
  categoriaFatturatoId: 'cat-fatt',
  coefficienteRedditivita: 78,
  aliquotaSostitutivaOverride: null,
  aliquotaContributoSoggettivo: 10,
  aliquotaContributoIntegrativo: 4,
  minimaleContributivoAnnuo: 856,
  contributiVersatiAnnoPrecedente: 0,
};

const mapped = {
  id: '1',
  attivo: true,
  dataApertura: '2024-01-15',
  categoriaFatturatoId: 'cat-fatt',
  coefficienteRedditivita: 78,
  aliquotaSostitutivaOverride: null,
  aliquotaContributoSoggettivo: 10,
  aliquotaContributoIntegrativo: 4,
  minimaleContributivoAnnuo: 856,
  contributiVersatiAnnoPrecedente: 0,
};

describe('getPivaSettings', () => {
  it('mappa la riga esistente', async () => {
    const supabase = fakeSelectClient([row]);
    const result = await getPivaSettings(supabase);
    expect(result).toEqual(mapped);
  });

  it('ritorna null se non esiste ancora nessuna riga', async () => {
    const supabase = fakeSelectClient([]);
    const result = await getPivaSettings(supabase);
    expect(result).toBeNull();
  });
});

describe('createPivaSettings', () => {
  it('inserisce e ritorna la riga mappata', async () => {
    const supabase = fakeMutationClient(row);
    const result = await createPivaSettings(supabase, input);
    expect(result).toEqual(mapped);
  });
});

describe('updatePivaSettings', () => {
  it('aggiorna e ritorna la riga mappata', async () => {
    const supabase = fakeMutationClient(row);
    const result = await updatePivaSettings(supabase, '1', input);
    expect(result).toEqual(mapped);
  });
});
