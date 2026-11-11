import { formatEuro, nomeMese } from '@/lib/format';

export type TipoNotifica = 'spese' | 'checkin' | 'versamento';
export interface Notifica {
  tipo: TipoNotifica;
  titolo: string;
  testo: string;
  url: string;
}

// Tutte le date sono giorni di calendario Europe/Rome 'YYYY-MM-DD'; i mesi 'YYYY-MM-01'.
export interface StatoPersona {
  userId: string;
  iscritta: boolean; // almeno una riga in push_iscrizioni
  notificheAttive: boolean | null;
  ultimaCreazione: string | null; // giorno dell'ultima transazione creata, ogni spazio
  ultimaSpeseIl: string | null;
  ultimaCheckinIl: string | null;
  ultimoVersamentoMese: string | null;
  ultimaNotificaIl: string | null; // giorno dell'ultima notifica di qualsiasi tipo
  nessunaSpesaFinoAl: string | null;
  gestisce: boolean;
  checkinDaFare: string | null;
  versamento: { giorno: number; importo: number; versato: number; mese: string } | null;
}

const GIORNI_VERSAMENTO_PREAVVISO = 3;
const GIORNI_TRA_RIPETIZIONI = 3;
const GIORNI_SENZA_SPESE = 2;
const TITOLO = 'Budget';

// Giorni di calendario fra due date YYYY-MM-DD, via UTC: nessun fuso li sposta.
function giorniTra(da: string, a: string): number {
  return (Date.parse(`${a}T00:00:00Z`) - Date.parse(`${da}T00:00:00Z`)) / 86_400_000;
}

function giornoDopo(giorno: string): string {
  return new Date(Date.parse(`${giorno}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
}

const euro = (n: number): string => formatEuro(n).replace(',00', '');
const maiuscola = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

// Dal giorno dopo l'ultimo coperto (transazione o "non ho speso") fino a oggi.
// null se non c'è mai stata una transazione, o se l'ultimo coperto è ieri o oggi.
export function periodoDaRecuperare(
  ultimaCreazione: string | null,
  nessunaSpesaFinoAl: string | null,
  oggi: string,
): { dal: string; al: string } | null {
  if (!ultimaCreazione) return null;
  const coperto =
    nessunaSpesaFinoAl && nessunaSpesaFinoAl > ultimaCreazione ? nessunaSpesaFinoAl : ultimaCreazione;
  if (giorniTra(coperto, oggi) < GIORNI_SENZA_SPESE) return null;
  return { dal: giornoDopo(coperto), al: oggi };
}

const passatiAlmeno3 = (giorno: string | null, oggi: string): boolean =>
  giorno === null || giorniTra(giorno, oggi) >= GIORNI_TRA_RIPETIZIONI;

// Al massimo una notifica al giorno per persona, in quest'ordine: versamento, check-in, spese.
export function decidiNotifica(p: StatoPersona, oggi: string): Notifica | null {
  if (!p.iscritta || p.notificheAttive !== true) return null;
  if (p.ultimaNotificaIl === oggi || p.ultimaSpeseIl === oggi || p.ultimaCheckinIl === oggi) {
    return null;
  }

  const v = p.versamento;
  if (v && v.versato < v.importo && p.ultimoVersamentoMese !== v.mese) {
    const mese = v.mese.slice(0, 7);
    const primo = `${mese}-${String(Math.max(1, v.giorno - GIORNI_VERSAMENTO_PREAVVISO)).padStart(2, '0')}`;
    const ultimo = `${mese}-${String(v.giorno).padStart(2, '0')}`;
    if (oggi >= primo && oggi <= ultimo) {
      return {
        tipo: 'versamento',
        titolo: TITOLO,
        testo: `La tua quota di ${nomeMese(v.mese)}: ${euro(v.importo)} entro il ${v.giorno}.`,
        url: '/casa',
      };
    }
  }

  if (p.gestisce && p.checkinDaFare && passatiAlmeno3(p.ultimaCheckinIl, oggi)) {
    return {
      tipo: 'checkin',
      titolo: TITOLO,
      testo: `${maiuscola(nomeMese(p.checkinDaFare))} è chiuso: controlliamolo in 2 minuti.`,
      url: '/casa/controllo',
    };
  }

  if (
    periodoDaRecuperare(p.ultimaCreazione, p.nessunaSpesaFinoAl, oggi) &&
    passatiAlmeno3(p.ultimaSpeseIl, oggi)
  ) {
    return {
      tipo: 'spese',
      titolo: TITOLO,
      testo: 'Sono due giorni senza spese segnate. Ti va di rimetterti in pari? Ci vuole un minuto.',
      url: '/in-pari',
    };
  }

  return null;
}
