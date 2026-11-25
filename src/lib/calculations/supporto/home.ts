import { computeReminders, statoPromemoria } from '../casa/promemoria';
import { riferimentoControllo } from '../casa/controlloSaldo';
import { formatEuro, nomeMese, euroInFrase } from '@/lib/format';
import { computeQuotaMensile } from '../accantonato';
import type { CasaPerHome } from '@/lib/loadHomeData';
import type { BudgetGoal, Category, PivaFattura, PivaScadenza, Transaction } from '@/lib/types';

export interface RigaLibretto {
  id: string;
  data: string;
  descrizione: string;
  importo: number;
  tipo: 'expense' | 'income';
  stima: boolean;
  // Speso cumulato del mese dopo questa riga (solo spese). Non è un saldo.
  nelMese: number;
  // Colore della categoria della riga; null se la riga non ha categoria o la categoria non ha colore.
  colore: string | null;
  // Icona della categoria della riga (id di categoryIcons.ts); null se non c'è.
  icona?: string | null;
}

export interface Prossimo {
  testo: string;
  href: string;
  // Per i promemoria che si possono rimandare ("Più tardi").
  id?: string;
  tipo: 'in_pari' | 'casa' | 'piva' | 'agevolazione' | 'attesa' | 'sposta' | 'obiettivo';
}

const arrotonda = (n: number): number => Math.round(n * 100) / 100;

// Le righe più recenti (data poi createdAt, decrescente) con lo speso cumulato del loro mese.
// Il cumulato si calcola in ordine di tempo; le entrate ripetono il valore della riga prima.
export function righeLibretto(
  transazioni: Transaction[],
  oggi: string,
  quante = 4,
  categorie: Pick<Category, 'id' | 'colore' | 'icona'>[] = []
): RigaLibretto[] {
  void oggi;
  const coloreDi = new Map(categorie.map((c) => [c.id, c.colore]));
  const iconaDi = new Map(categorie.map((c) => [c.id, c.icona ?? null]));
  const cronologico = [...transazioni].sort(
    (a, b) => a.data.localeCompare(b.data) || a.createdAt.localeCompare(b.createdAt)
  );
  const nelMeseDi = new Map<string, number>();
  const cumulatoPerId = new Map<string, number>();
  for (const t of cronologico) {
    const mese = t.data.slice(0, 7);
    const attuale = (nelMeseDi.get(mese) ?? 0) + (t.tipo === 'expense' ? t.importo : 0);
    nelMeseDi.set(mese, attuale);
    cumulatoPerId.set(t.id, arrotonda(attuale));
  }
  return cronologico
    .reverse()
    .slice(0, quante)
    .map((t) => ({
      id: t.id,
      data: t.data,
      descrizione: t.descrizione,
      importo: t.importo,
      tipo: t.tipo as 'expense' | 'income',
      stima: t.stima,
      nelMese: cumulatoPerId.get(t.id) ?? 0,
      colore: t.categoriaId ? (coloreDi.get(t.categoriaId) ?? null) : null,
      icona: t.categoriaId ? (iconaDi.get(t.categoriaId) ?? null) : null,
    }));
}

// "9 novembre", con l'anno solo se non è quello di riferimento.
function giornoEMese(giorno: string, riferimento: string): string {
  const base = `${Number(giorno.slice(8, 10))} ${nomeMese(giorno)}`;
  return giorno.slice(0, 4) === riferimento.slice(0, 4) ? base : `${base} ${giorno.slice(0, 4)}`;
}

export interface PromemoriaPiva {
  testo: string;
  href: string;
  urgente: boolean;
}

const GIORNI_SCADENZA_URGENTE = 15;
const GIORNI_FATTURA_FERMA = 60;

// Giorni di calendario fra due date YYYY-MM-DD, via UTC: nessun fuso li sposta.
function giorniTra(da: string, a: string): number {
  return (Date.parse(`${a}T00:00:00Z`) - Date.parse(`${da}T00:00:00Z`)) / 86_400_000;
}

// I promemoria della P.IVA guidata. Le scadenze entro 15 giorni sono urgenti; il resto aspetta.
// La revisione dello stipendio arriva già scritta (la produce il passo dello stipendio).
export function promemoriaPiva(
  input: { scadenze: PivaScadenza[]; fatture: PivaFattura[]; inSospeso: number; revisioneStipendio: string | null },
  oggi: string
): PromemoriaPiva[] {
  const out: PromemoriaPiva[] = [];
  for (const s of input.scadenze) {
    if (s.pagataIl || s.nascosta) continue;
    const giorni = giorniTra(oggi, s.data);
    if (giorni < 0 || giorni > GIORNI_SCADENZA_URGENTE) continue;
    out.push({ testo: `${s.descrizione} entro il ${giornoEMese(s.data, oggi)}`, href: '/piva', urgente: true });
  }
  if (input.inSospeso > 0) {
    out.push({ testo: `Da spostare sul conto tasse: ${formatEuro(input.inSospeso)}`, href: '/piva', urgente: false });
  }
  const ferme = input.fatture.filter(
    (f) => !f.dataIncasso && giorniTra(f.dataEmissione, oggi) > GIORNI_FATTURA_FERMA
  ).length;
  if (ferme > 0) {
    out.push({
      testo: ferme === 1 ? '1 fattura aspetta da più di 60 giorni' : `${ferme} fatture aspettano da più di 60 giorni`,
      href: '/piva',
      urgente: false,
    });
  }
  if (input.revisioneStipendio) out.push({ testo: input.revisioneStipendio, href: '/piva', urgente: false });
  return out;
}

// Un obiettivo dilazionato di cui hai già confermato almeno un versamento: se questo mese non hai ancora
// confermato niente, la Home lo chiede (una voce sola, la prima). Chi non ha mai confermato non riceve
// niente: la conferma è una scelta, non un compito.
export function promemoriaVersamento(
  goals: (BudgetGoal & { versatoNellaFinestra?: number | null; confermatoMese?: number })[],
  oggi: Date
): { testo: string; href: string } | null {
  for (const g of goals) {
    if (g.stato !== 'aperto' || g.modalita !== 'dilazionato') continue;
    if (g.versatoNellaFinestra === null || g.versatoNellaFinestra === undefined) continue;
    let quota: number | null;
    try {
      quota = computeQuotaMensile(g, oggi);
    } catch {
      continue;
    }
    if (quota === null || quota <= 0) continue;
    // Una conferma qualsiasi nel mese chiude la domanda: chi ha messo da parte meno della quota lo ha deciso.
    if ((g.confermatoMese ?? 0) > 0) continue;
    return {
      testo: `Hai messo da parte i ${euroInFrase(arrotonda(quota))} per ${g.nome} questo mese?`,
      href: `/goals#goal-${g.id}`,
    };
  }
  return null;
}

// In pari, poi le scadenze P.IVA urgenti, poi la casa, poi le agevolazioni, poi il resto della P.IVA, poi la lista d'attesa,
// per ultima la conferma del versamento di un obiettivo.
export interface InputProssimaCosa {
  inPari: { dal: string; al: string } | null;
  // L'id serve al browser per togliere i promemoria rimandati sul telefono (localStorage).
  promemoriaCasa: { id?: string; testo: string; href?: string }[];
  promemoriaPiva?: PromemoriaPiva[];
  // Il promemoria di Agevolazioni e scadenze: passa dopo la P.IVA urgente e la Casa, prima del resto.
  agevolazione?: { id?: string; testo: string; href: string } | null;
  // La voce della lista d'attesa da rivedere: passa per ultima.
  attesa?: { testo: string; href: string } | null;
  // Il rientro verso un conto risparmio con qualcosa da spostare (il più vecchio): passa prima del versamento.
  sposta?: { testo: string; href: string } | null;
  // La conferma del versamento mensile di un obiettivo (promemoriaVersamento): passa dopo tutto il resto.
  versamento?: { testo: string; href: string } | null;
}

export function prossimaCosa(input: InputProssimaCosa): Prossimo | null {
  if (input.inPari) {
    return {
      testo: `Rimettiti in pari: dal ${giornoEMese(input.inPari.dal, input.inPari.al)} non hai segnato spese`,
      href: '/in-pari',
      tipo: 'in_pari',
    };
  }
  const piva = input.promemoriaPiva ?? [];
  const urgente = piva.find((p) => p.urgente);
  if (urgente) return { testo: urgente.testo, href: urgente.href, tipo: 'piva' };
  const primo = input.promemoriaCasa[0];
  if (primo) return { testo: primo.testo, href: primo.href ?? '/casa', tipo: 'casa' };
  if (input.agevolazione) return { ...input.agevolazione, tipo: 'agevolazione' };
  const resto = piva[0];
  if (resto) return { testo: resto.testo, href: resto.href, tipo: 'piva' };
  if (input.attesa) return { ...input.attesa, tipo: 'attesa' };
  if (input.sposta) return { ...input.sposta, tipo: 'sposta' };
  if (input.versamento) return { ...input.versamento, tipo: 'obiettivo' };
  return null;
}

// I promemoria della casa di chi guarda (stessa logica che la Home mostrava già).
export function promemoriaDaCasa(casa: CasaPerHome | null, oggi: string) {
  const stato = casa?.stato ?? null;
  if (!stato) return [];
  return computeReminders(
    statoPromemoria({
      piano: stato.piano,
      righe: stato.righe,
      righeCasa: stato.righeCasa,
      oggi,
      nomi: Object.fromEntries(stato.membri.map((m) => [m.userId, m.displayName])),
      crediti: stato.crediti,
      debiti: stato.debiti,
      controllo: {
        ultimo: stato.controlli.ultimoControllo,
        riferimento: riferimentoControllo(stato.me.joinedAt, casa?.aggiunta?.conti ?? []),
        haConto: (casa?.aggiunta?.conti.length ?? 0) > 0,
      },
      ultimoCheckinMese: stato.controlli.ultimoCheckinMese,
    }),
    { userId: stato.me.userId },
    oggi
  );
}
