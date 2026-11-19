'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { utenteOLogin } from '@/lib/utenteOLogin';
import { createGoal, getOpenGoals } from '@/lib/data/goals';
import { leggiPercorso, salvaPercorso, segnaProposta } from '@/lib/data/percorso';
import { oggiRomaISO } from '@/lib/calculations/casa/oggi';
import { settimanaFinita } from '@/lib/calculations/percorso/passi';
import {
  fineDelMese,
  meseValido,
  scadenzaImprevisti,
} from '@/lib/calculations/percorso/primiPassiFondi';
import { SPESE_CERTE_PERSONALI } from '@/lib/percorso/speseCerte';
import { LEZIONI } from '@/lib/percorso/lezioni';
import type { ArgomentoId, PercorsoUtente } from '@/lib/percorso/tipi';

async function sessione() {
  const supabase = await createClient();
  await utenteOLogin(supabase);
  return supabase;
}

function aggiorna(): void {
  revalidatePath('/');
  revalidatePath('/impara');
  revalidatePath('/impara/primi-passi');
}

const importoValido = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0 && n < 1e9;
const dataValida = (d: unknown): d is string =>
  typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(`${d}T00:00:00Z`));

export interface EntrateInput {
  entrateTipo: 'fisse' | 'irregolari' | 'piva';
  entrataAttesa: number | null;
  entrataAttesaIl: string | null;
  redditoBase: number | null;
}

export async function salvaEntrate(input: EntrateInput): Promise<void> {
  if (!['fisse', 'irregolari', 'piva'].includes(input.entrateTipo)) throw new Error('Tipo di entrate non valido');
  if (input.entrataAttesa !== null && !importoValido(input.entrataAttesa)) throw new Error('Importo non valido');
  if (input.entrataAttesaIl !== null && !dataValida(input.entrataAttesaIl)) throw new Error('Data non valida');
  if (input.redditoBase !== null && !importoValido(input.redditoBase)) throw new Error('Reddito base non valido');
  const supabase = await sessione();
  const campi: Partial<PercorsoUtente> = {
    entrateTipo: input.entrateTipo,
    entrataAttesa: input.entrataAttesa,
    entrataAttesaIl: input.entrataAttesaIl,
    // Il reddito base serve solo a chi ha entrate irregolari.
    redditoBase: input.entrateTipo === 'fisse' ? null : input.redditoBase,
  };
  const { utente } = await leggiPercorso(supabase);
  // La settimana di prova parte dal primo passo salvato, se non è già partita.
  if (!utente?.settimanaDal) campi.settimanaDal = oggiRomaISO();
  await salvaPercorso(supabase, campi);
  aggiorna();
}

export async function avviaSettimana(): Promise<void> {
  const supabase = await sessione();
  await salvaPercorso(supabase, { settimanaDal: oggiRomaISO() });
  aggiorna();
}

// Senza spese la settimana riparte da oggi, senza segnarla come fatta.
export async function ripartiSettimana(): Promise<void> {
  await avviaSettimana();
}

export async function chiudiSettimana(): Promise<void> {
  const supabase = await sessione();
  const oggi = oggiRomaISO();
  const { utente } = await leggiPercorso(supabase);
  if (!settimanaFinita(utente, oggi)) throw new Error('La settimana non è ancora finita');
  await salvaPercorso(supabase, { settimanaFattaIl: oggi });
  aggiorna();
}

export interface VoceCertaInput {
  chiave: string;
  importo: number;
  // 'YYYY-MM': il mese della prossima scadenza.
  mese: string;
}

// Un fondo per ogni voce spuntata. Ritorna le chiavi create.
export async function creaFondiSpeseCerte(voci: VoceCertaInput[]): Promise<string[]> {
  if (!Array.isArray(voci) || voci.length === 0) throw new Error('Nessuna voce');
  const oggi = oggiRomaISO();
  const scelte = voci.map((v) => {
    const base = SPESE_CERTE_PERSONALI.find((s) => s.chiave === v.chiave);
    if (!base) throw new Error('Voce sconosciuta');
    if (!importoValido(v.importo)) throw new Error('Importo non valido');
    if (typeof v.mese !== 'string' || !meseValido(v.mese) || v.mese < oggi.slice(0, 7)) throw new Error('Mese non valido');
    return { base, importo: v.importo, scadenza: fineDelMese(v.mese) };
  });
  if (new Set(scelte.map((s) => s.base.chiave)).size !== scelte.length) throw new Error('Voce ripetuta');
  const supabase = await sessione();
  for (const s of scelte) {
    await createGoal(supabase, {
      nome: s.base.nome,
      importoTarget: s.importo,
      modalita: 'dilazionato',
      scadenza: s.scadenza,
      categoriaId: null,
      ricorrente: true,
      frequenzaMesi: s.base.frequenzaMesi,
      accantonaDa: oggi,
    });
  }
  aggiorna();
  return scelte.map((s) => s.base.chiave);
}

export async function nessunaSpesaCerta(): Promise<void> {
  const supabase = await sessione();
  await salvaPercorso(supabase, { speseCerteNessuna: true });
  aggiorna();
}

// Un solo cuscinetto aperto per utente: se c'è già, non se ne crea un secondo.
export async function creaFondoImprevisti(input: { traguardo: number; quota: number }): Promise<{ creato: boolean }> {
  if (!importoValido(input.traguardo) || !importoValido(input.quota)) throw new Error('Importo non valido');
  const supabase = await sessione();
  const aperti = await getOpenGoals(supabase);
  if (aperti.some((g) => g.ruolo === 'imprevisti')) {
    aggiorna();
    return { creato: false };
  }
  const oggi = oggiRomaISO();
  await createGoal(supabase, {
    nome: 'Imprevisti',
    importoTarget: input.traguardo,
    modalita: 'dilazionato',
    scadenza: scadenzaImprevisti(oggi, input.traguardo, input.quota),
    categoriaId: null,
    ricorrente: false,
    frequenzaMesi: null,
    accantonaDa: oggi,
    ruolo: 'imprevisti',
  });
  aggiorna();
  return { creato: true };
}

export async function obiettivoPiuAvanti(): Promise<void> {
  const supabase = await sessione();
  await salvaPercorso(supabase, { obiettivoPiuAvanti: true });
  aggiorna();
}

export async function nascondiPrimiPassi(): Promise<void> {
  const supabase = await sessione();
  await salvaPercorso(supabase, { nascosti: true });
  aggiorna();
}

// La lezione è stata mostrata oggi: si ricorda, senza ricaricare la pagina davanti all'utente.
export async function proponiLezione(id: ArgomentoId): Promise<void> {
  if (!LEZIONI.some((l) => l.id === id)) throw new Error('Lezione sconosciuta');
  const supabase = await sessione();
  await segnaProposta(supabase, id, oggiRomaISO());
}
