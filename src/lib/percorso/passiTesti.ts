// Testi dei primi passi e lezione che li spiega (un minuto di lettura prima dell'azione).
import type { ArgomentoId, PassoId } from './tipi';

export interface TestoPasso {
  titolo: string;
  riga: string;
  lezioni: ArgomentoId[];
}

export const PASSI_TESTI: Record<PassoId, TestoPasso> = {
  conti: { titolo: 'I tuoi conti', riga: 'Aggiungi il conto dove stanno i tuoi soldi.', lezioni: ['piano'] },
  entrate: {
    titolo: 'Come entrano i soldi',
    riga: 'Dicci se le entrate sono fisse, irregolari o con P.IVA.',
    lezioni: ['piano', 'reddito-irregolare'],
  },
  piva: { titolo: 'La tua P.IVA', riga: 'Una guida per mettere da parte le tasse.', lezioni: ['reddito-irregolare'] },
  settimana: { titolo: 'Una settimana di spese', riga: 'Segna le spese per sette giorni e guardiamo insieme.', lezioni: ['dove-vanno'] },
  'spese-certe': {
    titolo: 'Le spese che arrivano di rado',
    riga: 'Assicurazione, bollo, gomme: un fondo per ognuna.',
    lezioni: ['spese-certe'],
  },
  imprevisti: { titolo: 'Il cuscinetto per gli imprevisti', riga: 'Una piccola somma da parte per quando serve.', lezioni: ['imprevisti'] },
  obiettivo: { titolo: 'Un cassetto tuo', riga: 'Qualcosa a cui vuoi arrivare.', lezioni: ['piano'] },
};

export const PASSI_ID = Object.keys(PASSI_TESTI) as PassoId[];
