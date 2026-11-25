// I 15 testi del percorso. Testi fissi, nessuna cifra dichiarata come fatto senza fonte.
import type { ArgomentoId, Fase } from './tipi';

export interface Lezione {
  id: ArgomentoId;
  numero: number;
  titolo: string;
  fase: Fase;
  inBreve: string; // 2-3 frasi
  esempio: string; // usato quando "Con i tuoi numeri" non ha dati; cifre dichiarate come esempio
  prova: { etichetta: string; href: string } | null;
  link: { etichetta: string; url: string }[]; // massimo 2
}

export const LEZIONI: Lezione[] = [
  {
    id: 'dove-vanno', numero: 1, fase: 'adesso',
    titolo: 'Dove vanno i soldi',
    inBreve:
      "Prima di cambiare qualcosa, basta guardare. Di solito ci sono poche voci grandi, come affitto, spesa e auto, e tante voci piccole che si ripetono. Gli spiccioli si guardano senza farne una colpa: sono un'informazione, e le voci grandi restano le più importanti.",
    esempio:
      'Esempio con cifre inventate: caffè 24 €, snack 26 €, due abbonamenti dimenticati 10 €, una consegna 14 €. Fanno circa 74 € in un mese. Non è un problema in sé: è un margine che puoi scegliere se tenere.',
    prova: { etichetta: 'Guarda le spese di questo mese e scegli una voce da osservare', href: '/history' },
    link: [],
  },
  {
    id: 'piano', numero: 2, fase: 'adesso',
    titolo: 'Un piano per ogni euro',
    inBreve:
      'Un piano di spesa non è un divieto: è decidere a cosa servono i soldi prima di averli in tasca. Il numero "libero" dell\'app è già questo: dai soldi che hai toglie quelli già promessi, e il resto lo scegli tu. Se i soldi non sono ancora arrivati, non si contano.',
    esempio:
      'Esempio con cifre inventate: entrano 1.150 €, la quota di casa è 560 €, il resto degli impegni 275 €. Restano 315 € liberi, e la scelta vera è su quelli.',
    prova: { etichetta: 'Guarda come si calcola il tuo libero', href: '/' },
    link: [{ etichetta: "L'economia per tutti (Banca d'Italia)", url: 'https://economiapertutti.bancaditalia.it/' }],
  },
  {
    id: 'spese-certe', numero: 3, fase: 'adesso',
    titolo: 'Le spese che arrivano di rado ma arrivano',
    inBreve:
      'Bollo, assicurazione, tagliando, gomme, un regalo: non cadono ogni mese, ma sono certe. Si dividono per i mesi che mancano e si mette da parte una piccola quota ogni mese. Così il giorno della scadenza il mese non salta.',
    esempio:
      "Esempio con cifre inventate: assicurazione 480 €, bollo 150 €, tagliando 250 €, gomme 200 € l'anno. Sono 1.080 € l'anno, cioè 90 € al mese.",
    prova: { etichetta: 'Scegli le tue spese certe e crea i fondi', href: '/impara/primi-passi/spese-certe' },
    link: [],
  },
  {
    id: 'imprevisti', numero: 4, fase: 'appena-entrano',
    titolo: 'Il cuscinetto per gli imprevisti',
    inBreve:
      "Il cuscinetto serve per ciò che non si può prevedere. Per capire se una spesa è un'emergenza, tre domande: è imprevedibile? È necessaria, cioè non rimandabile? Non c'è un altro modo di pagarla? Se tutte e tre sono sì, tocca al cuscinetto. Un primo gradino piccolo di solito pesa meno e si comincia prima di un grande traguardo lontano.",
    esempio:
      'Esempio con cifre inventate: se le spese essenziali sono 700 € al mese, un primo gradino di 300 € copre circa due settimane. Con 50 € al mese ci arrivi in 6 mesi.',
    prova: { etichetta: 'Crea il cuscinetto con un primo traguardo piccolo', href: '/impara/primi-passi/imprevisti' },
    link: [],
  },
  {
    id: 'prima-da-parte', numero: 5, fase: 'appena-entrano',
    titolo: 'Mettere da parte prima',
    inBreve:
      "Se si risparmia quello che avanza, spesso non avanza niente. Soldi messi da parte ma ancora visibili sembrano spendibili: è così che funziona la mente, non è mancanza di carattere. Per i cassetti con scadenza l'app toglie già ogni mese la quota dal libero. Il giorno in cui arriva un incasso, l'abitudine che aiuta è mettere da parte subito anche il cuscinetto.",
    esempio:
      'Esempio con cifre inventate: arrivano 1.150 € e metti da parte 50 € subito. Il libero parte da 1.100 € meno gli impegni: quei 50 € non si vedono più.',
    prova: { etichetta: 'Metti da parte la quota del mese', href: '/impara/primi-passi/imprevisti' },
    link: [],
  },
  {
    id: 'impulso', numero: 6, fase: 'appena-entrano',
    titolo: "Gli acquisti d'impulso",
    inBreve:
      "Un acquisto d'impulso è deciso in pochi secondi e ripensato dopo. Un trucco semplice è scrivere la cosa in una lista invece di comprarla, e riguardarla dopo una settimana. Spesso un desiderio passa; quelli che restano si comprano con più serenità. Il desiderio resta valido.",
    esempio:
      'Esempio con cifre inventate: cuffie da 60 € viste con 315 € liberi. Dopo 7 giorni le vuoi ancora? Il libero scende a 255 € e le compri. Se no, i 60 € restano tuoi.',
    prova: { etichetta: "Aggiungi una cosa che ti attira alla lista d'attesa", href: '/impara/attesa' },
    link: [],
  },
  {
    id: 'bisogni-desideri', numero: 7, fase: 'dopo',
    titolo: 'Bisogni, desideri e regole pratiche',
    inBreve:
      "Tra bisogno e desiderio non c'è una linea netta: dipende dalla persona. La regola 50/30/20 (metà ai bisogni, il 30% ai desideri, il 20% da parte) dà solo un ordine di grandezza. Con un affitto in città il tuo piano può essere diverso, e va bene.",
    esempio:
      'Esempio con cifre inventate: su 1.150 € la regola direbbe 575 € ai bisogni. Casa e spese di base fanno 725 €, il 63%. Per molte persone con un affitto è così.',
    prova: { etichetta: 'Guarda come si divide il tuo mese', href: '/history' },
    link: [],
  },
  {
    id: 'reddito-irregolare', numero: 8, fase: 'appena-entrano',
    titolo: 'Quando le entrate non sono sempre uguali',
    inBreve:
      'Se un mese entra molto e un altro poco, è facile calibrare le spese sul mese buono. Un modo semplice: scegliere un reddito base prudente, sotto la media e vicino ai mesi più scarsi, e vivere su quello. Nei mesi buoni, il di più va nel cuscinetto. Per le tasse e le scadenze di chi ha la P.IVA, la risposta giusta è quella di chi ti segue per le tasse.',
    esempio:
      'Esempio con cifre inventate: negli ultimi sei mesi entrano 1.400, 600, 2.200, 900, 1.800 e 1.100 €. Il minimo è 600 €. Un reddito base prudente può essere 900 €.',
    prova: { etichetta: 'Guarda le tue entrate e scegli un reddito base', href: '/impara/primi-passi/entrate' },
    link: [],
  },
  {
    id: 'debiti-rate', numero: 9, fase: 'adesso',
    titolo: 'Rate e debiti: leggere prima',
    inBreve:
      'Una rata è denaro di domani speso oggi, e occupa il tuo margine per tutti i mesi della rata. Anche "senza interessi" la rata pesa. Prima di firmare si chiede il TAEG (il costo totale all\'anno, spese comprese), il totale da restituire e se si può chiudere prima. Conta il totale, non la rata.',
    esempio:
      'Esempio con cifre inventate: un finanziamento di 1.200 € in 12 rate da 110 € restituisce 1.320 €. Il costo è 120 €. Il TAEG però è più alto del 10%, perché il debito scende ogni mese: per questo conviene chiederlo e non calcolarlo a mano.',
    prova: { etichetta: 'Registra la rata come impegno, così il libero la tiene già da parte', href: '/goals' },
    link: [
      { etichetta: "Guide della Banca d'Italia in parole semplici", url: 'https://www.bancaditalia.it/pubblicazioni/guide-bi/index.html' },
      { etichetta: 'Arbitro Bancario Finanziario', url: 'https://www.arbitrobancariofinanziario.it' },
    ],
  },
  {
    id: 'truffe', numero: 10, fase: 'adesso',
    titolo: 'Truffe e messaggi falsi',
    inBreve:
      "Le truffe imitano la banca, le poste o un corriere e hanno fretta. Quattro segnali: urgenza, un link da aprire, la richiesta di codici o password, la promessa di guadagni facili. Se ne vedi uno, ferma tutto, apri tu l'app della banca e non rispondere. Se è già successo, chiama subito la banca per bloccare la carta, poi la Polizia postale.",
    esempio:
      "Esempio: \"Il tuo conto verrà sospeso, conferma qui\". Non cliccare. Apri l'app della banca: se c'è un problema, lo trovi anche lì.",
    prova: null,
    link: [
      { etichetta: "Cosa fare se si viene truffati (Banca d'Italia)", url: 'https://www.bancaditalia.it/focus/cybersicurezza/truffe-cyber' },
      { etichetta: 'Occhio alle truffe (Consob)', url: 'https://www.consob.it/web/investor-education/' },
    ],
  },
  {
    id: 'coppia', numero: 11, fase: 'dopo',
    titolo: 'Parlare di soldi in due',
    inBreve:
      "Parlare di soldi è più facile se si parte dai numeri e non dai giudizi. Dire all'altra persona quanto è libero e quanto è già impegnato evita di spiegare ogni acquisto. Una domanda semplice per cominciare: cosa vuoi che i soldi comuni coprano, e cosa vuoi tenere tuo?",
    esempio:
      'Esempio: a fine mese vi sedete cinque minuti. Ognuno dice cosa è andato bene e una cosa che vuole cambiare. Niente di più.',
    prova: { etichetta: 'Guarda la quota della casa', href: '/casa/quota' },
    link: [],
  },
  {
    id: 'assicurazioni', numero: 12, fase: 'dopo',
    titolo: 'Assicurazioni di base',
    inBreve:
      "Un'assicurazione costa poco e con certezza, per non pagare tanto in un caso raro. La domanda utile è: se succedesse, potrei pagarlo da solo? L'assicurazione auto è obbligatoria per chi ha un'auto o una moto; per la casa in affitto la polizza è facoltativa. Tre parole: massimale (il tetto del rimborso), franchigia (la parte che resta a te), esclusioni (ciò che non è coperto).",
    esempio:
      "Esempio con cifre inventate: una polizza casa da 100 € l'anno sono circa 8 € al mese. Un danno ai mobili del vicino senza polizza potrebbe costare molto di più.",
    prova: { etichetta: "Aggiungi l'assicurazione alle tue spese certe", href: '/impara/primi-passi/spese-certe' },
    link: [{ etichetta: 'Guida per i consumatori (IVASS)', url: 'https://www.ivass.it/consumatori/index.html' }],
  },
  {
    id: 'inflazione', numero: 13, fase: 'dopo',
    titolo: 'Perché i prezzi salgono',
    inBreve:
      "L'inflazione è un aumento dei prezzi in generale, che dura nel tempo. Con gli stessi euro, tra qualche anno si compra un po' meno. Non è un motivo per correre a investire: il cuscinetto serve a essere pronto, non a crescere.",
    esempio:
      'Esempio con cifre inventate: un cuscinetto di 700 € con inflazione al 2% perde circa 14 € di potere d\'acquisto in un anno. Un guasto da 700 € pagato a rate costerebbe in più gli interessi.',
    prova: null,
    link: [{ etichetta: "L'economia per tutti (Banca d'Italia)", url: 'https://economiapertutti.bancaditalia.it/' }],
  },
  {
    id: 'risparmio-investimento', numero: 14, fase: 'dopo',
    titolo: 'Risparmiare e investire',
    inBreve:
      "Risparmiare è non spendere ora per usare dopo. Investire è mettere soldi in qualcosa che può valere di più o di meno nel tempo. Rischio vuol dire che il risultato non è sicuro e che si può perdere una parte dei soldi. Tre domande prima di qualunque scelta: a cosa mi serve? Quando mi servirà? Posso permettermi che valga meno proprio quel giorno? Ciò che serve nei prossimi mesi non si investe.",
    esempio:
      "Esempio con cifre inventate: 300 € sul conto con un interesse dell'1% fanno circa 3 € in un anno. Il punto non è guadagnare: quei 300 € servono per gli imprevisti.",
    prova: null,
    link: [
      { etichetta: 'Finanza in pratica (Consob)', url: 'https://www.consob.it/web/investor-education/' },
      { etichetta: "L'economia per tutti (Banca d'Italia)", url: 'https://economiapertutti.bancaditalia.it/' },
    ],
  },
  {
    id: 'pensione', numero: 15, fase: 'dopo',
    titolo: 'La pensione, per sapere',
    inBreve:
      "In Italia la pensione dipende dai contributi versati negli anni. I contributi possono stare in più posti: controllarli una volta l'anno aiuta. Per sapere dove stanno i tuoi, li vedi su MyINPS con SPID; per i dubbi, un patronato o chi ti segue per le tasse.",
    esempio:
      "Esempio: una volta l'anno, quindici minuti. Accedi con SPID, guardi che i contributi risultino, salvi una schermata.",
    prova: null,
    link: [{ etichetta: 'INPS', url: 'https://www.inps.it' }],
  },
  {
    id: 'aiuti', numero: 16, fase: 'dopo',
    titolo: 'Gli aiuti che si chiedono',
    inBreve:
      "Alcuni aiuti arrivano da soli, se l'ISEE rientra nella soglia: il bonus sociale per luce, gas e acqua, per esempio, parte con la DSU. Altri invece vanno chiesti, con moduli e scadenze del comune. Controllarli una volta l'anno, con calma, aiuta a non perderli.",
    esempio:
      'Nel 2026 il bonus sociale ARERA è previsto per un ISEE fino a 9.796 € (20.000 € con almeno quattro figli a carico). Uno sconto da chiedere è invece, per esempio, quello sulla TARI del comune: ha le sue regole e le sue scadenze. Altri aiuti hanno soglie diverse: per questo la pagina li elenca uno per uno.',
    prova: { etichetta: 'Guarda quali aiuti potrebbero riguardarti', href: '/agevolazioni' },
    link: [
      { etichetta: 'INPS: tipologie di ISEE', url: 'https://www.inps.it/it/it/dettaglio-approfondimento.schede-informative.49936.tipologie-di-isee.html' },
      { etichetta: 'ARERA: bonus sociali 2026', url: 'https://www.arera.it/comunicati-stampa/dettaglio/bonus-sociali-arera-alza-a-9796-euro-la-soglia-isee-per-laccesso-alle-agevolazioni-per-acqua-luce-gas-e-rifiuti' },
    ],
  },
];

export function lezione(id: ArgomentoId): Lezione {
  const l = LEZIONI.find((x) => x.id === id);
  if (!l) throw new Error(`Lezione sconosciuta: ${id}`);
  return l;
}
