import { formatNumero, nomeMese } from '../../format';
import type { PlanBundle } from '../../data/householdPlans';
import type { DebitoMembro } from './debitiMembri';
import type { RigaMese } from './versamenti';
import { meseRomaISO } from './oggi';

export interface StatoPromemoria {
  giornoVersamento: number | null;
  mesePiano: string | null;
  versamentoMese: { atteso: number; versato: number } | null;
  nomi: Record<string, string>;
  crediti: Record<string, number>;
  debiti: DebitoMembro[];
  // Il controllo del saldo: ultimo è la data dell'ultimo controllo (null se mai fatto), riferimento
  // il giorno da cui si conta se non c'è mai stato. Senza conto il promemoria non compare.
  controllo?: { ultimo: string | null; riferimento: string; haConto: boolean };
}

export interface AzionePromemoria {
  tipo: 'versamento' | 'rimborso' | 'restituisci' | 'controllo' | 'checkin';
  etichetta: string;
  importo?: number;
  altroUserId?: string;
  href?: string;
}

export interface Promemoria {
  id: string;
  tipo: 'versamento' | 'credito' | 'debito' | 'controllo' | 'checkin';
  testo: string;
  azione: AzionePromemoria | null;
}

// Quanti promemoria mostrare insieme: il taglio si fa dopo aver tolto quelli rimandati.
export const MASSIMO_PROMEMORIA = 2;
const GIORNI_DI_PREAVVISO = 3;
// Dopo più di questi giorni dall'ultimo controllo del saldo il promemoria ricompare.
const GIORNI_CONTROLLO = 14;
const arrotonda = (n: number): number => Math.round(n * 100) / 100;
const euro = (n: number): string => `${formatNumero(n)} €`;

// Giorni di calendario fra due date YYYY-MM-DD (mai fra istanti, così nessun fuso li sposta).
function giorniTra(da: string, a: string): number {
  return (Date.parse(`${a}T00:00:00Z`) - Date.parse(`${da}T00:00:00Z`)) / 86_400_000;
}

// Il primo giorno in cui il promemoria del versamento compare: tre giorni prima, ma dentro il mese.
function primoGiornoVisibile(mesePiano: string, giorno: number): string {
  const g = Math.max(1, giorno - GIORNI_DI_PREAVVISO);
  return `${mesePiano.slice(0, 7)}-${String(g).padStart(2, '0')}`;
}

function elencoMesi(mesi: string[]): string {
  const nomi = mesi.map(nomeMese);
  return nomi.length <= 1 ? (nomi[0] ?? '') : `${nomi.slice(0, -1).join(', ')} e ${nomi[nomi.length - 1]}`;
}

// Dallo stato della casa di chi guarda ai dati dei promemoria: il giorno dal piano in vigore,
// il versamento dalla riga del mese corrente.
export function statoPromemoria(input: {
  piano: PlanBundle | null;
  righe: RigaMese[];
  oggi: string;
  nomi: Record<string, string>;
  crediti: Record<string, number>;
  debiti: DebitoMembro[];
  controllo?: StatoPromemoria['controllo'];
}): StatoPromemoria {
  const mese = meseRomaISO(new Date(`${input.oggi}T12:00:00Z`));
  const riga = input.righe.find((r) => r.mese === mese) ?? null;
  return {
    giornoVersamento: input.piano?.plan.giornoVersamento ?? null,
    mesePiano: riga ? mese : null,
    versamentoMese: riga ? { atteso: riga.atteso, versato: riga.versato } : null,
    nomi: input.nomi,
    crediti: input.crediti,
    debiti: input.debiti,
    controllo: input.controllo,
  };
}

export function computeReminders(stato: StatoPromemoria, utente: { userId: string }, oggi: string): Promemoria[] {
  const me = utente.userId;
  const nome = (id: string): string => stato.nomi[id] ?? 'Un altro membro';
  const out: Promemoria[] = [];

  const { giornoVersamento, mesePiano, versamentoMese } = stato;
  if (giornoVersamento !== null && mesePiano !== null && versamentoMese && versamentoMese.versato < versamentoMese.atteso) {
    if (oggi >= primoGiornoVisibile(mesePiano, giornoVersamento)) {
      const importo = arrotonda(versamentoMese.atteso - versamentoMese.versato);
      const scadenza = `${mesePiano.slice(0, 7)}-${String(giornoVersamento).padStart(2, '0')}`;
      const testo =
        oggi < scadenza
          ? `Il tuo versamento di ${euro(importo)} è da fare entro il ${giornoVersamento}.`
          : `Il versamento di ${nomeMese(mesePiano)} è ancora da registrare. Già fatto? Registralo con la spunta "già riflesso".`;
      out.push({
        id: `versamento:${mesePiano}`,
        tipo: 'versamento',
        testo,
        azione: { tipo: 'versamento', etichetta: 'Registra', importo },
      });
    }
  }

  const mioCredito = stato.crediti[me] ?? 0;
  if (mioCredito > 0) {
    out.push({ id: `credito:${me}`, tipo: 'credito', testo: `In attesa del rimborso: ${euro(mioCredito)}.`, azione: null });
  }
  for (const [id, importo] of Object.entries(stato.crediti)) {
    if (id === me || importo <= 0) continue;
    out.push({
      id: `credito:${id}`,
      tipo: 'credito',
      testo: `A ${nome(id)} spettano ${euro(importo)} per spese anticipate.`,
      azione: { tipo: 'rimborso', etichetta: 'Rimborsa', importo, altroUserId: id },
    });
  }

  for (const d of stato.debiti) {
    if (d.debitoreId === me) {
      out.push({
        id: `debito:${d.creditoreId}>${me}`,
        tipo: 'debito',
        testo: `Resta da restituire a ${nome(d.creditoreId)}: ${euro(d.importo)} (quota di ${elencoMesi(d.mesi.map((m) => m.mese))}). Anche a rate, quando puoi.`,
        azione: { tipo: 'restituisci', etichetta: 'Restituisci', importo: d.importo, altroUserId: d.creditoreId },
      });
    } else if (d.creditoreId === me) {
      out.push({
        id: `debito:${me}>${d.debitoreId}`,
        tipo: 'debito',
        testo: `${nome(d.debitoreId)} deve ancora ${euro(d.importo)} a te.`,
        azione: null,
      });
    }
  }

  const controllo = stato.controllo;
  if (controllo?.haConto) {
    const da = controllo.ultimo ?? controllo.riferimento;
    if (giorniTra(da, oggi) > GIORNI_CONTROLLO) {
      out.push({
        id: `controllo:${da}`,
        tipo: 'controllo',
        testo: 'Un controllo veloce del conto comune? Confrontate il saldo con quello della banca.',
        azione: { tipo: 'controllo', etichetta: 'Controlla', href: '/casa/controllo/conto' },
      });
    }
  }

  return out;
}
