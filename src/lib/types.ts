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
  createdAt?: string;
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
  frequenzaMesi: number | null;
  stato: GoalStato;
  createdAt: string;
  accantonaDa?: string | null;
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
  pagataDaUserId?: string | null;
  origine?: 'riconciliazione' | null;
  userId?: string;
}

export interface PivaSettings {
  id: string;
  attivo: boolean;
  dataApertura: string | null;
  categoriaFatturatoId: string | null;
  coefficienteRedditivita: number;
  aliquotaSostitutivaOverride: number | null;
  aliquotaContributoSoggettivo: number;
  aliquotaContributoIntegrativo: number;
  minimaleContributivoAnnuo: number;
  contributiVersatiAnnoPrecedente: number;
}

export type RegolaQuota = 'parti_uguali' | 'proporzionale' | 'pari_residuo' | 'personalizzata';

export interface Household {
  id: string;
  nome: string;
  createdAt: string;
  archiviataIl: string | null;
}

export interface HouseholdMember {
  householdId: string;
  userId: string;
  displayName: string;
  joinedAt: string;
  slot: number;
  attivo: boolean;
}

export interface HouseholdInvite {
  id: string;
  householdId: string;
  codice: string;
  createdAt: string;
  scadeIl: string;
  revocatoIl: string | null;
}

export interface HouseholdPlan {
  id: string;
  householdId: string;
  validoDal: string;
  giornoVersamento: number;
  regola: RegolaQuota;
  cuscinettoObiettivo: number;
  cuscinettoQuotaMensile: number;
  arrotondamento: number;
  totaleMensile: number;
  createdAt: string;
}

export type OrigineStima = 'suggerita' | 'utente' | 'reale';

export interface PlanItem {
  id: string;
  planId: string;
  nome: string;
  categoriaId: string | null;
  frequenzaMesi: number;
  importoRicorrenza: number;
  importoMensile: number;
  origineStima: OrigineStima;
  goalId: string | null;
  stimaIgnorataConN: number | null;
  ordine: number;
}

export interface PlanShare {
  planId: string;
  slot: number;
  userId: string | null;
  displayName: string;
  redditoNettoMensile: number;
  redditoIrregolare: boolean;
  percentuale: number | null;
  inCasaDal: string | null;
  esceDal: string | null;
  quotaMensile: number;
}

export type TransferCausale = 'versamento' | 'rimborso' | 'restituzione' | 'altro';

export interface Transfer {
  id: string;
  householdId: string | null;
  userId: string;
  daAccountId: string | null;
  aAccountId: string | null;
  importo: number;
  data: string;
  causale: TransferCausale;
  beneficiarioUserId: string | null;
  perContoDiUserId: string | null;
  meseCompetenza: string | null;
  soloRegistrazione: boolean;
  nota: string | null;
  createdAt: string;
}

export interface BalanceCheck {
  id: string;
  householdId: string;
  accountId: string;
  userId: string;
  data: string;
  saldoRegistrato: number;
  saldoDichiarato: number;
  differenza: number;
  transactionId: string | null;
  createdAt: string;
}

export type EsitoCheckin = 'in_pari' | 'avanzo' | 'ammanco';

export interface Checkin {
  id: string;
  householdId: string;
  mese: string;
  userId: string;
  createdAt: string;
  attesoTotale: number;
  versatoTotale: number;
  previstoMensili: number;
  spesoMensili: number;
  nonRegistrate: number;
  avanzo: number;
  esito: EsitoCheckin;
  destinazioneAvanzo: 'cuscinetto' | 'da_parte' | null;
  goalId: string | null;
}

export interface CalendarFeed {
  id: string;
  householdId: string;
  userId: string;
  token: string;
  createdAt: string;
  revocatoIl: string | null;
}
