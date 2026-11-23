// Tipi della sezione "Agevolazioni e scadenze". Date: 'yyyy-MM-dd' (Roma).
export interface Situazione {
  isee: number | null;
  dsuData: string | null;
  comune: string | null;
  inAffitto: boolean | null;
  studente: boolean | null;
  piva: boolean;
}

export type VoceId =
  | 'isee-dsu'
  | 'bonus-sociale'
  | 'tari-comune'
  | 'contributo-affitto'
  | 'dedicata-a-te'
  | 'trasporto'
  | 'dottorato'
  | 'detrazione-affitto'
  | 'scadenze-piva';

export type Come = 'automatica' | 'su-domanda' | 'informativa' | 'collegamento';

export interface Voce {
  id: VoceId;
  titolo: string;
  perche: string;
  come: Come;
  cosaFare: string[];
  cercare: string | null; // con "{comune}" da sostituire
  link: { testo: string; href: string } | null;
  controllatoIl: string;
  validaFinoAl: string | null;
  soglia: { anno: number; valore: number } | null;
  annuale: boolean; // "Fatto" torna a zero l'anno dopo
  meseBando: number | null; // 1-12, per il promemoria dei bandi
  mostra: (s: Situazione) => boolean;
}

export type StatoVoce = { voceId: VoceId; stato: 'fatto' | 'non-mi-riguarda'; il: string };

export interface VoceMostrata {
  voce: Voce;
  frase: string;
  cercare: string | null;
  daRicontrollare: boolean;
  stato: StatoVoce['stato'] | null;
}
