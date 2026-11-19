// Tipi del percorso di apprendimento personale.
export type ArgomentoId =
  | 'dove-vanno' | 'piano' | 'spese-certe' | 'imprevisti' | 'prima-da-parte'
  | 'impulso' | 'bisogni-desideri' | 'reddito-irregolare' | 'debiti-rate' | 'truffe'
  | 'coppia' | 'assicurazioni' | 'inflazione' | 'risparmio-investimento' | 'pensione';
export type Fase = 'adesso' | 'appena-entrano' | 'dopo';
export type PassoId = 'conti' | 'entrate' | 'piva' | 'settimana' | 'spese-certe' | 'imprevisti' | 'obiettivo';

export interface PercorsoUtente {
  entrateTipo: 'fisse' | 'irregolari' | 'piva' | null;
  entrataAttesa: number | null; entrataAttesaIl: string | null; redditoBase: number | null;
  settimanaDal: string | null; settimanaFattaIl: string | null;
  speseCerteNessuna: boolean; obiettivoPiuAvanti: boolean; nascosti: boolean;
  ultimaPropostaIl: string | null;
}

export interface StatoLezione { vistaIl: string | null; rimandataAl: string | null; azioneIl: string | null; propostaIl: string | null }
export type StatiLezioni = Partial<Record<ArgomentoId, StatoLezione>>;

export interface VoceAttesa { id: string; nome: string; importo: number; aggiuntoIl: string; rivediIl: string; stato: 'in_attesa' | 'voluto' | 'non_piu' }
