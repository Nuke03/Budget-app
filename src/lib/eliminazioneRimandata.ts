// Eliminazione rimandata: la riga sparisce subito, la scrittura vera parte dopo
// qualche secondo, così c'è il tempo di annullare. Logica pura, senza React.

export interface Rimandata {
  id: string;
  testo: string;
  esegui: () => Promise<void>;
}

interface Voce {
  r: Rimandata;
  timer: ReturnType<typeof setTimeout> | null;
  fatta: boolean; // ogni voce esegue al massimo una volta, qualunque strada arrivi per prima
}

export function creaCodaRimandata(opts: {
  attesaMs: number;
  setTimer?: typeof setTimeout;
  clearTimer?: typeof clearTimeout;
}): {
  aggiungi(r: Rimandata): void;
  annulla(id: string): boolean;
  eseguiTutte(): Promise<void>;
  inAttesa(): Rimandata | null;
} {
  const setT = (opts.setTimer ?? ((f: () => void, ms: number) => setTimeout(f, ms))) as (f: () => void, ms: number) => ReturnType<typeof setTimeout>;
  const clearT = (opts.clearTimer ?? ((id: ReturnType<typeof setTimeout>) => clearTimeout(id))) as (id: ReturnType<typeof setTimeout>) => void;
  let corrente: Voce | null = null;

  async function esegui(v: Voce): Promise<void> {
    if (v.fatta) return;
    v.fatta = true;
    if (v.timer !== null) clearT(v.timer);
    v.timer = null;
    if (corrente === v) corrente = null;
    try {
      await v.r.esegui();
    } catch {
      // l'errore lo gestisce chi ha creato la voce (ripristina); la coda non deve rompersi
    }
  }

  return {
    aggiungi(r) {
      if (corrente && corrente.r.id === r.id) return;
      const precedente = corrente;
      if (precedente) void esegui(precedente);
      const v: Voce = { r, timer: null, fatta: false };
      v.timer = setT(() => void esegui(v), opts.attesaMs);
      corrente = v;
    },
    annulla(id) {
      const v = corrente;
      if (!v || v.fatta || v.r.id !== id) return false;
      v.fatta = true;
      if (v.timer !== null) clearT(v.timer);
      v.timer = null;
      corrente = null;
      return true;
    },
    async eseguiTutte() {
      if (corrente) await esegui(corrente);
    },
    inAttesa() {
      return corrente ? corrente.r : null;
    },
  };
}
