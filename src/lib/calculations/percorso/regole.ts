// Quando proporre una lezione: regole pure, nessun accesso ai dati.
import type { BudgetGoal, Category, Transaction } from '@/lib/types';
import type { ArgomentoId, PercorsoUtente, StatiLezioni } from '@/lib/percorso/tipi';
import { LEZIONI, lezione } from '@/lib/percorso/lezioni';
import {
  PICCOLA_SPESA, PICCOLE_SPESE_MESE, SPESA_IMPREVISTO, SPESA_IMPULSO, ENTRATA_GRANDE,
  DISPONIBILE_BASSO, GIORNI_SENZA_ENTRATA, GIORNI_RIPROPOSTA, GIORNI_ANNUALE,
} from './soglie';
import { piccoleSpese } from './numeri';

export interface DatiRegole {
  oggi: string;
  transazioni: Transaction[]; // personali, ultimi 3 mesi
  categorie: Category[];
  goals: (BudgetGoal & { accantonato: number })[];
  lezioni: StatiLezioni;
  percorso: PercorsoUtente | null;
  disponibileReale: number;
  ultimaEntrataIl: string | null;
  primiPassiVisibili: boolean;
}

// Giorni tra due date 'YYYY-MM-DD', in UTC.
function giorniTra(da: string, a: string): number {
  return (Date.parse(`${a}T00:00:00Z`) - Date.parse(`${da}T00:00:00Z`)) / 86_400_000;
}

const normalizza = (s: string): string => s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');

const PAROLE_CERTE = ['auto', 'assicura', 'bollo', 'tari', 'abbonament', 'tagliando', 'revisione'];
const PAROLE_SVAGO = ['svago', 'acquist', 'shopping', 'vestit', 'hobby', 'regal'];

export function ruoloCategoria(c: Category): 'certa' | 'svago' | null {
  if (c.ruolo) return c.ruolo;
  const nome = normalizza(c.nome);
  if (PAROLE_CERTE.some((p) => nome.includes(p))) return 'certa';
  if (PAROLE_SVAGO.some((p) => nome.includes(p))) return 'svago';
  return null;
}

// Confini di parola: "pirata" non è una rata.
const RE_RATA = /\b(?:rata|rate|klarna|scalapay|paypal in 3|finanziament\w*)\b/;

export function eRata(t: Transaction, categorie: Category[]): boolean {
  const nomeCategoria = categorie.find((c) => c.id === t.categoriaId)?.nome ?? '';
  return RE_RATA.test(normalizza(`${t.descrizione} ${nomeCategoria}`));
}

export function meseStretto(d: DatiRegole): boolean {
  if (d.disponibileReale < 0) return true;
  if (d.ultimaEntrataIl === null) return true;
  return giorniTra(d.ultimaEntrataIl, d.oggi) >= GIORNI_SENZA_ENTRATA;
}

export function puoProporre(id: ArgomentoId, d: DatiRegole, giorniMinimi: number = GIORNI_RIPROPOSTA): boolean {
  if (d.percorso?.ultimaPropostaIl === d.oggi) return false;
  const stato = d.lezioni[id];
  if (stato?.rimandataAl && stato.rimandataAl > d.oggi) return false;
  if (stato?.vistaIl && giorniTra(stato.vistaIl, d.oggi) < giorniMinimi) return false;
  if (meseStretto(d) && lezione(id).fase === 'dopo') return false;
  return true;
}

export function lezioneDopoSalvataggio(t: Transaction, d: DatiRegole): ArgomentoId | null {
  const spesa = t.tipo === 'expense';
  const cat = d.categorie.find((c) => c.id === t.categoriaId);
  const ruolo = cat ? ruoloCategoria(cat) : null;
  const mese = t.data.slice(0, 7);
  const candidati: (ArgomentoId | null)[] = [
    spesa && eRata(t, d.categorie) ? 'debiti-rate' : null,
    spesa && t.importo > SPESA_IMPREVISTO && !t.goalId ? 'imprevisti' : null,
    spesa && ruolo === 'certa' &&
      !d.goals.some((g) => g.stato === 'aperto' && g.categoriaId !== null && g.categoriaId === t.categoriaId)
      ? 'spese-certe' : null,
    spesa && t.importo > SPESA_IMPULSO && ruolo === 'svago' &&
      !d.lezioni.impulso?.propostaIl?.startsWith(d.oggi.slice(0, 7))
      ? 'impulso' : null,
    !spesa && t.importo > ENTRATA_GRANDE ? 'prima-da-parte' : null,
    (!spesa && !d.transazioni.some((x) => x.tipo === 'income' && x.id !== t.id && x.data.startsWith(mese))) ||
      d.disponibileReale < DISPONIBILE_BASSO
      ? 'piano' : null,
    spesa && t.importo < PICCOLA_SPESA && piccoleSpese(d.transazioni, mese).totale > PICCOLE_SPESE_MESE
      ? 'dove-vanno' : null,
  ];
  for (const id of candidati) if (id && puoProporre(id, d)) return id;
  return null;
}

// Mese 'YYYY-MM' spostato di `n` mesi indietro.
function meseIndietro(oggi: string, n: number): string {
  const [a, m] = oggi.split('-').map(Number);
  const idx = a * 12 + (m - 1) - n;
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, '0')}`;
}

function entrateDelMese(t: Transaction[], mese: string): number {
  return t.filter((x) => x.tipo === 'income' && x.data.startsWith(mese)).reduce((s, x) => s + x.importo, 0);
}

function redditoIrregolare(d: DatiRegole): boolean {
  const tipo = d.percorso?.entrateTipo;
  if (tipo !== 'irregolari' && tipo !== 'piva') return false;
  const a = entrateDelMese(d.transazioni, meseIndietro(d.oggi, 1));
  const b = entrateDelMese(d.transazioni, meseIndietro(d.oggi, 2));
  const max = Math.max(a, b);
  return max > 0 && Math.abs(a - b) / max >= 0.3;
}

export function lezioneDelGiorno(d: DatiRegole): ArgomentoId | null {
  if (d.primiPassiVisibili) return null;
  // La lezione già proposta oggi resta visibile tutto il giorno, finché non la si apre o rimanda.
  const giaOggi = LEZIONI.find((l) => {
    const s = d.lezioni[l.id];
    return s?.propostaIl === d.oggi && s.vistaIl !== d.oggi && !(s.rimandataAl && s.rimandataAl > d.oggi);
  });
  if (giaOggi) return giaOggi.id;
  const fondo = d.goals.find((g) => g.ruolo === 'imprevisti');
  const piuVecchia = d.transazioni.reduce<string | null>((m, t) => (m === null || t.data < m ? t.data : m), null);
  const candidati: { id: ArgomentoId; ok: boolean; giorni?: number }[] = [
    { id: 'piano', ok: d.disponibileReale < DISPONIBILE_BASSO },
    { id: 'imprevisti', ok: !fondo },
    { id: 'reddito-irregolare', ok: redditoIrregolare(d) },
    { id: 'risparmio-investimento', ok: !!fondo && fondo.accantonato >= fondo.importoTarget },
    { id: 'truffe', ok: true, giorni: GIORNI_ANNUALE },
    { id: 'pensione', ok: true, giorni: GIORNI_ANNUALE },
    { id: 'inflazione', ok: piuVecchia !== null && giorniTra(piuVecchia, d.oggi) >= GIORNI_ANNUALE, giorni: GIORNI_ANNUALE },
  ];
  for (const c of candidati) if (c.ok && puoProporre(c.id, d, c.giorni)) return c.id;
  return null;
}
