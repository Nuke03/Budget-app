import type { SupabaseClient } from '@supabase/supabase-js';
import type { CasaCorrente } from '@/lib/data/households';
import { getCheckin } from '@/lib/data/checkins';
import { loadCasaData, type CasaData } from '@/lib/loadCasaData';
import { computeCheckin, meseDaControllare, mesePrecedente, type CheckinCalcolato } from '@/lib/calculations/casa/checkin';
import { riferimentoControllo } from '@/lib/calculations/casa/controlloSaldo';
import { meseRomaISO, oggiRomaISO } from '@/lib/calculations/casa/oggi';
import { pianoInVigore } from '@/lib/calculations/casa/versamenti';
import type { Account, BudgetGoal, Checkin } from '@/lib/types';

// Dopo più di questi giorni dall'ultimo controllo del saldo, il check-in lo propone prima.
const GIORNI_CONTROLLO = 14;

export interface CheckinCaricato {
  stato: 'nessun_mese' | 'da_fare' | 'fatto';
  householdId: string;
  mese: string | null;
  calcolo: CheckinCalcolato | null;
  fatto: Checkin | null;
  chi: string | null;
  cuscinetto: CasaData['cuscinetto'];
  conti: Account[];
  fondiPerAvanzo: BudgetGoal[];
  nomi: Record<string, string>;
  // Quanto ha versato ciascuno nel mese da controllare.
  versamenti: { userId: string; nome: string; atteso: number; versato: number }[];
  // Il passo del controllo del saldo si propone solo se l'ultimo ha più di 14 giorni.
  serveControllo: boolean;
}

// Giorni di calendario fra due date YYYY-MM-DD.
function giorniTra(da: string, a: string): number {
  return (Date.parse(`${a}T00:00:00Z`) - Date.parse(`${da}T00:00:00Z`)) / 86_400_000;
}

export async function loadCheckin(
  supabase: SupabaseClient,
  casa: CasaCorrente,
  now: Date = new Date()
): Promise<CheckinCaricato> {
  // Una sola lettura dell'insieme della casa: il check-in non ne fa di proprie.
  const dati = await loadCasaData(supabase, casa, now);
  const householdId = casa.household.id;
  const nomi = Object.fromEntries(dati.aggiunta.nomi.map((n) => [n.userId, n.nome]));
  const conti = dati.aggiunta.conti;
  const oggi = oggiRomaISO(now);
  const ultimoChiuso = mesePrecedente(meseRomaISO(now));

  const da = dati.controlli.ultimoControllo ?? riferimentoControllo(casa.me.joinedAt, conti);
  const serveControllo = conti.length > 0 && giorniTra(da, oggi) > GIORNI_CONTROLLO;

  const vuoto: CheckinCaricato = {
    stato: 'nessun_mese',
    householdId,
    mese: null,
    calcolo: null,
    fatto: null,
    chi: null,
    cuscinetto: dati.cuscinetto,
    conti,
    fondiPerAvanzo: [],
    nomi,
    versamenti: [],
    serveControllo,
  };

  // Il check-in è della casa: basta che un membro abbia la riga del mese (chi è entrato dopo non l'ha).
  const righeCasa = Object.values(dati.righe).flat();
  const mese = meseDaControllare({
    oggi,
    righe: righeCasa,
    ultimoCheckinMese: dati.controlli.ultimoCheckinMese,
  });
  if (mese === null) {
    const haRiga = righeCasa.some((r) => r.mese === ultimoChiuso);
    const fatto = haRiga ? await getCheckin(supabase, householdId, ultimoChiuso) : null;
    if (!fatto) return vuoto;
    return { ...vuoto, stato: 'fatto', mese: ultimoChiuso, fatto, chi: nomi[fatto.userId] ?? null };
  }

  const piano = pianoInVigore(dati.piani, mese);
  const calcola = (precedente: { esito: Checkin['esito'] } | null) =>
    computeCheckin({
      mese: mese,
      righePerMembro: dati.righe,
      piano,
      spese: dati.transazioni,
      precedente,
    });
  let calcolo = calcola(null);
  // Il mese prima serve solo per il secondo ammanco.
  if (calcolo.esito === 'ammanco') {
    calcolo = calcola(await getCheckin(supabase, householdId, mesePrecedente(mese)));
  }

  const versamenti = casa.members
    .map((m) => {
      const riga = dati.righe[m.userId]?.find((r) => r.mese === mese);
      return riga ? { userId: m.userId, nome: m.displayName, atteso: riga.atteso, versato: riga.versato } : null;
    })
    .filter((v): v is NonNullable<typeof v> => v !== null);

  return {
    ...vuoto,
    stato: 'da_fare',
    mese,
    calcolo,
    fondiPerAvanzo: dati.aggiunta.obiettivi.filter((g) => g.modalita === 'bloccato' && !g.ricorrente),
    versamenti,
  };
}
