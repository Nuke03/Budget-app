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
  conto_tasse_id: null,
  preset: null,
  guidata_dal: null,
  stipendio_mensile: null,
  stipendio_rivisto_il: null,
  incasso_mese_magro: null,
  categoria_dal: null,
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
  contoTasseId: null,
  preset: null,
  guidataDal: null,
  stipendioMensile: null,
  stipendioRivistoIl: null,
  incassoMeseMagro: null,
  categoriaDal: null,
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
  contoTasseId: null,
  preset: null,
  guidataDal: null,
  stipendioMensile: null,
  stipendioRivistoIl: null,
  incassoMeseMagro: null,
  categoriaDal: null,
};

describe('getPivaSettings', () => {
  it('getPivaSettings legge e mappa le colonne nuove', async () => {
    const supabase = fakeSelectClient([
      {
        ...row,
        conto_tasse_id: 'vaso',
        preset: 'enpap',
        guidata_dal: '2026-11-17',
        stipendio_mensile: 1500,
        stipendio_rivisto_il: '2026-11-01',
        incasso_mese_magro: 300,
      },
    ]);
    const result = await getPivaSettings(supabase);
    expect(result).toMatchObject({
      contoTasseId: 'vaso',
      preset: 'enpap',
      guidataDal: '2026-11-17',
      stipendioMensile: 1500,
      stipendioRivistoIl: '2026-11-01',
      incassoMeseMagro: 300,
    });
  });

  it('P5: legge categoria_dal', async () => {
    const supabase = fakeSelectClient([{ ...row, categoria_dal: '2026-11-19' }]);
    expect((await getPivaSettings(supabase))?.categoriaDal).toBe('2026-11-19');
  });

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
