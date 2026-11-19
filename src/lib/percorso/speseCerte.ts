// Spese che arrivano una o due volte l'anno ma sono certe. Cifre di esempio, modificabili dall'utente.
// importoPerCiclo e' l'importo dovuto ogni frequenzaMesi mesi (12 = ogni anno, 24 = ogni due anni).
export interface SpesaCerta {
  chiave: string;
  nome: string;
  importoPerCiclo: number;
  frequenzaMesi: number;
  riga: string;
}

export const SPESE_CERTE_PERSONALI: SpesaCerta[] = [
  { chiave: 'assicurazione-auto', nome: 'Assicurazione auto', importoPerCiclo: 480, frequenzaMesi: 12, riga: "Arriva una volta all'anno, di solito tutta insieme." },
  { chiave: 'bollo', nome: 'Bollo auto', importoPerCiclo: 150, frequenzaMesi: 12, riga: 'Una scadenza ogni anno, sempre la stessa.' },
  { chiave: 'tagliando-revisione', nome: 'Tagliando e revisione', importoPerCiclo: 250, frequenzaMesi: 12, riga: "Manutenzione dell'auto e controllo periodico." },
  { chiave: 'gomme', nome: 'Gomme', importoPerCiclo: 400, frequenzaMesi: 24, riga: 'Si cambiano ogni due anni circa.' },
  { chiave: 'abbonamenti-annuali', nome: 'Abbonamenti annuali', importoPerCiclo: 60, frequenzaMesi: 12, riga: "Quelli che si rinnovano una volta all'anno." },
  { chiave: 'regali', nome: 'Regali', importoPerCiclo: 300, frequenzaMesi: 12, riga: 'Compleanni e feste: le date sono note in anticipo.' },
];
