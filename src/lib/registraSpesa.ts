import type { SupabaseClient } from '@supabase/supabase-js';
import { format } from 'date-fns';
import { createTransaction } from '@/lib/data/transactions';
import { adjustAccountBalance } from '@/lib/data/accounts';
import { casa as scopeCasa } from '@/lib/data/scope';
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

// La riga creata e il suo payload: serve a ripetere solo il saldo se il secondo passo fallisce.
export interface SpesaCreata {
  id: string | null;
  payload: SpesaPayload;
}

// Primo passo: crea solo la riga. Il saldo si aggiorna dopo, in un passo a parte che si può ripetere.
export async function creaSpesa(
  supabase: SupabaseClient,
  payload: SpesaPayload,
  spazio: SpazioSpesa
): Promise<SpesaCreata> {
  if (spazio.tipo === 'personale') {
    const creata = await createTransaction(supabase, {
      ...payload,
      data: format(new Date(), 'yyyy-MM-dd'),
      nota: null,
    });
    return { id: creata?.id ?? null, payload };
  }
  const conPersonale =
    payload.tipo === 'expense' && !!payload.accountId && spazio.contiPersonaliIds.includes(payload.accountId);
  // Anticipata con la propria carta: il credito verso la casa nasce dalla spesa, il saldo scalato è quello personale.
  const creata = await createTransaction(
    supabase,
    {
      ...payload,
      data: oggiRomaISO(),
      nota: null,
      ...(conPersonale ? { pagataDaUserId: spazio.meUserId } : {}),
    },
    scopeCasa(spazio.householdId)
  );
  return { id: creata?.id ?? null, payload };
}

// Secondo passo. Per differenza: il saldo può essere cambiato altrove (casa, rimborsi) dopo che la pagina l'ha letto.
export async function aggiornaSaldoSpesa(supabase: SupabaseClient, payload: SpesaPayload): Promise<void> {
  if (!payload.accountId) return;
  await adjustAccountBalance(supabase, payload.accountId, payload.tipo === 'income' ? payload.importo : -payload.importo);
}
