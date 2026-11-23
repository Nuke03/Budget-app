import type { SupabaseClient } from '@supabase/supabase-js';
import type { Situazione, StatoVoce, VoceId } from '../agevolazioni/tipi';
import { getPivaSettings } from './pivaSettings';

interface SituazioneRow {
  isee: number | string | null;
  dsu_data: string | null;
  comune: string | null;
  in_affitto: boolean | null;
  studente: boolean | null;
}

interface StatoRow {
  voce_id: VoceId;
  stato: StatoVoce['stato'];
  il: string;
}

// Senza riga: null. La P.IVA non si salva qui: c'e se la guida e partita.
export async function getSituazione(supabase: SupabaseClient): Promise<Situazione | null> {
  const { data, error } = await supabase
    .from('agevolazioni_situazione')
    .select('isee, dsu_data, comune, in_affitto, studente')
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as SituazioneRow;
  const settings = await getPivaSettings(supabase);
  return {
    isee: row.isee === null ? null : Number(row.isee),
    dsuData: row.dsu_data,
    comune: row.comune,
    inAffitto: row.in_affitto,
    studente: row.studente,
    piva: !!settings?.guidataDal,
  };
}

export async function getStatiVoci(supabase: SupabaseClient): Promise<StatoVoce[]> {
  const { data, error } = await supabase.from('agevolazioni_stati').select('voce_id, stato, il');
  if (error) throw error;
  return ((data ?? []) as StatoRow[]).map((r) => ({ voceId: r.voce_id, stato: r.stato, il: r.il }));
}

// Le scritture non validano: lo fanno le azioni. RLS e user_id di default (auth.uid()) fanno il resto.
export async function salvaSituazioneDati(
  supabase: SupabaseClient,
  input: Omit<Situazione, 'piva'>,
  adesso: string
): Promise<void> {
  const { error } = await supabase.from('agevolazioni_situazione').upsert(
    {
      isee: input.isee,
      dsu_data: input.dsuData,
      comune: input.comune,
      in_affitto: input.inAffitto,
      studente: input.studente,
      aggiornata_il: adesso,
    },
    { onConflict: 'user_id' }
  );
  if (error) throw error;
}

export async function segnaVoceDati(
  supabase: SupabaseClient,
  voceId: VoceId,
  stato: StatoVoce['stato'] | null,
  oggi: string
): Promise<void> {
  if (stato === null) {
    const { error } = await supabase.from('agevolazioni_stati').delete().eq('voce_id', voceId);
    if (error) throw error;
    return;
  }
  const { error } = await supabase
    .from('agevolazioni_stati')
    .upsert({ voce_id: voceId, stato, il: oggi }, { onConflict: 'user_id,voce_id' });
  if (error) throw error;
}

// Solo questa colonna: le altre della riga restano com'erano.
export async function segnaSezioneApertaDati(supabase: SupabaseClient, oggi: string): Promise<void> {
  const { error } = await supabase
    .from('agevolazioni_situazione')
    .upsert({ sezione_aperta_il: oggi }, { onConflict: 'user_id' });
  if (error) throw error;
}
