// Le 9 voci. Testi fissi, controllati sulle fonti ufficiali il 2026-11-23.
// Ogni cifra porta il suo anno. Nessun consiglio fiscale personalizzato.
import type { Voce } from './tipi';

const CONTROLLATO = '2026-11-23';

export const VOCI: Voce[] = [
  {
    id: 'isee-dsu',
    titolo: 'ISEE e DSU',
    perche:
      "L'ISEE misura la situazione economica del nucleo e serve per quasi tutti gli aiuti di questa pagina. Si ottiene presentando la DSU.",
    come: 'su-domanda',
    cosaFare: [
      "Presenta la DSU sul sito dell'INPS con SPID, CIE o CNS, oppure da un CAF: per ISEE e DSU il CAF è gratuito.",
      "L'ISEE scade il 31 dicembre: a gennaio si rifà la DSU.",
      "Il nucleo è quello del tuo stato di famiglia: se cambia la residenza o la convivenza registrata, cambia anche l'ISEE. Per i dubbi, un CAF.",
    ],
    cercare: 'DSU precompilata INPS',
    link: {
      testo: 'INPS: tipologie di ISEE',
      href: 'https://www.inps.it/it/it/dettaglio-approfondimento.schede-informative.49936.tipologie-di-isee.html',
    },
    controllatoIl: CONTROLLATO,
    validaFinoAl: null,
    soglia: null,
    annuale: true,
    meseBando: null,
    mostra: () => true,
  },
  {
    id: 'bonus-sociale',
    titolo: 'Bonus sociale luce, gas, acqua e rifiuti',
    perche:
      'Uno sconto sulle bollette per le famiglie con ISEE basso. Nel 2026 la soglia è 9.796 €. Per i rifiuti lo sconto è del 25% sulla TARI.',
    come: 'automatica',
    cosaFare: [
      'Non serve fare domanda: basta avere una DSU valida presentata.',
      "Lo sconto arriva in bolletta. Quello sui rifiuti di solito arriva l'anno dopo, in base all'ISEE dell'anno prima.",
      "Per i dubbi sul nucleo o sull'intestatario della bolletta, un CAF.",
    ],
    cercare: 'bonus sociale ARERA ISEE',
    link: {
      testo: 'ARERA: bonus sociali, soglia 2026',
      href: 'https://www.arera.it/comunicati-stampa/dettaglio/bonus-sociali-arera-alza-a-9796-euro-la-soglia-isee-per-laccesso-alle-agevolazioni-per-acqua-luce-gas-e-rifiuti',
    },
    controllatoIl: CONTROLLATO,
    validaFinoAl: null,
    soglia: { anno: 2026, valore: 9796 },
    annuale: false,
    meseBando: null,
    mostra: () => true,
  },
  {
    id: 'tari-comune',
    titolo: 'Sconto TARI del comune',
    perche:
      'Oltre al bonus nazionale, molti comuni scontano la tassa sui rifiuti a chi ha un ISEE basso. Le regole cambiano da comune a comune.',
    come: 'su-domanda',
    cosaFare: [
      'Cerca il modulo delle agevolazioni TARI sul sito del tuo comune.',
      "Guarda la scadenza: di solito è una data precisa, spesso nei primi mesi dell'anno.",
      'Tieni pronta una DSU in corso di validità.',
    ],
    cercare: 'modulo agevolazioni TARI {comune}',
    link: null,
    controllatoIl: CONTROLLATO,
    validaFinoAl: null,
    soglia: null,
    annuale: true,
    meseBando: null,
    mostra: () => true,
  },
  {
    id: 'contributo-affitto',
    titolo: 'Contributo affitto',
    perche:
      'Alcuni comuni e regioni aprono ogni anno un bando per chi è in affitto con un ISEE basso. Soglie e date cambiano da bando a bando.',
    come: 'su-domanda',
    cosaFare: [
      'Cerca il bando sul sito del comune o della regione.',
      'Guarda la scadenza e i documenti richiesti: di solito servono un contratto registrato e una DSU valida.',
    ],
    cercare: 'bando contributo affitto {comune}',
    link: null,
    controllatoIl: CONTROLLATO,
    validaFinoAl: null,
    soglia: null,
    annuale: true,
    meseBando: null,
    mostra: (s) => s.inAffitto === true,
  },
  {
    id: 'dedicata-a-te',
    titolo: 'Carta "Dedicata a te"',
    perche:
      'Una carta prepagata con 500 € in un anno per la spesa alimentare di base, per il 2026 e il 2027. Nel 2026 serve un ISEE ordinario fino a 15.000 €.',
    come: 'automatica',
    cosaFare: [
      "Non c'è domanda: l'INPS individua i beneficiari e i comuni pubblicano le liste.",
      'Cerca la lista del tuo comune. Il primo utilizzo è entro il 16 dicembre 2026, il secondo accredito da aprile 2027.',
      'Restano fuori, tra gli altri, i nuclei con Assegno di inclusione o Carta acquisti. Per i dubbi, un CAF.',
    ],
    cercare: 'Dedicata a te lista beneficiari {comune}',
    link: {
      testo: 'INPS: Dedicata a te 2026-2027',
      href: 'https://www.inps.it/it/it/inps-comunica/notizie/dettaglio-news-page.news.2026.09.carta-dedicata-a-te-modalit-operative-per-il-2026-2027.html',
    },
    controllatoIl: CONTROLLATO,
    validaFinoAl: '2027-12-31',
    soglia: { anno: 2026, valore: 15000 },
    annuale: false,
    meseBando: null,
    mostra: () => true,
  },
  {
    id: 'trasporto',
    titolo: 'Trasporto pubblico agevolato',
    perche:
      "Alcune regioni e aziende di trasporto offrono abbonamenti scontati per ISEE basso o per studenti. Le regole sono locali.",
    come: 'su-domanda',
    cosaFare: [
      "Guarda il sito dell'azienda di trasporto della tua città, alla pagina degli abbonamenti agevolati.",
      'Controlla se chiedono la DSU o un certificato di iscrizione.',
    ],
    cercare: 'abbonamento agevolato ISEE trasporti {comune}',
    link: null,
    controllatoIl: CONTROLLATO,
    validaFinoAl: null,
    soglia: null,
    annuale: true,
    meseBando: null,
    mostra: (s) => s.isee !== null || s.studente === true,
  },
  {
    id: 'dottorato',
    titolo: 'Borsa di dottorato: tasse e contributi',
    perche:
      "La borsa di dottorato ha regole sue su contributi e imposte, e conta in modo particolare nell'ISEE.",
    come: 'informativa',
    cosaFare: [
      "I contributi vanno alla gestione separata INPS: di solito l'ateneo versa la sua parte.",
      "Per le imposte e per sapere se serve il 730, chiedi all'ufficio dottorato o a un CAF.",
    ],
    cercare: 'borsa dottorato INPS gestione separata',
    link: null,
    controllatoIl: CONTROLLATO,
    validaFinoAl: null,
    soglia: null,
    annuale: false,
    meseBando: null,
    mostra: (s) => s.studente === true,
  },
  {
    id: 'detrazione-affitto',
    titolo: 'Detrazione per chi è in affitto',
    perche:
      'Esistono detrazioni nella dichiarazione dei redditi per chi paga un affitto con contratto registrato. Dipendono dal reddito e dal tipo di contratto.',
    come: 'informativa',
    cosaFare: [
      "Leggi la scheda dell'Agenzia delle Entrate: è del 2023, quindi le cifre potrebbero essere cambiate.",
      'Per capire se riguarda la tua situazione, chiedi a un CAF.',
    ],
    cercare: 'detrazione affitto inquilini 730',
    link: {
      testo: 'Agenzia delle Entrate: detrazioni canoni di locazione (scheda 2023)',
      href: 'https://www.agenziaentrate.gov.it/portale/documents/20143/5629825/Detrazioni+per+canoni+di+locazione_tabella_aggiornata.pdf/f76fe2b8-ecab-9d12-1986-752885a8b95a',
    },
    controllatoIl: CONTROLLATO,
    validaFinoAl: null,
    soglia: null,
    annuale: false,
    meseBando: null,
    mostra: (s) => s.inAffitto === true,
  },
  {
    id: 'scadenze-piva',
    titolo: 'Le scadenze della P.IVA',
    perche:
      "Chi ha la partita IVA ha scadenze fisse nell'anno. Stanno già nella pagina P.IVA, con i pezzi da mettere da parte.",
    come: 'collegamento',
    cosaFare: ['Apri la pagina P.IVA e guarda la prossima scadenza.', 'Per le cifre da versare, il commercialista.'],
    cercare: null,
    link: { testo: 'Vai alla pagina P.IVA', href: '/piva' },
    controllatoIl: CONTROLLATO,
    validaFinoAl: null,
    soglia: null,
    annuale: false,
    meseBando: null,
    mostra: (s) => s.piva,
  },
];
