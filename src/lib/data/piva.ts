import type { SupabaseClient } from '@supabase/supabase-js';
import type { ChiaveScadenza, PivaAccantonamento, PivaFattura, PivaScadenza } from '../types';

interface FatturaRow {
  id: string;
  cliente: string;
  importo: number;
  data_emissione: string;
  data_incasso: string | null;
  transaction_id: string | null;
  nota: string | null;
}

interface AccantonamentoRow {
  id: string;
  transaction_id: string | null;
  importo: number;
  data: string;
  da_account_id: string | null;
  a_account_id: string | null;
}

interface ScadenzaRow {
  id: string;
  anno: number;
  chiave: ChiaveScadenza;
  tipo: 'f24' | 'cassa';
  descrizione: string;
  data: string;
  importo: number | null;
  pagata_il: string | null;
  transaction_id: string | null;
  nascosta: boolean;
}

const COLONNE_FATTURE = 'id, cliente, importo, data_emissione, data_incasso, transaction_id, nota';
const COLONNE_ACCANTONAMENTI = 'id, transaction_id, importo, data, da_account_id, a_account_id';
const COLONNE_SCADENZE = 'id, anno, chiave, tipo, descrizione, data, importo, pagata_il, transaction_id, nascosta';

const mapFattura = (r: FatturaRow): PivaFattura => ({
  id: r.id,
  cliente: r.cliente,
  importo: Number(r.importo),
  dataEmissione: r.data_emissione,
  dataIncasso: r.data_incasso,
  transactionId: r.transaction_id,
  nota: r.nota,
});

const mapAccantonamento = (r: AccantonamentoRow): PivaAccantonamento => ({
  id: r.id,
  transactionId: r.transaction_id,
  importo: Number(r.importo),
  data: r.data,
  daAccountId: r.da_account_id,
  aAccountId: r.a_account_id,
});

const mapScadenza = (r: ScadenzaRow): PivaScadenza => ({
  id: r.id,
  anno: r.anno,
  chiave: r.chiave,
  tipo: r.tipo,
  descrizione: r.descrizione,
  data: r.data,
  importo: r.importo === null ? null : Number(r.importo),
  pagataIl: r.pagata_il,
  transactionId: r.transaction_id,
  nascosta: r.nascosta,
});

function messaggio(error: unknown): string {
  return String((error as { message?: unknown } | null)?.message ?? '');
}

// ---- Fatture ----

export async function getFatture(supabase: SupabaseClient): Promise<PivaFattura[]> {
  const { data, error } = await supabase
    .from('piva_fatture')
    .select(COLONNE_FATTURE)
    .order('data_emissione', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as FatturaRow[]).map(mapFattura);
}

export async function creaFattura(
  supabase: SupabaseClient,
  input: {
    cliente: string;
    importo: number;
    dataEmissione: string;
    nota: string | null;
    incassaSu?: { accountId: string; categoriaId: string | null };
  }
): Promise<string> {
  const { data, error } = await supabase.rpc('crea_fattura', {
    p_cliente: input.cliente,
    p_importo: input.importo,
    p_data_emissione: input.dataEmissione,
    p_nota: input.nota,
    p_incassa_account: input.incassaSu?.accountId ?? null,
    p_categoria: input.incassaSu?.categoriaId ?? null,
  });
  if (error) throw error;
  return data as string;
}

// Se la fattura è già incassata (doppio tocco, due schede) non è un errore: torna il movimento che c'è.
export async function incassaFattura(
  supabase: SupabaseClient,
  id: string,
  input: { data: string; accountId: string; categoriaId: string | null }
): Promise<string> {
  const { data, error } = await supabase.rpc('incassa_fattura', {
    p_fattura: id,
    p_data: input.data,
    p_account: input.accountId,
    p_categoria: input.categoriaId,
  });
  if (error) {
    if (!messaggio(error).includes('già incassata')) throw error;
    const { data: riga, error: e2 } = await supabase
      .from('piva_fatture')
      .select('transaction_id')
      .eq('id', id)
      .maybeSingle();
    if (e2) throw e2;
    const esistente = (riga as { transaction_id: string | null } | null)?.transaction_id;
    if (!esistente) throw error;
    return esistente;
  }
  return data as string;
}

// Solo una fattura non incassata si modifica: le altre hanno già un movimento e un saldo.
export async function updateFattura(
  supabase: SupabaseClient,
  id: string,
  input: { cliente: string; importo: number; dataEmissione: string; nota: string | null }
): Promise<void> {
  const { error } = await supabase
    .from('piva_fatture')
    .update({
      cliente: input.cliente,
      importo: input.importo,
      data_emissione: input.dataEmissione,
      nota: input.nota,
    })
    .eq('id', id)
    .is('data_incasso', null);
  if (error) throw error;
}

export async function deleteFattura(supabase: SupabaseClient, id: string): Promise<number> {
  const { error, count } = await supabase.from('piva_fatture').delete({ count: 'exact' }).eq('id', id);
  if (error) throw error;
  return count ?? 0;
}

// ---- Accantonamenti ----

export async function getAccantonamenti(
  supabase: SupabaseClient,
  { da }: { da: string }
): Promise<PivaAccantonamento[]> {
  const { data, error } = await supabase
    .from('piva_accantonamenti')
    .select(COLONNE_ACCANTONAMENTI)
    .gte('data', da)
    .order('data', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as AccantonamentoRow[]).map(mapAccantonamento);
}

export async function accantonaTasse(
  supabase: SupabaseClient,
  input: { importo: number; data: string; daAccountId: string; aAccountId: string; transactionId: string | null }
): Promise<string> {
  const { data, error } = await supabase.rpc('accantona_tasse', {
    p_importo: input.importo,
    p_data: input.data,
    p_da_account: input.daAccountId,
    p_a_account: input.aAccountId,
    p_transaction: input.transactionId,
  });
  if (error) {
    if (!messaggio(error).includes('già spostata') || !input.transactionId) throw error;
    const { data: riga, error: e2 } = await supabase
      .from('piva_accantonamenti')
      .select('id')
      .eq('transaction_id', input.transactionId)
      .maybeSingle();
    if (e2) throw e2;
    const esistente = (riga as { id: string } | null)?.id;
    if (!esistente) throw error;
    return esistente;
  }
  return data as string;
}

export async function annullaAccantonamento(supabase: SupabaseClient, id: string): Promise<number> {
  const { data, error } = await supabase.rpc('annulla_accantonamento', { p_id: id });
  if (error) throw error;
  return (data as number) ?? 0;
}

// ---- Scadenze ----

export async function getScadenze(supabase: SupabaseClient, anno: number): Promise<PivaScadenza[]> {
  const { data, error } = await supabase
    .from('piva_scadenze')
    .select(COLONNE_SCADENZE)
    .eq('anno', anno)
    .order('data', { ascending: true });
  if (error) throw error;
  return ((data ?? []) as ScadenzaRow[]).map(mapScadenza);
}

// Crea le scadenze che mancano. Quelle già presenti (anche modificate o pagate) non si toccano.
export async function assicuraScadenze(
  supabase: SupabaseClient,
  righe: Omit<PivaScadenza, 'id' | 'importo' | 'pagataIl' | 'transactionId' | 'nascosta'>[]
): Promise<void> {
  if (righe.length === 0) return;
  const { error } = await supabase.from('piva_scadenze').upsert(
    righe.map((r) => ({ anno: r.anno, chiave: r.chiave, tipo: r.tipo, descrizione: r.descrizione, data: r.data })),
    { onConflict: 'user_id,anno,chiave', ignoreDuplicates: true }
  );
  if (error) throw error;
}

export async function updateScadenza(
  supabase: SupabaseClient,
  id: string,
  input: { importo: number | null; data: string }
): Promise<void> {
  const { error } = await supabase
    .from('piva_scadenze')
    .update({ importo: input.importo, data: input.data })
    .eq('id', id);
  if (error) throw error;
}

export async function nascondiScadenza(supabase: SupabaseClient, id: string, nascosta: boolean): Promise<void> {
  const { error } = await supabase.from('piva_scadenze').update({ nascosta }).eq('id', id);
  if (error) throw error;
}

export async function pagaScadenza(
  supabase: SupabaseClient,
  id: string,
  input: { importo: number; data: string; accountId: string }
): Promise<string> {
  const { data, error } = await supabase.rpc('paga_scadenza', {
    p_scadenza: id,
    p_importo: input.importo,
    p_data: input.data,
    p_account: input.accountId,
  });
  if (error) {
    if (!messaggio(error).includes('già pagata')) throw error;
    const { data: riga, error: e2 } = await supabase
      .from('piva_scadenze')
      .select('transaction_id')
      .eq('id', id)
      .maybeSingle();
    if (e2) throw e2;
    const esistente = (riga as { transaction_id: string | null } | null)?.transaction_id;
    if (!esistente) throw error;
    return esistente;
  }
  return data as string;
}
