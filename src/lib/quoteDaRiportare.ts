// Le quote del conto tasse che aspettano una risposta ("La riporto indietro?") dopo l'eliminazione di un incasso.
// Stanno nella memoria di sessione: se si lascia lo Storico prima che l'eliminazione diventi effettiva,
// la domanda compare alla prossima apertura. Più eliminazioni vicine fanno più domande, una dopo l'altra.

export interface QuotaDaRiportare {
  id: string;
  importo: number;
}

const chiave = (utente: string) => `quote-da-riportare:${utente}`;
const inMemoria = new Map<string, QuotaDaRiportare[]>();
const ascoltatori = new Set<() => void>();

function leggi(utente: string): QuotaDaRiportare[] {
  try {
    const grezzo = sessionStorage.getItem(chiave(utente));
    if (grezzo) {
      const v = JSON.parse(grezzo);
      if (Array.isArray(v)) return v as QuotaDaRiportare[];
    }
    return [];
  } catch {
    return inMemoria.get(utente) ?? [];
  }
}

function scrivi(utente: string, v: QuotaDaRiportare[]) {
  inMemoria.set(utente, v);
  try {
    sessionStorage.setItem(chiave(utente), JSON.stringify(v));
  } catch {
    // niente memoria di sessione: resta quella del programma, finché la pagina non si ricarica
  }
  ascoltatori.forEach((f) => f());
}

// Ogni utente ha la sua coda: un id di un altro account non si mostra mai.
export function quoteDaRiportare(utente: string): QuotaDaRiportare[] {
  return leggi(utente);
}

export function aggiungiQuotaDaRiportare(utente: string, q: QuotaDaRiportare): void {
  const v = leggi(utente);
  if (v.some((x) => x.id === q.id)) return;
  scrivi(utente, [...v, q]);
}

export function togliQuotaDaRiportare(utente: string, id: string): void {
  scrivi(utente, leggi(utente).filter((x) => x.id !== id));
}

export function ascoltaQuoteDaRiportare(f: () => void): () => void {
  ascoltatori.add(f);
  return () => {
    ascoltatori.delete(f);
  };
}
