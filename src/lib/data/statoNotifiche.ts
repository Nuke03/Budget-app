import type { SupabaseClient } from '@supabase/supabase-js';
import { leggiTutte } from './leggiTutte';
import { getPlanVersions } from './householdPlans';
import { getTransfers } from './transfers';
import { getSpeseAnticipateCasa } from './transactions';
import { getControlliRecenti } from './balanceChecks';
import { casa as scopeCasa } from './scope';
import { calcolaRegistriCasa } from '@/lib/calculations/casa/registri';
import { meseRomaISO, oggiRomaISO } from '@/lib/calculations/casa/oggi';
import { meseDaControllare } from '@/lib/calculations/casa/checkin';
import { pianoDelMese } from '@/lib/calculations/casa/versamenti';
import { chiGestisce } from '@/lib/calculations/supporto/gestore';
import type { StatoPersona } from '@/lib/calculations/supporto/notifiche';
import type { Household, HouseholdMember } from '@/lib/types';

// Lato server, con il client `service_role` passato da fuori: questo modulo non crea client e non
// legge nessuna chiave. Le colonne lette sono solo quelle che servono a decidere la notifica.
export interface IscrizionePush {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}
export interface PersonaDaAvvisare {
  stato: StatoPersona;
  iscrizioni: IscrizionePush[];
}

interface RigaIscrizione extends IscrizionePush {
  user_id: string;
}
interface RigaPromemoria {
  user_id: string;
  notifiche_attive: boolean | null;
  ultima_spese_il: string | null;
  ultima_checkin_il: string | null;
  ultimo_versamento_mese: string | null;
  nessuna_spesa_fino_al: string | null;
  ultima_notifica_il: string | null;
}
interface RigaMembro {
  household_id: string;
  user_id: string;
  display_name: string;
  joined_at: string;
  slot: number;
  attivo: boolean;
}
interface RigaCasa {
  id: string;
  nome: string;
  created_at: string;
  archiviata_il: string | null;
  created_by: string;
}

type DatiCasa = Pick<StatoPersona, 'gestisce' | 'checkinDaFare' | 'versamento'>;
const SENZA_CASA: DatiCasa = { gestisce: false, checkinDaFare: null, versamento: null };

const COLONNE_MEMBRO = 'household_id, user_id, display_name, joined_at, slot, attivo';

// `.in()` finisce nell'indirizzo della richiesta: a blocchi, perché non diventi troppo lungo.
const PER_BLOCCO = 100;
function blocchi(ids: string[]): string[][] {
  const out: string[][] = [];
  for (let i = 0; i < ids.length; i += PER_BLOCCO) out.push(ids.slice(i, i + PER_BLOCCO));
  return out;
}
async function aBlocchi<T>(ids: string[], leggi: (blocco: string[]) => PromiseLike<T[]>): Promise<T[]> {
  const out: T[] = [];
  for (const b of blocchi(ids)) out.push(...(await leggi(b)));
  return out;
}

async function datiDellaCasa(
  admin: SupabaseClient,
  household: Household,
  membri: HouseholdMember[],
  oggi: string,
): Promise<Map<string, DatiCasa>> {
  const [piani, trasferimenti, spese, controlli] = await Promise.all([
    getPlanVersions(admin, household.id),
    getTransfers(admin, scopeCasa(household.id)),
    getSpeseAnticipateCasa(admin, household.id),
    getControlliRecenti(admin, household.id),
  ]);
  const { righe } = calcolaRegistriCasa({ piani, trasferimenti, spese, membri, oggi });
  const mese = meseRomaISO(new Date(`${oggi}T12:00:00Z`));
  const piano = pianoDelMese(piani, mese);
  const gestore = chiGestisce(household, membri);
  const daControllare = meseDaControllare({
    oggi,
    righe: Object.values(righe).flat(),
    ultimoCheckinMese: controlli.ultimoCheckinMese,
  });

  const out = new Map<string, DatiCasa>();
  for (const m of membri) {
    const riga = (righe[m.userId] ?? []).find((r) => r.mese === mese);
    const gestisce = gestore === m.userId;
    out.set(m.userId, {
      gestisce,
      checkinDaFare: gestisce ? daControllare : null,
      versamento:
        piano && riga && riga.atteso > 0
          ? { giorno: piano.plan.giornoVersamento, importo: riga.atteso, versato: riga.versato, mese }
          : null,
    });
  }
  return out;
}

// Per ogni persona con almeno un dispositivo iscritto: lo stato che serve a decidiNotifica e le sue
// iscrizioni. Delle transazioni si legge solo quando sono state create, mai importi o descrizioni.
export async function leggiStatiPersone(admin: SupabaseClient, oggi: string): Promise<PersonaDaAvvisare[]> {
  const righeIscrizioni = await leggiTutte<RigaIscrizione>((da, a) =>
    admin
      .from('push_iscrizioni')
      .select('id, user_id, endpoint, p256dh, auth')
      .order('id', { ascending: true })
      .range(da, a),
  );
  const perUtente = new Map<string, IscrizionePush[]>();
  for (const r of righeIscrizioni) {
    const lista = perUtente.get(r.user_id) ?? [];
    lista.push({ id: r.id, endpoint: r.endpoint, p256dh: r.p256dh, auth: r.auth });
    perUtente.set(r.user_id, lista);
  }
  const utenti = [...perUtente.keys()];
  if (utenti.length === 0) return [];

  const righePromemoria = await aBlocchi(utenti, async (blocco) => {
    const { data, error } = await admin
      .from('promemoria_utente')
      .select(
        'user_id, notifiche_attive, ultima_spese_il, ultima_checkin_il, ultimo_versamento_mese, nessuna_spesa_fino_al, ultima_notifica_il',
      )
      .in('user_id', blocco);
    if (error) throw error;
    return (data ?? []) as RigaPromemoria[];
  });
  const promemoria = new Map(righePromemoria.map((r) => [r.user_id, r]));

  const ultimaCreazione = new Map<string, string>();
  for (const blocco of blocchi(utenti)) {
    const tx = await leggiTutte<{ user_id: string; created_at: string }>((da, a) =>
      admin
        .from('transactions')
        .select('user_id, created_at')
        .in('user_id', blocco)
        .order('created_at', { ascending: false })
        .order('id', { ascending: true })
        .range(da, a),
    );
    for (const t of tx) {
      const prima = ultimaCreazione.get(t.user_id);
      if (!prima || Date.parse(t.created_at) > Date.parse(prima)) ultimaCreazione.set(t.user_id, t.created_at);
    }
  }

  // Le case attive degli iscritti, con tutti i loro membri attivi (serve a sapere chi gestisce).
  const datiPerUtente = new Map<string, DatiCasa>();
  const mieiMembri = await aBlocchi(utenti, async (blocco) => {
    const { data, error } = await admin
      .from('household_members')
      .select(COLONNE_MEMBRO)
      .in('user_id', blocco)
      .eq('attivo', true);
    if (error) throw error;
    return (data ?? []) as RigaMembro[];
  });
  const idCase = [...new Set(mieiMembri.map((m) => m.household_id))];
  if (idCase.length > 0) {
    const righeCase = await aBlocchi(idCase, async (blocco) => {
      const { data, error } = await admin
        .from('households')
        .select('id, nome, created_at, archiviata_il, created_by')
        .in('id', blocco)
        .is('archiviata_il', null);
      if (error) throw error;
      return (data ?? []) as RigaCasa[];
    });
    const righeMembri = await aBlocchi(
      righeCase.map((c) => c.id),
      async (blocco) => {
        const { data, error } = await admin
          .from('household_members')
          .select(COLONNE_MEMBRO)
          .in('household_id', blocco)
          .eq('attivo', true);
        if (error) throw error;
        return (data ?? []) as RigaMembro[];
      },
    );
    for (const c of righeCase) {
      const household: Household = {
        id: c.id,
        nome: c.nome,
        createdAt: c.created_at,
        archiviataIl: c.archiviata_il,
        createdBy: c.created_by,
      };
      const membri: HouseholdMember[] = righeMembri
        .filter((m) => m.household_id === c.id)
        .map((m) => ({
          householdId: m.household_id,
          userId: m.user_id,
          displayName: m.display_name,
          joinedAt: m.joined_at,
          slot: m.slot,
          attivo: m.attivo,
        }));
      try {
        for (const [userId, dati] of await datiDellaCasa(admin, household, membri, oggi)) {
          if (perUtente.has(userId) && !datiPerUtente.has(userId)) datiPerUtente.set(userId, dati);
        }
      } catch (e) {
        // Una casa che non si legge non toglie i promemoria delle spese a chi ci abita.
        console.error('promemoria: casa non letta', household.id, e instanceof Error ? e.message : e);
      }
    }
  }

  return utenti.map((userId) => {
    const p = promemoria.get(userId);
    const creata = ultimaCreazione.get(userId);
    return {
      stato: {
        userId,
        iscritta: true,
        notificheAttive: p?.notifiche_attive ?? null,
        ultimaCreazione: creata ? oggiRomaISO(new Date(creata)) : null,
        ultimaSpeseIl: p?.ultima_spese_il ?? null,
        ultimaCheckinIl: p?.ultima_checkin_il ?? null,
        ultimoVersamentoMese: p?.ultimo_versamento_mese ?? null,
        ultimaNotificaIl: p?.ultima_notifica_il ?? null,
        nessunaSpesaFinoAl: p?.nessuna_spesa_fino_al ?? null,
        ...(datiPerUtente.get(userId) ?? SENZA_CASA),
      },
      iscrizioni: perUtente.get(userId) ?? [],
    };
  });
}
