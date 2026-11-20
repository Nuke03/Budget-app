// Il + della barra in basso avvisa la pagina: chi ha un foglio di aggiunta lo apre e segna gestito.
export const EVENTO_AGGIUNGI = 'libretto:aggiungi';

export interface DettaglioAggiungi {
  gestito: boolean;
  // La vista semplice della casa chiede il foglio già in modo casa.
  casa?: boolean;
  // L'entrata chiede il foglio in modo entrata: chi non lo sa fare non lo segna gestito.
  tipo?: 'income';
}

export function segnaGestito(e: Event): void {
  const d = (e as CustomEvent<DettaglioAggiungi>).detail;
  if (d) d.gestito = true;
}
