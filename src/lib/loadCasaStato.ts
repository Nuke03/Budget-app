import type { SupabaseClient } from '@supabase/supabase-js';
import type { CasaCorrente } from '@/lib/data/households';
import { casa as scopeCasa } from '@/lib/data/scope';
import { getTransactions } from '@/lib/data/transactions';
import { getPlanVersions, type PlanBundle } from '@/lib/data/householdPlans';
import { getTransfers } from '@/lib/data/transfers';
import { getControlliRecenti } from '@/lib/data/balanceChecks';
import { calcolaRegistriCasa } from '@/lib/calculations/casa/registri';
import { oggiRomaISO, meseRomaISO } from '@/lib/calculations/casa/oggi';
import { riservaPersonale } from '@/lib/calculations/casa/riservoVersamento';
import type { DebitoMembro } from '@/lib/calculations/casa/debitiMembri';
import { pianoDelMese, type RigaMese } from '@/lib/calculations/casa/versamenti';
import type { HouseholdMember } from '@/lib/types';

export interface CasaStato {
  householdId: string;
  nomeCasa: string;
  me: HouseholdMember;
  membri: HouseholdMember[];
  // La versione in vigore nel mese, altrimenti la prima futura.
  piano: PlanBundle | null;
  // Le righe del chiamante.
  righe: RigaMese[];
  // Le righe di tutta la casa: il check-in è della casa, non di chi guarda.
  righeCasa?: RigaMese[];
  riservaVersamento: number;
  debiti: DebitoMembro[];
  debitoDaRestituire: number;
  crediti: Record<string, number>;
  avvisoArretrati: boolean;
  controlli: { ultimoControllo: string | null; ultimoCheckinMese: string | null };
}

const MESI_ARRETRATI_MASSIMI = 2;

// Quanto la casa pesa sul disponibile personale di chi guarda. I registri sono quelli di
// calcolaRegistriCasa, gli stessi della pagina Casa.
export async function loadCasaStato(
  supabase: SupabaseClient,
  casa: CasaCorrente,
  now: Date = new Date()
): Promise<CasaStato> {
  const scope = scopeCasa(casa.household.id);
  const [piani, trasferimenti, spese, controlli] = await Promise.all([
    getPlanVersions(supabase, casa.household.id),
    getTransfers(supabase, scope),
    getTransactions(supabase, scope),
    getControlliRecenti(supabase, casa.household.id),
  ]);
  const { righe: righePerMembro, crediti, debiti } = calcolaRegistriCasa({
    piani,
    trasferimenti,
    spese,
    membri: casa.members,
    oggi: oggiRomaISO(now),
  });
  const righe = righePerMembro[casa.me.userId] ?? [];
  const { riservaVersamento, riservaDebiti } = riservaPersonale({ righe, userId: casa.me.userId, debiti });
  return {
    householdId: casa.household.id,
    nomeCasa: casa.household.nome,
    me: casa.me,
    membri: casa.members,
    piano: pianoDelMese(piani, meseRomaISO(now)),
    righe,
    righeCasa: Object.values(righePerMembro).flat(),
    riservaVersamento,
    debiti,
    debitoDaRestituire: riservaDebiti,
    crediti,
    avvisoArretrati: righe.filter((r) => r.mancano > 0).length > MESI_ARRETRATI_MASSIMI,
    controlli,
  };
}
