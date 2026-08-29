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
  frequenzaAnni: number | null;
}
