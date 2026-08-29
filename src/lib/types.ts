export type CategoriaTipo = 'expense' | 'income';
export type GoalModalita = 'bloccato' | 'dilazionato';
export type GoalStato = 'aperto' | 'chiuso' | 'scaduto';
export type TransactionTipo = 'expense' | 'income';

export interface Account {
  id: string;
  nome: string;
  saldoAttuale: number;
  contaInDisponibile: boolean;
  targetSaldo: number | null;
}

export interface Category {
  id: string;
  nome: string;
  tipo: CategoriaTipo;
  colore: string | null;
  archiviata: boolean;
}

export interface BudgetGoal {
  id: string;
  nome: string;
  importoTarget: number;
  modalita: GoalModalita;
  scadenza: string | null;
  categoriaId: string | null;
  ricorrente: boolean;
  frequenzaAnni: number | null;
  stato: GoalStato;
  createdAt: string;
}

export interface Transaction {
  id: string;
  tipo: TransactionTipo;
  importo: number;
  data: string;
  categoriaId: string | null;
  accountId: string | null;
  goalId: string | null;
  descrizione: string;
  nota: string | null;
  createdAt: string;
}
