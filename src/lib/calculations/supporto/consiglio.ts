import { differenceInCalendarMonths } from 'date-fns';
import { formatEuro } from '@/lib/format';
import type { BudgetGoal } from '@/lib/types';
import type { Andamento } from './andamento';
import { computeAccantonatoFinora, computeFinestraGoal, computeQuotaMensile } from '../accantonato';

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
    testo: 'Una spesa annuale si spezza in quote mensili: 300 € di TARI sono 25 € al mese.',
    perche: 'Mettere da parte poco ogni mese pesa meno che trovare tutto insieme quando arriva la rata.',
  },
  {
    testo: 'Le regole come 50/30/20 sono un punto di partenza, non un verdetto.',
    perche: 'Servono a capire se sei vicino o lontano da un ordine di grandezza, poi conta la tua situazione.',
  },
  {
    testo: 'Se un mese manca qualcosa due volte di fila, di solito la quota è troppo bassa. Si ricalcola.',
    perche: 'Un numero che non torna dice che il piano va aggiustato, non che qualcuno ha sbagliato.',
  },
  {
    testo: 'Mettere in comune quello che serve davvero, come la casa, e farlo in modo trasparente conta più della formula.',
    perche: 'Vedere tutti la stessa cifra toglie il bisogno di rifare i conti a voce.',
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
  return {
    tipo: 'in_linea',
    testo: `Il mese va come al solito. ${frase.testo}`,
    perche: `Nessuna voce è molto sopra il solito e le stime pesano poco. ${frase.perche}`,
  };
}

// Obiettivi dilazionati aperti con scadenza per cui quota mensile x mesi
// rimasti non copre importoTarget - accantonato (es. dopo una spesa collegata).
// `saldoDisponibile` non serve a questa regola: resta in firma, la UI lo passa.
export function obiettiviCorti(
  goals: GoalConSpeso[],
  saldoDisponibile: number,
  oggi: Date
): ObiettivoCorto[] {
  void saldoDisponibile;
  const risultato: ObiettivoCorto[] = [];
  for (const g of goals) {
    if (g.modalita !== 'dilazionato' || g.stato !== 'aperto' || !g.scadenza) continue;
    const quota = computeQuotaMensile(g, oggi);
    if (quota === null) continue;
    const { windowEnd } = computeFinestraGoal(g, oggi);
    const mesiRimasti = Math.max(0, differenceInCalendarMonths(windowEnd!, oggi));
    const accantonato = computeAccantonatoFinora(g, oggi, g.specoCollegato);
    const mancano = Math.round((g.importoTarget - accantonato) * 100) / 100;
    if (quota * mesiRimasti < mancano - 0.005) {
      risultato.push({ goalId: g.id, nome: g.nome, mancano });
    }
  }
  return risultato;
}
