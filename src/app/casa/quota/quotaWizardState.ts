import { addMonths, format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';
import type { PlanBundle } from '@/lib/data/householdPlans';
import type { HouseholdMember, OrigineStima, PlanShare } from '@/lib/types';
import { parseImporto } from '@/lib/calculations/casa/parseImporto';
import { VOCI_CASA_TIPICHE } from '@/lib/calculations/casa/vociTipiche';
import type { AvvisoQuota } from '@/lib/calculations/casa/quota';
import type { UscitoDraft } from '@/lib/calculations/casa/pianoVersioni';

export const ERRORE_GENERICO = 'Salvataggio fallito, controlla la connessione e riprova.';
export const ERRORE_REDDITO_ALTRUI =
  "Il reddito di un'altra persona lo cambia solo lei. Ricarica la pagina per vedere i valori aggiornati.";
export const ERRORE_MESE_PASSATO = 'Il mese di partenza è passato: ricarica la pagina e riprova.';

export function messaggioErrore(e: unknown): string {
  const testo = typeof e === 'object' && e !== null && 'message' in e ? String((e as { message: unknown }).message) : '';
  if (testo.includes('il reddito di un altro membro non si modifica')) return ERRORE_REDDITO_ALTRUI;
  if (testo.includes('valido_dal nel passato')) return ERRORE_MESE_PASSATO;
  return ERRORE_GENERICO;
}
export const ARROTONDAMENTO = 10;
export const PASSI = ['Quanto entra ogni mese', 'Le spese di casa', 'Il cuscinetto', 'Come dividere', 'Quando e da quando'];
export type RegolaScelta = 'parti_uguali' | 'proporzionale' | 'pari_residuo';

export const REGOLE: { chiave: RegolaScelta; titolo: string; frase: string }[] = [
  { chiave: 'parti_uguali', titolo: 'Parti uguali', frase: 'Ognuno versa la stessa cifra.' },
  {
    chiave: 'proporzionale',
    titolo: 'Secondo il reddito',
    frase: 'Ognuno versa la stessa percentuale del proprio reddito.',
  },
  { chiave: 'pari_residuo', titolo: 'Stesso residuo', frase: 'A fine mese restano a tutti gli stessi soldi personali.' },
];

export interface PersonaState {
  slot: number;
  displayName: string;
  userId: string | null;
  redditoText: string;
  irregolare: boolean;
  inCasaDal: string;
  soloLettura: boolean;
}

export interface VoceState {
  key: number;
  nome: string;
  categoriaNome: string;
  categoriaId: string | null;
  importoText: string;
  frequenzaText: string;
  custom: boolean;
  origine: OrigineStima;
  goalId: string | null;
  stimaIgnorataConN: number | null;
  info: string;
}


let contatoreChiavi = 0;
export const nuovaChiave = () => ++contatoreChiavi;

export const testoNumero = (n: number) => String(n).replace('.', ',');
export const arrotonda2 = (n: number) => Math.round(n * 100) / 100;

export function parseMesi(testo: string): number | null {
  const n = parseImporto(testo);
  return n !== null && Number.isInteger(n) && n >= 1 ? n : null;
}

export function opzioniMesi(da: string, extra: string[] = []): { value: string; label: string }[] {
  const base = Array.from({ length: 12 }, (_, i) => format(addMonths(parseISO(da), i), 'yyyy-MM-01'));
  const tutti = Array.from(new Set([...base, ...extra])).sort();
  return tutti.map((value) => ({ value, label: format(parseISO(value), 'LLLL yyyy', { locale: it }) }));
}

// L'ultimo valore salvato per ogni posizione, scorrendo le versioni dalla più vecchia alla più recente.
export function ultimeQuote(piani: PlanBundle[]): Map<number, PlanShare> {
  const ultime = new Map<number, PlanShare>();
  for (const piano of piani) for (const s of piano.shares) ultime.set(s.slot, s);
  return ultime;
}

// Chi è uscito: per ogni posizione la cui riga più recente ha una data di uscita, con la quota di quella riga.
export function uscentiDaPiani(piani: PlanBundle[]): UscitoDraft[] {
  return Array.from(ultimeQuote(piani).values())
    .filter((s) => s.esceDal !== null)
    .sort((a, b) => a.slot - b.slot)
    .map((s) => ({
      slot: s.slot,
      displayName: s.displayName,
      redditoNettoMensile: s.redditoNettoMensile,
      redditoIrregolare: s.redditoIrregolare,
      inCasaDal: s.inCasaDal,
      esceDal: s.esceDal as string,
      quotaMensile: s.quotaMensile,
    }));
}

export function personeIniziali(
  membri: HouseholdMember[],
  piani: PlanBundle[],
  meUserId: string,
  meseCorrente: string,
): PersonaState[] {
  const attivi = membri.filter((m) => m.attivo).sort((a, b) => a.slot - b.slot);
  const ultime = ultimeQuote(piani);
  const daMembro = (m: HouseholdMember): PersonaState => {
    const salvata = ultime.get(m.slot);
    return {
      slot: m.slot,
      displayName: m.displayName,
      userId: m.userId,
      redditoText: salvata ? testoNumero(salvata.redditoNettoMensile) : '',
      irregolare: salvata?.redditoIrregolare ?? false,
      inCasaDal: meseCorrente,
      soloLettura: salvata !== undefined && m.userId !== meUserId,
    };
  };
  const ultimo = piani[piani.length - 1];
  if (!ultimo) return attivi.map(daMembro);

  const out: PersonaState[] = [];
  // Le persone sono quelle della versione più recente, con l'ultimo valore salvato di ciascuna.
  // Chi è già uscito non riparte; una quota legata a chi non è più membro non resta (diventerebbe
  // un segnaposto che nessuno potrebbe occupare).
  for (const s0 of ultimo.shares.filter((x) => x.esceDal === null).sort((a, b) => a.slot - b.slot)) {
    const membro = attivi.find((m) => m.slot === s0.slot);
    if (s0.userId !== null && !membro) continue;
    const s = ultime.get(s0.slot) ?? s0;
    const userId = membro ? membro.userId : null;
    out.push({
      slot: s0.slot,
      displayName: membro?.displayName ?? s0.displayName,
      userId,
      redditoText: testoNumero(s.redditoNettoMensile),
      irregolare: s.redditoIrregolare,
      inCasaDal: s0.inCasaDal ?? meseCorrente,
      // Il reddito di un altro membro lo corregge lui, ma solo se il piano ne ha già uno.
      soloLettura: userId !== null && userId !== meUserId,
    });
  }
  for (const m of attivi) {
    if (!out.some((o) => o.slot === m.slot)) out.push(daMembro(m));
  }
  return out;
}

export function vociIniziali(piano: PlanBundle | undefined): VoceState[] {
  if (piano) {
    return [...piano.items]
      .sort((a, b) => a.ordine - b.ordine)
      .map((i) => {
        const tipica = VOCI_CASA_TIPICHE.find((t) => t.nome === i.nome);
        return {
          key: nuovaChiave(),
          nome: i.nome,
          categoriaNome: i.nome,
          categoriaId: i.categoriaId,
          importoText: testoNumero(i.importoRicorrenza),
          frequenzaText: String(i.frequenzaMesi),
          custom: !tipica,
          origine: i.origineStima,
          goalId: i.goalId,
          stimaIgnorataConN: i.stimaIgnorataConN,
          info: tipica?.rigaDidattica ?? '',
        };
      });
  }
  return VOCI_CASA_TIPICHE.map((t) => ({
    key: nuovaChiave(),
    nome: t.nome,
    categoriaNome: t.nome,
    categoriaId: null,
    importoText: t.stimaRicorrenza === null ? '' : testoNumero(t.stimaRicorrenza),
    frequenzaText: String(t.frequenzaMesi),
    custom: false,
    origine: 'suggerita',
    goalId: null,
    stimaIgnorataConN: null,
    info: t.rigaDidattica,
  }));
}

export function testoAvviso(a: AvvisoQuota): string {
  switch (a.tipo) {
    case 'redditi_mancanti':
      return `Manca il reddito di ${a.nome}.`;
    case 'percentuali_non_100':
      return 'Le percentuali devono fare 100.';
    case 'quota_supera_reddito':
      return `La quota di ${a.nome} è più alta del suo reddito.`;
    case 'spese_oltre_redditi':
      return 'Le spese di casa sono più alte dei redditi di tutti.';
  }
}
