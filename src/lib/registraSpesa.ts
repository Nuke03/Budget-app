import type { SupabaseClient } from '@supabase/supabase-js';
import { oggiRomaISO } from '@/lib/calculations/casa/oggi';
import type { TransactionTipo } from '@/lib/types';

export interface SpesaPayload {
  tipo: TransactionTipo;
  importo: number;
  categoriaId: string | null;
  accountId: string | null;
  goalId: string | null;
  descrizione: string;
  // Importo a occhio: la categoria arriva dopo.
  stima?: boolean;
}

// Dove va la spesa. In Casa, un conto personale vuol dire "pagata da te" (spesa anticipata).
export type SpazioSpesa =
  | { tipo: 'personale' }
  | { tipo: 'casa'; householdId: string; meUserId: string; contiPersonaliIds: string[] };

// La chiamata è partita ma la risposta non è tornata (rete caduta): il movimento può essere stato scritto.
export const MESSAGGIO_RISPOSTA_PERSA = 'Non so se è stato salvato. Controlla nello Storico prima di riprovare.';

export class RispostaPersaError extends Error {
  constructor() {
    super(MESSAGGIO_RISPOSTA_PERSA);
    this.name = 'RispostaPersaError';
  }
}

export function rispostaPersa(e: unknown): boolean {
  return e instanceof RispostaPersaError;
}

// Un errore di rete non ha codice Postgres (nemmeno quando la libreria lo restituisce invece di lanciarlo).
function erroreDiRete(e: unknown): boolean {
  if (e instanceof TypeError) return true;
  if (!e || typeof e !== 'object') return false;
  const { code, message } = e as { code?: unknown; message?: unknown };
  return !code && typeof message === 'string' && /fetch|network|failed to/i.test(message);
}

// Movimento e saldo del conto in una sola operazione (rpc crea_movimento): o riesce tutto o niente.
export async function registraMovimento(
  supabase: SupabaseClient,
  payload: SpesaPayload,
  spazio: SpazioSpesa,
  data: string = oggiRomaISO()
): Promise<string> {
  let pagataDa: string | null = null;
  if (spazio.tipo === 'casa') {
    const conPersonale =
      payload.tipo === 'expense' && !!payload.accountId && spazio.contiPersonaliIds.includes(payload.accountId);
    // Anticipata con la propria carta o in contanti: il credito verso la casa nasce dalla spesa.
    // Con i contanti non c'è un conto da scalare, ma chi ha pagato va registrato lo stesso.
    const contanti = payload.tipo === 'expense' && !payload.accountId;
    if (conPersonale || contanti) pagataDa = spazio.meUserId;
  }
  let risposta;
  try {
    risposta = await supabase.rpc('crea_movimento', {
      p_tipo: payload.tipo,
      p_importo: payload.importo,
      p_data: data,
      p_categoria: payload.categoriaId,
      p_account: payload.accountId,
      p_goal: payload.goalId,
      p_descrizione: payload.descrizione,
      p_nota: null,
      p_household: spazio.tipo === 'casa' ? spazio.householdId : null,
      p_pagata_da: pagataDa,
      p_stima: payload.stima ?? false,
    });
  } catch (e) {
    throw erroreDiRete(e) ? new RispostaPersaError() : e;
  }
  const { data: id, error } = risposta;
  if (error) throw erroreDiRete(error) ? new RispostaPersaError() : error;
  return id as string;
}
