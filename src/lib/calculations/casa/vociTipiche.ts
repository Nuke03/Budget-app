export interface VoceTipica {
  chiave: string;
  nome: string;
  frequenzaMesi: number;
  stimaRicorrenza: number | null;
  rigaDidattica: string;
}

export const VOCI_CASA_TIPICHE: VoceTipica[] = [
  { chiave: 'affitto', nome: 'Affitto', frequenzaMesi: 1, stimaRicorrenza: null, rigaDidattica: 'Il canone del contratto.' },
  { chiave: 'condominio', nome: 'Condominio', frequenzaMesi: 1, stimaRicorrenza: 50, rigaDidattica: "Di solito paga l'inquilino una parte; guardate il contratto." },
  { chiave: 'luce', nome: 'Luce', frequenzaMesi: 2, stimaRicorrenza: 110, rigaDidattica: 'La bolletta arriva ogni due mesi: mettiamo da parte metà al mese.' },
  { chiave: 'gas', nome: 'Gas', frequenzaMesi: 2, stimaRicorrenza: 110, rigaDidattica: 'La bolletta arriva ogni due mesi: mettiamo da parte metà al mese.' },
  { chiave: 'acqua', nome: 'Acqua', frequenzaMesi: 3, stimaRicorrenza: 60, rigaDidattica: 'Spesso arriva a trimestri o a conguaglio.' },
  { chiave: 'internet', nome: 'Internet', frequenzaMesi: 1, stimaRicorrenza: 28, rigaDidattica: '' },
  { chiave: 'tari', nome: 'TARI', frequenzaMesi: 12, stimaRicorrenza: 300, rigaDidattica: 'Il comune la chiede in 2 o 3 rate: qui la dividiamo per 12.' },
  { chiave: 'assicurazione', nome: 'Assicurazione casa', frequenzaMesi: 12, stimaRicorrenza: 100, rigaDidattica: 'Non è obbligatoria, ma copre incendio e danni a terzi.' },
  { chiave: 'spesa', nome: 'Spesa alimentare', frequenzaMesi: 1, stimaRicorrenza: 300, rigaDidattica: 'È la voce che più varia: la rivedrete dopo 3 mesi.' },
  { chiave: 'manutenzione', nome: 'Manutenzione', frequenzaMesi: 1, stimaRicorrenza: 30, rigaDidattica: '' },
];
