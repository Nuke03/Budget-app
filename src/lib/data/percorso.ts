import type { SupabaseClient } from '@supabase/supabase-js';
import type { ArgomentoId, PercorsoUtente, StatiLezioni, StatoLezione, VoceAttesa } from '../percorso/tipi';
import { GIORNI_ATTESA } from '../calculations/percorso/soglie';

interface UtenteRow {
  entrate_tipo: PercorsoUtente['entrateTipo'];
  entrata_attesa: number | null;
  entrata_attesa_il: string | null;
  reddito_base: number | null;
  settimana_dal: string | null;
  settimana_fatta_il: string | null;
  spese_certe_nessuna: boolean;
  obiettivo_piu_avanti: boolean;
  nascosti: boolean;
  ultima_proposta_il: string | null;
}

interface LezioneRow {
  lezione: ArgomentoId;
  vista_il: string | null;
  rimandata_al: string | null;
  azione_il: string | null;
  proposta_il: string | null;
}

interface AttesaRow {
  id: string;
  nome: string;
  importo: number;
  aggiunto_il: string;
  rivedi_il: string;
  stato: VoceAttesa['stato'];
}

const UTENTE_COLUMNS =
  'entrate_tipo, entrata_attesa, entrata_attesa_il, reddito_base, settimana_dal, settimana_fatta_il, spese_certe_nessuna, obiettivo_piu_avanti, nascosti, ultima_proposta_il';
const LEZIONE_COLUMNS = 'lezione, vista_il, rimandata_al, azione_il, proposta_il';
const ATTESA_COLUMNS = 'id, nome, importo, aggiunto_il, rivedi_il, stato';

const COLONNE_UTENTE: Record<keyof PercorsoUtente, string> = {
  entrateTipo: 'entrate_tipo',
  entrataAttesa: 'entrata_attesa',
  entrataAttesaIl: 'entrata_attesa_il',
  redditoBase: 'reddito_base',
  settimanaDal: 'settimana_dal',
  settimanaFattaIl: 'settimana_fatta_il',
  speseCerteNessuna: 'spese_certe_nessuna',
  obiettivoPiuAvanti: 'obiettivo_piu_avanti',
  nascosti: 'nascosti',
  ultimaPropostaIl: 'ultima_proposta_il',
};

const COLONNE_LEZIONE: Record<keyof StatoLezione, string> = {
  vistaIl: 'vista_il',
  rimandataAl: 'rimandata_al',
  azioneIl: 'azione_il',
  propostaIl: 'proposta_il',
};

function mapUtente(r: UtenteRow): PercorsoUtente {
  return {
    entrateTipo: r.entrate_tipo,
    entrataAttesa: r.entrata_attesa,
    entrataAttesaIl: r.entrata_attesa_il,
    redditoBase: r.reddito_base,
    settimanaDal: r.settimana_dal,
    settimanaFattaIl: r.settimana_fatta_il,
    speseCerteNessuna: r.spese_certe_nessuna,
    obiettivoPiuAvanti: r.obiettivo_piu_avanti,
    nascosti: r.nascosti,
    ultimaPropostaIl: r.ultima_proposta_il,
  };
}

function mapAttesa(r: AttesaRow): VoceAttesa {
  return { id: r.id, nome: r.nome, importo: r.importo, aggiuntoIl: r.aggiunto_il, rivediIl: r.rivedi_il, stato: r.stato };
}

// Solo i campi passati: le chiavi assenti non finiscono nella scrittura.
function colonneDa(campi: object, mappa: Record<string, string>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [chiave, colonna] of Object.entries(mappa)) {
    const v = (campi as Record<string, unknown>)[chiave];
    if (v !== undefined) out[colonna] = v;
  }
  return out;
}

// RLS: solo le righe dell'utente. Senza righe: utente null, nessuna lezione.
export async function leggiPercorso(
  supabase: SupabaseClient
): Promise<{ utente: PercorsoUtente | null; lezioni: StatiLezioni }> {
  const [u, l] = await Promise.all([
    supabase.from('percorso_utente').select(UTENTE_COLUMNS).maybeSingle(),
    supabase.from('percorso_lezioni').select(LEZIONE_COLUMNS),
  ]);
  if (u.error) throw u.error;
  if (l.error) throw l.error;
  const lezioni: StatiLezioni = {};
  for (const r of (l.data ?? []) as LezioneRow[]) {
    lezioni[r.lezione] = {
      vistaIl: r.vista_il,
      rimandataAl: r.rimandata_al,
      azioneIl: r.azione_il,
      propostaIl: r.proposta_il,
    };
  }
  return { utente: u.data ? mapUtente(u.data as UtenteRow) : null, lezioni };
}

// user_id è quello della sessione (default del database).
export async function salvaPercorso(supabase: SupabaseClient, campi: Partial<PercorsoUtente>): Promise<void> {
  const { error } = await supabase
    .from('percorso_utente')
    .upsert(colonneDa(campi, COLONNE_UTENTE), { onConflict: 'user_id' });
  if (error) throw error;
}

export async function segnaLezione(
  supabase: SupabaseClient,
  id: ArgomentoId,
  campi: Partial<StatoLezione>
): Promise<void> {
  const { error } = await supabase
    .from('percorso_lezioni')
    .upsert({ lezione: id, ...colonneDa(campi, COLONNE_LEZIONE) }, { onConflict: 'user_id,lezione' });
  if (error) throw error;
}

// La lezione è stata proposta oggi: si ricorda sulla lezione e sull'utente.
export async function segnaProposta(supabase: SupabaseClient, id: ArgomentoId, oggi: string): Promise<void> {
  await segnaLezione(supabase, id, { propostaIl: oggi });
  await salvaPercorso(supabase, { ultimaPropostaIl: oggi });
}

export async function rispostaAvviso(
  supabase: SupabaseClient,
  transactionId: string,
  risposta: 'imprevisto' | 'normale' | 'visto'
): Promise<void> {
  const { error } = await supabase
    .from('percorso_avvisi')
    .upsert({ transaction_id: transactionId, risposta }, { onConflict: 'transaction_id' });
  if (error) throw error;
}

export async function avvisoGiaDato(supabase: SupabaseClient, transactionId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('percorso_avvisi')
    .select('transaction_id')
    .eq('transaction_id', transactionId)
    .maybeSingle();
  if (error) throw error;
  return data != null;
}

export async function leggiListaAttesa(supabase: SupabaseClient): Promise<VoceAttesa[]> {
  const { data, error } = await supabase
    .from('lista_attesa')
    .select(ATTESA_COLUMNS)
    .order('rivedi_il', { ascending: true });
  if (error) throw error;
  return ((data ?? []) as AttesaRow[]).map(mapAttesa);
}

// Giorni di calendario in UTC: nessun salto per l'ora legale.
export function piuGiorni(giorno: string, n: number): string {
  const d = new Date(`${giorno}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export async function aggiungiAttesa(
  supabase: SupabaseClient,
  nome: string,
  importo: number,
  oggi: string
): Promise<VoceAttesa> {
  const { data, error } = await supabase
    .from('lista_attesa')
    .insert({ nome, importo, aggiunto_il: oggi, rivedi_il: piuGiorni(oggi, GIORNI_ATTESA) })
    .select(ATTESA_COLUMNS)
    .single();
  if (error) throw error;
  return mapAttesa(data as AttesaRow);
}

export async function decidiAttesa(
  supabase: SupabaseClient,
  id: string,
  stato: 'voluto' | 'non_piu'
): Promise<void> {
  const { error } = await supabase.from('lista_attesa').update({ stato }).eq('id', id);
  if (error) throw error;
}

// Solo goal_id: il resto del movimento non cambia.
export async function collegaAObiettivo(
  supabase: SupabaseClient,
  transactionId: string,
  goalId: string
): Promise<void> {
  // household: per id
  const { error } = await supabase.from('transactions').update({ goal_id: goalId }).eq('id', transactionId);
  if (error) throw error;
}

export async function ricominciaDaZero(supabase: SupabaseClient): Promise<void> {
  const { error } = await supabase.rpc('ricomincia_da_zero');
  if (error) throw error;
}

export async function creaCategorieIniziali(supabase: SupabaseClient): Promise<number> {
  const { data, error } = await supabase.rpc('crea_categorie_iniziali');
  if (error) throw error;
  return (data as number) ?? 0;
}
