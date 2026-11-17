// Le conferme per le azioni pesanti: di base si chiede sempre.
// "Non avvisarmi più" si ricorda sul dispositivo; da Altro si può riattivare.
export type TipoConferma = 'movimento_casa' | 'chiudi_casa' | 'esci_casa' | 'revoca_invito' | 'archivia_categoria' | 'fondo_pagato';

const TIPI: TipoConferma[] = ['movimento_casa', 'chiudi_casa', 'esci_casa', 'revoca_invito', 'archivia_categoria', 'fondo_pagato'];
const chiave = (tipo: TipoConferma) => `conferme:${tipo}`;

// Chiudere e uscire dalla casa non si annullano: la conferma resta sempre.
const NON_SALTABILI: TipoConferma[] = ['chiudi_casa', 'esci_casa'];

export function serveConferma(tipo: TipoConferma): boolean {
  if (NON_SALTABILI.includes(tipo)) return true;
  try {
    return window.localStorage.getItem(chiave(tipo)) !== 'no';
  } catch {
    return true;
  }
}

export function nonAvvisarePiu(tipo: TipoConferma): void {
  if (NON_SALTABILI.includes(tipo)) return;
  try {
    window.localStorage.setItem(chiave(tipo), 'no');
  } catch {
    // Modalità privata: la scelta non si salva, si continua a chiedere.
  }
}

export function riattivaConferme(): void {
  try {
    for (const tipo of TIPI) window.localStorage.removeItem(chiave(tipo));
  } catch {
    // niente da riattivare
  }
}
