export interface AccountBalance {
  saldoAttuale: number;
  contaInDisponibile: boolean;
}

export interface GoalForCalc {
  importoTarget: number;
  modalita: 'bloccato' | 'dilazionato';
  stato: 'aperto' | 'chiuso' | 'scaduto';
  scadenza: string | null;
  createdAt: string;
  ricorrente: boolean;
  frequenzaMesi: number | null;
  // Giorno (yyyy-MM-dd) da cui l'obiettivo inizia a maturare, per chi lo crea
  // a metà ciclo. Assente/null = dall'inizio del ciclo.
  accantonaDa?: string | null;
  // Totale delle spese collegate a questo obiettivo nel ciclo attuale (vedi
  // computeFinestraGoal): riduce quanto resta effettivamente riservato,
  // perché quel denaro è già uscito dal conto. Assente/0 = nessuna spesa
  // ancora collegata.
  specoCollegato?: number;
}
