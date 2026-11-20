// Le quote del conto tasse che aspettano una risposta ("La riporto indietro?") dopo l'eliminazione di un incasso.
// Stanno nella memoria di sessione: se si lascia lo Storico prima che l'eliminazione diventi effettiva,
// la domanda compare alla prossima apertura. Più eliminazioni vicine fanno più domande, una dopo l'altra.

export interface QuotaDaRiportare {
  id: string;
  importo: number;
}

const CHIAVE = 'quote-da-riportare';
let inMemoria: QuotaDaRiportare[] = [];
const ascoltatori = new Set<() => void>();

function leggi(): QuotaDaRiportare[] {
  try {
    const grezzo = sessionStorage.getItem(CHIAVE);
    if (grezzo) {
      const v = JSON.parse(grezzo);
      if (Array.isArray(v)) return v as QuotaDaRiportare[];
    }
    return [];
  } catch {
    return inMemoria;
  }
}

function scrivi(v: QuotaDaRiportare[]) {
  inMemoria = v;
  try {
    sessionStorage.setItem(CHIAVE, JSON.stringify(v));
  } catch {
    // niente memoria di sessione: resta quella del programma, finché la pagina non si ricarica
  }
  ascoltatori.forEach((f) => f());
}

export function quoteDaRiportare(): QuotaDaRiportare[] {
  return leggi();
}

export function aggiungiQuotaDaRiportare(q: QuotaDaRiportare): void {
  const v = leggi();
  if (v.some((x) => x.id === q.id)) return;
  scrivi([...v, q]);
}

export function togliQuotaDaRiportare(id: string): void {
  scrivi(leggi().filter((x) => x.id !== id));
}

export function ascoltaQuoteDaRiportare(f: () => void): () => void {
  ascoltatori.add(f);
  return () => {
    ascoltatori.delete(f);
  };
}
