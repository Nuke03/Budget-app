import type { SupabaseClient } from '@supabase/supabase-js';
import type { Checkin, EsitoCheckin } from '../types';

const ERRORE_GENERICO = 'Salvataggio fallito, controlla la connessione e riprova.';
const GIA_FATTO = 'Il check-in di questo mese è già stato fatto.';

const CHECKIN_COLUMNS =
  'id, household_id, mese, user_id, created_at, atteso_totale, versato_totale, previsto_mensili, speso_mensili, non_registrate, avanzo, esito, destinazione_avanzo, goal_id';

interface CheckinRow {
  id: string;
  household_id: string;
  mese: string;
  user_id: string;
  created_at: string;
  atteso_totale: number;
  versato_totale: number;
  previsto_mensili: number;
  speso_mensili: number;
  non_registrate: number;
  avanzo: number;
  esito: EsitoCheckin;
  destinazione_avanzo: 'cuscinetto' | 'da_parte' | null;
  goal_id: string | null;
}

function mapRow(row: CheckinRow): Checkin {
  return {
    id: row.id,
    householdId: row.household_id,
    mese: row.mese,
    userId: row.user_id,
    createdAt: row.created_at,
    attesoTotale: Number(row.atteso_totale),
    versatoTotale: Number(row.versato_totale),
    previstoMensili: Number(row.previsto_mensili),
    spesoMensili: Number(row.speso_mensili),
    nonRegistrate: Number(row.non_registrate),
    avanzo: Number(row.avanzo),
    esito: row.esito,
    destinazioneAvanzo: row.destinazione_avanzo,
    goalId: row.goal_id,
  };
}

export interface SaveCheckinInput {
  householdId: string;
  mese: string;
  attesoTotale: number;
  versatoTotale: number;
  previstoMensili: number;
  spesoMensili: number;
  nonRegistrate: number;
  avanzo: number;
  destinazione?: 'cuscinetto' | 'da_parte' | null;
  goalId?: string | null;
  nuovaCosa?: string | null;
}

export class CheckinGiaFattoError extends Error {
  constructor() {
    super('check-in gia fatto');
    this.name = 'CheckinGiaFattoError';
  }
}

function testoErrore(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === 'object' && e !== null && 'message' in e) return String(e.message);
  return '';
}

// Il check-in di un solo mese: una lettura per casa e mese.
export async function getCheckin(supabase: SupabaseClient, householdId: string, mese: string): Promise<Checkin | null> {
  // household: per id
  const { data, error } = await supabase
    .from('household_checkins')
    .select(CHECKIN_COLUMNS)
    .eq('household_id', householdId)
    .eq('mese', mese)
    .limit(1);
  if (error) throw error;
  const riga = (data as CheckinRow[] | null)?.[0];
  return riga ? mapRow(riga) : null;
}

// Salva il check-in e, se scelto, mette l'avanzo da parte: una sola operazione sul server.
// Restituisce l'id del check-in.
export async function saveCheckin(supabase: SupabaseClient, input: SaveCheckinInput): Promise<string> {
  const { data, error } = await supabase.rpc('save_household_checkin', {
    p_household: input.householdId,
    p_mese: input.mese,
    p_atteso_totale: input.attesoTotale,
    p_versato_totale: input.versatoTotale,
    p_previsto_mensili: input.previstoMensili,
    p_speso_mensili: input.spesoMensili,
    p_non_registrate: input.nonRegistrate,
    p_avanzo: input.avanzo,
    p_destinazione: input.destinazione ?? null,
    p_goal_id: input.goalId ?? null,
    p_nuova_cosa: input.nuovaCosa ?? null,
  });
  if (error) {
    if (testoErrore(error).includes('check-in gia fatto')) throw new CheckinGiaFattoError();
    throw error;
  }
  return data as string;
}

// Traduce gli errori di save_household_checkin in frasi per chi usa la pagina.
export function messaggioErroreCheckin(e: unknown): string {
  const testo = testoErrore(e);
  if (e instanceof CheckinGiaFattoError || testo.includes('check-in gia fatto')) return GIA_FATTO;
  if (testo.includes('avanzo non valido')) return 'Il calcolo del mese non è valido: riapri la pagina e riprova.';
  if (testo.includes('obiettivo mancante')) return "Scegli a cosa destinare l'avanzo.";
  if (testo.includes('obiettivo non valido')) return "Quella voce non è più disponibile: scegline un'altra.";
  if (testo.includes('casa non scrivibile')) return 'Non puoi modificare questa casa.';
  if (testo.includes('mese non valido')) return 'Quel mese non è valido per il check-in.';
  if (testo.includes('destinazione non valida')) return "Quella destinazione non va bene per l'avanzo di questo mese.";
  if (testo.includes('mese non ancora chiuso')) return 'Il check-in si fa a mese finito.';
  return ERRORE_GENERICO;
}
