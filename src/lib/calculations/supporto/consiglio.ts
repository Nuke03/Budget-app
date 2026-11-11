import { differenceInCalendarMonths, parseISO } from 'date-fns';
import { formatEuro } from '@/lib/format';
import type { BudgetGoal } from '@/lib/types';
import type { Andamento } from './andamento';
import { computeFinestraGoal } from '../accantonato';

export type TipoConsiglio = 'senza_dettaglio' | 'categoria_sopra' | 'obiettivo_corto' | 'in_linea';

export interface Consiglio {
  tipo: TipoConsiglio;
  testo: string;
  perche: string;
  categoriaId?: string;
  goalId?: string;
}

export interface ObiettivoCorto {
  goalId: string;
  nome: string;
  mancano: number;
}

type GoalConSpeso = BudgetGoal & { specoCollegato: number };

const euroInFrase = (n: number): string => formatEuro(n).replace(',00', '');

// Quattro frasi brevi dalla ricerca sull'economia domestica; una per mese
// (mese % 4), così cambiano senza caso.
const FRASI_IN_LINEA: { testo: string; perche: string }[] = [
  {
    testo: 'Per esempio, una spesa annuale si spezza in quote mensili: 300 € di TARI fanno 25 € al mese.',
    perche: 'Mettere da parte poco ogni mese pesa meno che trovare tutto insieme quando arriva la rata.',
  },
  {
    testo: 'Regole come 50/30/20 (metà per le cose necessarie, 30% per i desideri, 20% da parte) sono un punto di partenza, non un verdetto.',
    perche: 'Servono a farsi un’idea, poi conta la tua situazione.',
  },
  {
    testo: 'Se per due mesi di fila i soldi messi da parte non bastano, la quota è troppo bassa: non è colpa di nessuno.',
    perche: 'Un numero che non torna dice che il piano va aggiustato, non che qualcuno ha sbagliato.',
  },
  {
    testo: 'Mettere in comune quello che serve davvero, come la casa, e farlo in modo trasparente conta più della formula.',
    perche: 'Avere i numeri davanti, uguali per tutti quelli coinvolti, evita di rifare i conti a mente.',
  },
];

// Categoria con lo scarto maggiore sul solito. Pari scarto: categoriaId minore,
// null per ultimo. Scatta solo con solito noto, +25% e almeno +30 €.
function categoriaSopra(a: Andamento): { categoriaId: string | null; mese: number; solito: number } | null {
  let migliore: { categoriaId: string | null; mese: number; solito: number } | null = null;
  let scartoMigliore = 0;
  for (const c of a.perCategoria) {
    if (c.solito === null) continue;
    const scarto = c.mese - c.solito;
    if (c.mese < c.solito * 1.25 || scarto < 30) continue;
    const meglio =
      migliore === null ||
      scarto > scartoMigliore ||
      (scarto === scartoMigliore &&
        c.categoriaId !== null &&
        (migliore.categoriaId === null || c.categoriaId < migliore.categoriaId));
    if (meglio) {
      migliore = { categoriaId: c.categoriaId, mese: c.mese, solito: c.solito };
      scartoMigliore = scarto;
    }
  }
  return migliore;
}

export function scegliConsiglio(input: {
  andamento: Andamento;
  spesoStime: number; // somma delle spese del mese con stima = true
  nomiCategorie: Record<string, string>;
  obiettiviCorti: ObiettivoCorto[];
  oggi: string;
}): Consiglio {
  const { andamento, spesoStime, nomiCategorie, obiettiviCorti: corti, oggi } = input;

  if (spesoStime > 0.2 * andamento.spesoFinora) {
    return {
      tipo: 'senza_dettaglio',
      testo: `Di quello che hai speso, ${euroInFrase(spesoStime)} sono stime. Con le cifre vere il quadro del mese sarà più preciso.`,
      perche: `Le stime sono più di un quinto delle spese del mese (${euroInFrase(andamento.spesoFinora)} finora). Finché restano stime, il confronto con il solito può spostarsi.`,
    };
  }

  const sopra = categoriaSopra(andamento);
  if (sopra) {
    const nome = (sopra.categoriaId !== null && nomiCategorie[sopra.categoriaId]) || 'Una voce';
    return {
      tipo: 'categoria_sopra',
      testo: `${nome} questo mese è a ${euroInFrase(sopra.mese)}, di solito a questo punto sei a ${euroInFrase(sopra.solito)}. Vale uno sguardo.`,
      perche: `Il solito è la media dei mesi scorsi allo stesso giorno. Qui il mese è sopra di ${euroInFrase(sopra.mese - sopra.solito)}.`,
      ...(sopra.categoriaId !== null ? { categoriaId: sopra.categoriaId } : {}),
    };
  }

  if (corti.length > 0) {
    const g = corti[0];
    return {
      tipo: 'obiettivo_corto',
      testo: `Per ${g.nome} mancano ${euroInFrase(g.mancano)}. Mettendone da parte un po' ogni mese ci arrivi senza fretta.`,
      perche: `Con la quota mensile prevista, entro la scadenza non si arriva alla cifra: mancano ${euroInFrase(g.mancano)} rispetto a quanto messo da parte finora.`,
      goalId: g.goalId,
    };
  }

  const mese = Number(oggi.slice(5, 7));
  const frase = FRASI_IN_LINEA[mese % FRASI_IN_LINEA.length];
  const { solito, spesoFinora } = andamento;
  if (solito === null) {
    return {
      tipo: 'in_linea',
      testo: `Per ora non c'è un mese di prima con cui confrontare. ${frase.testo}`,
      perche: `Il solito si calcola sui mesi scorsi allo stesso giorno, e ancora non ce ne sono. ${frase.perche}`,
    };
  }
  if (spesoFinora > solito) {
    return {
      tipo: 'in_linea',
      testo: `Finora hai speso ${euroInFrase(spesoFinora)}, un po' sopra il solito di ${euroInFrase(solito)}, ma nessuna voce spicca da sola. ${frase.testo}`,
      perche: `Il solito è la media dei mesi scorsi allo stesso giorno. Il totale è sopra, ma nessuna categoria lo è molto da sola. ${frase.perche}`,
    };
  }
  return {
    tipo: 'in_linea',
    testo: `Il mese va come al solito. ${frase.testo}`,
    perche: `Nessuna voce è molto sopra il solito e le stime pesano poco. ${frase.perche}`,
  };
}

// Obiettivi dilazionati aperti con scadenza che, col proprio piano (inizio =
// accantonaDa se più tardi dell'inizio del ciclo), non arrivano alla cifra:
// quota x mesi rimasti < importoTarget - accantonato. Succede per spese
// collegate che erodono l'accantonato o per una finestra residua troppo corta.
// Saltati: scaduti non ricorrenti, e chi lancia errori sui dati.
// `saldoDisponibile` non serve a questa regola: resta in firma, la UI lo passa.
export function obiettiviCorti(
  goals: GoalConSpeso[],
  saldoDisponibile: number,
  oggi: Date
): ObiettivoCorto[] {
  void saldoDisponibile;
  const risultato: ObiettivoCorto[] = [];
  const oggiGiorno = new Date(oggi.getFullYear(), oggi.getMonth(), oggi.getDate());
  for (const g of goals) {
    if (g.modalita !== 'dilazionato' || g.stato !== 'aperto' || !g.scadenza) continue;
    try {
      const { windowStart, windowEnd } = computeFinestraGoal(g, oggi);
      if (windowEnd === null || windowEnd < oggiGiorno) continue;
      const accantonaDa = g.accantonaDa ? parseISO(g.accantonaDa) : null;
      const inizio = accantonaDa && accantonaDa > windowStart ? accantonaDa : windowStart;
      const mesiTotali = Math.max(1, differenceInCalendarMonths(windowEnd, inizio));
      const trascorsi = Math.min(Math.max(differenceInCalendarMonths(oggi, inizio), 0), mesiTotali);
      const mesiRimasti = Math.max(0, differenceInCalendarMonths(windowEnd, oggi));
      const quota = g.importoTarget / mesiTotali;
      const accantonato = Math.max(0, quota * trascorsi - g.specoCollegato);
      const mancano = Math.round((g.importoTarget - accantonato) * 100) / 100;
      if (quota * mesiRimasti < mancano - 0.005) {
        risultato.push({ goalId: g.id, nome: g.nome, mancano });
      }
    } catch {
      continue;
    }
  }
  return risultato;
}
