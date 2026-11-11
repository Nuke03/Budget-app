# App di supporto: andamento, consiglio, promemoria e Casa più leggera

Data: 11 novembre 2026. Blocco 2 della roadmap (Design e UX), parte "flussi".
Deciso con Fabio nel brainstorming dell'11 novembre. La grafica e lo stile non
sono qui: si fanno dopo con `/impeccable:impeccable` (audit, `DESIGN.md`, palette).

## Perché

Fabio si è sentito spaesato fin da subito. Le informazioni sono sparse e tocca a
lui ragionarci sopra e collegarle. Segnare ogni spesa è un piccolo lavoro. La sua
frase guida: l'app deve "essere di supporto e aiutarti a gestire, non diventare a
sua volta un lavoro". L'app deve anche guidarlo passo passo e insegnargli
l'economia di casa. Questo è l'obiettivo trasversale della roadmap.

Per la Casa, Fabio e la compagna oggi usano Tricount. Quando la Casa sarà avviata,
Tricount verrà abbandonato. Chi tiene i conti è Fabio. Lei usa Tricount solo quando
sono insieme e lui le dice "fai qua". Fabio ha provato da solo il piano della
quota, il check-in e Da parte, senza particolari difficoltà.

## Cosa deve fare l'app quando la apri

1. **L'andamento:** come stai andando.
2. **Un consiglio:** una sola cosa da migliorare, legata ai tuoi numeri.
3. **Un promemoria** quando qualcosa resta indietro. Va anche fuori dall'app,
   perché un promemoria che vedi solo aprendo l'app non lo vedi proprio quando ti
   servirebbe. Deve arrivare di rado.

## Obiettivi

- Registrare una spesa, personale o di casa, chiede solo l'importo. Il resto si
  compila da solo e si corregge con un tocco. L'obiettivo della roadmap resta
  sotto i 10 secondi.
- La Home mostra l'andamento del mese e un consiglio.
- Quando per 2 giorni non segni spese arriva una notifica sul telefono. La
  notifica apre un riepilogo che ti rimette in pari in un minuto.
- La pagina Casa mostra una cosa sola da fare alla volta. Il resto sta dietro
  "Dettagli".
- La compagna ha una vista semplice: quanto versare e quando, se siete in pari, e
  il pulsante per aggiungere una spesa.
- Il passaggio da Tricount chiede solo il saldo di oggi.

## Non obiettivi

- L'aspetto: colori, caratteri e componenti li decidono l'audit e `DESIGN.md`.
- La parte P.IVA guidata e il percorso di apprendimento: qui si riserva solo il
  loro posto (vedi "Spazi riservati").
- L'importazione della storia di Tricount.
- I collegamenti con la banca. Restano esclusi, come da PRODUCT.md.
- Rifare il piano della quota, il check-in o Da parte da zero.

## Anti-obiettivi (fallimento anche se funziona)

- **Notifiche fastidiose.** Il limite è una ogni 3 giorni per il promemoria
  delle spese, e mai di notte.
- **Numeri inventati.** L'app non divide una stima fra categorie che non
  conosce.
- **Senso di colpa o gamification** nei testi. La guardia statica sulle parole
  vietate resta attiva e deve passare.
- **Lavoro doppio**, cioè dover segnare le stesse cose in due posti.
- **Pagine segnaposto vuote** visibili all'utente.

## Vincoli

- Next.js 16 come da `AGENTS.md`: prima di scrivere codice leggere
  `node_modules/next/dist/docs/`, in particolare la guida PWA e service worker.
- Supabase e Vercel restano sul piano gratuito. Nessuna integrazione Google.
- Le modifiche al database vanno in `supabase/migrations/0009_*.sql`, che Fabio
  lancia a mano. Le migrazioni dalla 0001 alla 0008 non si toccano.
- I telefoni sono iPhone e l'app è installata nella schermata Home (PRODUCT.md).
  Le notifiche web su iPhone funzionano solo con l'app installata, da iOS 16.4.
  Il permesso si chiede solo dopo un tocco dell'utente. Il funzionamento in
  Europa va verificato sul telefono di Fabio: è il motivo del passo 0.
- I dati personali non sono mai visibili agli altri membri della casa (RLS, come
  da PRODUCT.md).
- Testi in italiano semplice, senza gergo.

## Approcci considerati

- **A, a pezzi, ognuno usabile subito (scelto da Fabio).** L'ordine è: aggiunta
  veloce, Home, Casa, notifiche e riepilogo, preceduti da una prova delle
  notifiche. Ogni pezzo si prova sul telefono prima del successivo. Il contro è
  che le notifiche arrivano per ultime.
- **B, prima notifiche e riepilogo.** Parte dalla novità più grande, ma poggia
  sulla parte più incerta (le notifiche su iPhone in Europa) e su schermate che
  poi cambiano.
- **C, una Home unica "Oggi" che unisce personale e casa.** È più coerente, ma
  per settimane non c'è niente di usabile, e mescola due spazi che sono separati
  di proposito. Scartato.

## Ordine nel blocco 2

0. **Prova usa e getta delle notifiche:** un pulsante nascosto manda una notifica
   di prova al telefono di Fabio. Serve a capire se in Europa funziona. Il codice
   non si tiene. Se non funziona, il pezzo 4 resta valido, ma il promemoria
   compare solo dentro l'app: in cima alla Home, all'apertura. Il resto del design
   non cambia.
1. Aggiornare `PRODUCT.md` con questo documento: la co-gestione, la sostituzione
   di Tricount, i ruoli in casa, le notifiche.
2. Fare l'audit con `/impeccable:impeccable`, poi scrivere `DESIGN.md`.
3. Costruire i pezzi da 1 a 4 nel nuovo design.
4. Proseguire con il resto del blocco: correzioni schermata per schermata,
   eliminazioni con annullamento e, per ultimo, il cambio di palette.

## Pezzo 1: aggiunta veloce

Riguarda `AddTransactionSheet` e `AddTransactionForm`, che oggi servono sia la
parte personale sia la Casa.

- **Il foglio** si apre con il campo importo già selezionato. L'importo è l'unico
  campo obbligatorio.
- **Riga di riepilogo:** sotto l'importo, ad esempio "Spesa · Casa · pagata da te
  · Spesa alimentare". Ogni pezzo si tocca per cambiarlo. Oggi gli stessi campi
  sono tutti aperti e in vista.
- **Personale o Casa:** si apre sull'ultima scelta. La logica esiste già in
  `aggiungiModo`.
- **Chi ha pagato** (Casa) e **conto** (personale): si apre sull'ultimo usato. In
  Casa, la prima volta vale "Io, con <conto>" se non c'è un conto comune, come
  oggi.
- **Categoria:** se la descrizione è uguale a una spesa passata, si usa la
  categoria di quella. Altrimenti la più usata negli ultimi 30 giorni nello stesso
  spazio. Se non ci sono spese, nessuna categoria.
- **Descrizione e obiettivo/Da parte:** facoltativi, dietro la riga di riepilogo.
  In Casa l'obiettivo oggi è preselezionato (`preselezionaObiettivo`): resta così,
  ma si vede solo nella riga.
- **Salva:** un solo tocco. I saldi si aggiornano come oggi (`adjustAccountBalance`).

## Pezzo 2: Home con andamento e consiglio

**Andamento (solo spese personali):**
- Si confronta lo speso dall'inizio del mese a oggi con lo speso medio allo
  stesso giorno del mese negli ultimi 3 mesi completi.
- Si conta ogni mese completo disponibile, quindi dai 3 in giù. Con meno di un
  mese completo la Home dice: "Dal prossimo mese ti mostro come stai andando
  rispetto al solito."
- Esempio di frase: "Hai speso 340 €. Di solito a quest'ora sei a 300 €." Accanto
  c'è un piccolo grafico: la linea di questo mese e quella del solito, giorno per
  giorno.
- Le stime del riepilogo (pezzo 4) contano nel totale.
- Il "disponibile libero" resta la cifra principale, come da PRODUCT.md.
  L'andamento sta sotto e non lo sostituisce.

**Consiglio:**
- Uno solo, scelto con regole fisse (niente IA), nell'ordine qui sotto. Si mostra
  il primo che vale.
- Le soglie sono una mia scelta. Si correggono senza cambiare il design.

| # | Quando vale | Esempio di testo |
|---|---|---|
| 1 | Le spese "senza dettaglio" superano il 20% dello speso del mese | "Questo mese 120 € sono senza dettaglio. Segnare le spese il giorno stesso ti dice dove vanno." |
| 2 | Una categoria è sopra il solito di almeno il 25% e di almeno 30 € (la differenza più grande) | "La spesa fuori è a 120 €, di solito a quest'ora 70 €." |
| 3 | Un obiettivo dilazionato non riceverà abbastanza prima della scadenza | Frase da costruire su `computeQuotaMensile` |
| 4 | Nessuna delle precedenti | Un rinforzo neutro senza lode esagerata, più una cosa da sapere presa da `docs/research/2026-11-08-economia-domestica.md` |

- **"Perché?":** ogni consiglio ha un collegamento con questo nome. Oggi apre una
  spiegazione nello stile di `ComeSiCalcola`. Quando esiste il percorso, porta alla
  lezione giusta.

## Pezzo 3: Casa più leggera

**Chi gestisce:** chi ha creato la casa (`households.created_by`). Non serve una
nuova colonna. Gli altri membri vedono la vista semplice, e un link "Vedi tutto"
porta alla vista completa. Non si nasconde niente: la RLS resta quella di oggi.

**Vista di chi gestisce (`CasaHome`):**
- **In alto:** il disponibile di casa e l'andamento del mese (spese di casa
  rispetto alle voci mensili del piano in vigore).
- **"Da fare":** al massimo 1 promemoria. È il primo dell'elenco già calcolato da
  `computeReminders`, mostrato con `StrisciaPromemoria`, che oggi ne mostra fino a 2.
- **Accantonamento come promemoria:** si aggiunge quello del mese, ad esempio
  "Metti da parte 85 € per le bollette (luce 40 €, gas 45 €)", con il pulsante
  "Fatto". La logica è quella di oggi in `DaParte`.
- **Ultime 3 spese di casa.**
- **"Dettagli ›":** porta a una pagina con conto comune, chi c'è, la quota, Da
  parte e le impostazioni. Contiene i blocchi che oggi stanno impilati sulla
  pagina Casa.

**Vista della compagna (membro che non gestisce):**
- "La tua quota: X € entro il giorno N", presa dal piano in vigore.
- "Siete in pari", oppure "Devi X € a Fabio" / "Fabio ti deve X €", con i
  crediti e i debiti calcolati oggi.
- Il pulsante "+ Spesa di casa", con il foglio del pezzo 1 già su Casa e
  "pagata da te".
- La prima volta: invito, ingresso, poi direttamente questa vista. Niente
  configurazione.

**Piano della quota:**
- Resta in 5 passi, ma ogni passo parte già compilato con valori sensati, così si
  può andare avanti senza scrivere. Chi costruisce verifica passo per passo cosa
  manca oggi.
- Fabio può scrivere il reddito della compagna finché lei non è entrata: è lo slot
  segnaposto che esiste già. Dopo, lo corregge lei.

**Check-in:** il flusso non cambia. Cambia l'accesso: diventa il "Da fare" di
inizio mese e una notifica per chi gestisce (pezzo 4).

**Da parte:** la pagina resta com'è, raggiungibile da Dettagli. L'azione del mese
passa nel "Da fare".

**Passaggio da Tricount:**
- Una voce in impostazioni e in `inizia`: "Venite da Tricount? Scrivi il saldo di
  oggi", per esempio "lei mi deve 43 €".
- Il saldo diventa un credito o debito di partenza tra i membri.
- **Vincolo di correttezza:** non deve contare come spesa del mese, né
  nell'andamento, né nel check-in, né nel disponibile di casa.
- Come rappresentarlo nel modello esistente (`transfers` con
  `solo_registrazione`, oppure un nuovo valore di `origine`) lo decide chi
  costruisce. Se serve uno schema nuovo va nella 0009. Revisione con sonnet.

## Pezzo 4: notifiche e riepilogo

**Permesso:**
- Si chiede da una scheda in Home: "Vuoi che ti avvisi se resti indietro con le
  spese?", con il pulsante "Sì, avvisami". Compare solo con l'app installata
  (`display-mode: standalone`).
- Su iPhone con l'app aperta in Safari, la scheda spiega come aggiungerla alla
  schermata Home.
- Se Fabio dice no, la scheda non torna. Si riattiva dalle impostazioni.

**Cosa parte e a chi:** al massimo una notifica per persona al giorno.

| Notifica | A chi | Quando | Testo |
|---|---|---|---|
| Spese | Ogni persona iscritta | Nessuna transazione creata da lei, in nessuno spazio, negli ultimi 2 giorni, e nessuna notifica di questo tipo negli ultimi 3 giorni | "Sono due giorni senza spese segnate. Ti va di rimetterti in pari? Ci vuole un minuto." |
| Check-in | Chi gestisce la casa | C'è un mese chiuso da controllare (`meseDaControllare`), al massimo una volta ogni 3 giorni | Per esempio "Ottobre è chiuso: controlliamolo in 2 minuti." |
| Versamento | Ogni membro | 3 giorni prima del giorno di versamento, se la quota del mese non è ancora versata, una sola volta al mese | "La tua quota di novembre: 650 € entro il 5." |

- Il "Non ho speso niente" del riepilogo conta come spese segnate fino a oggi.
- Il tocco sulla notifica apre il riepilogo (spese), `/casa/controllo` (check-in)
  o `/casa` (versamento).

**Riepilogo "Rimettiamoci in pari"** (nuova pagina):
- **In cima:** "Dal 9 all'11 non hai segnato niente", dal giorno dopo l'ultima
  transazione fino a oggi.
- **"Con la carta":** un totale, quello che leggi nell'app della banca.
- **"In contanti, a occhio":** le scelte 20 €, 50 € e altro.
- **"Non ho speso niente".**
- **"Tue" o "di casa":** si apre sull'ultima scelta del foglio di aggiunta.
- **Ogni riga salvata** è una spesa con data di oggi, senza categoria e
  segnata come stima. Nelle liste compare come "Senza dettaglio" con l'etichetta
  "stima". Si apre e si dettaglia come ogni spesa. Quando le si dà una
  categoria, il segno di stima sparisce.
- **Conti:** per la carta, l'ultimo conto usato che non sia di contanti. Per i
  contanti, un conto dei contanti se esiste, altrimenti nessun conto. In Casa
  vale "pagata da te" con lo stesso conto personale, come le spese anticipate di
  oggi.
- **Dopo "Fatto":** l'andamento aggiornato e il consiglio del pezzo 2.

**Parte tecnica:**
- Un service worker (`public/sw.js` o come indica la guida di Next 16) che gestisce
  `push` e `notificationclick`.
- Libreria `web-push` con chiavi VAPID nelle variabili d'ambiente di Vercel.
  Fabio le aggiunge a mano.
- Un cron giornaliero su Vercel nel tardo pomeriggio di Roma, per esempio
  `0 16 * * *` UTC, cioè 17:00 d'inverno e 18:00 d'estate. Il piano gratuito
  permette solo esecuzioni giornaliere, ed è quello che basta.
- La route del cron è protetta da `CRON_SECRET` (come `keep-alive`). Deve leggere
  dati di tutti gli utenti, quindi usa la chiave `service_role`, solo sul server,
  mai `NEXT_PUBLIC_`. Fabio la aggiunge a Vercel a mano.
- La route legge solo ciò che serve a decidere: date, iscrizioni, stato dei
  promemoria. Non legge importi personali per metterli in una notifica.
  Revisione di sicurezza con sonnet.
- Un'iscrizione scaduta (HTTP 404 o 410 da `web-push`) si cancella.

**Migrazione 0009:**
- `push_iscrizioni`: `id`, `user_id` (default `auth.uid()`), `endpoint` unico,
  `p256dh`, `auth`, `created_at`. RLS: ognuno legge, inserisce e cancella solo le
  sue.
- `promemoria_utente`: `user_id` come chiave, `ultima_spese_il`,
  `ultima_checkin_il`, `ultimo_versamento_mese`, `nessuna_spesa_fino_al`,
  `notifiche_attive`. RLS: solo le proprie righe. Il cron scrive con
  `service_role`.
- `transactions.stima boolean not null default false`.
- L'eventuale schema per il saldo di partenza da Tricount (pezzo 3).
- In fondo, la parte per tornare indietro, commentata come nelle migrazioni
  precedenti.

## Spazi riservati

- **P.IVA guidata:** il "Da fare" della Home accoglierà le sue scadenze, per
  esempio gli F24 di giugno e novembre. La voce P.IVA resta nella navigazione.
  Non si aggiunge niente di visibile ora.
- **Percorso di apprendimento:** l'ingresso sarà il "Perché?" del consiglio, e ne
  diventerà la porta. Nessuna pagina segnaposto visibile.

## Precisazioni dopo la verifica del documento

Un revisore ha letto il documento come se dovesse costruirlo, e ha fatto le
domande qui sotto. Le risposte sono scelte di Claude, salvo dove il documento
già rispondeva.

- **Saldo da Tricount.**
  - Si inserisce solo quando tutti e due i membri sono entrati nella casa, perché
    è un saldo fra due persone reali. Prima la voce non compare.
  - Ogni lettura che calcola spese del mese (andamento, check-in, disponibile
    casa) deve escluderlo. I test lo verificano.
- **Chi gestisce.**
  - `households.created_by` è `not null` per schema.
  - Se chi ha creato la casa non è più un membro attivo, gestisce il membro
    attivo entrato per primo (`joined_at`).
  - Con più di 2 membri la regola non cambia: chi gestisce è uno, gli altri
    hanno la vista semplice.
- **Notifica delle spese.**
  - Parte se la persona ha almeno un'iscrizione, ha `notifiche_attive = true` e
    non ha creato transazioni negli ultimi 2 giorni.
  - Si guarda solo la data di creazione della transazione (`created_at`), non la
    data della spesa, in qualunque spazio: personale o casa. Spese cancellate o
    con data nel passato non contano a parte.
  - Il cron legge solo `user_id` e `created_at`, con `service_role`, selezionando
    solo quelle colonne. Nessun trigger.
- **Giorni e fuso orario.**
  - Tutto si conta in giorni di calendario di Europe/Rome, non in ore.
  - "2 giorni senza spese" vuol dire che oggi e ieri non è stata creata nessuna
    transazione.
  - Il riepilogo copre dal giorno dopo l'ultima transazione creata fino a oggi.
  - "3 giorni prima del versamento" vuol dire il giorno N-3 di calendario. Si
    manda anche nei giorni successivi fino al giorno N, se il cron ha saltato un
    giorno, ma sempre una sola volta al mese.
- **Stime in Casa.**
  - Una stima di casa è una spesa di casa vera, con il segno di stima: è denaro
    davvero speso.
  - Conta nel disponibile, nel check-in e nei crediti ("pagata da te") come ogni
    altra spesa di casa.
  - Solo le liste e il consiglio 1 la distinguono.
- **Andamento personale, cosa conta.**
  - Contano solo le transazioni personali di tipo `expense`. Le spese collegate a
    un obiettivo sono spese vere e contano.
  - Non contano le entrate e i trasferimenti, che stanno in una tabella a parte.
  - Il giorno del mese si confronta con lo stesso giorno dei mesi passati. Se quel
    mese è più corto, si usa il suo ultimo giorno: il 31 di gennaio diventa il 30
    di novembre.
- **Service worker.**
  - Oggi non esiste: c'è solo `manifest.json`.
  - Il nuovo service worker gestisce solo le notifiche e non mette in cache
    niente, perché l'app non lavora offline (PRODUCT.md).
  - `notifiche_attive` è per persona e vale `null` se non ha ancora risposto,
    `true` se ha detto sì, `false` se ha detto no.
  - Il limite di una notifica al giorno è per persona: la stessa notifica mandata
    a tutti i suoi dispositivi conta come una.
- **Nomi nella vista della compagna.** "Devi X € a Fabio" usa
  `household_members.display_name`. La vista semplice riguarda solo la sezione
  Casa: lo spazio personale di lei resta com'è.

## Lasciato a chi costruisce

- Nomi di file, componenti e route, compreso il nome della pagina del riepilogo.
- La forma esatta del grafico dell'andamento: decide `DESIGN.md`.
- Come si rappresenta il saldo da Tricount, entro il vincolo detto sopra.
- Quali valori di partenza mancano oggi nei passi del piano della quota.
- La frase del consiglio 3 e i testi del consiglio 4, presi dal file di ricerca.

## Scelte di Claude da controllare

- Le soglie dei consigli (20%, +25% e +30 €, 3 mesi).
- Chi gestisce la casa è chi l'ha creata.
- La categoria "Senza dettaglio" come categoria vuota più segno di stima, non come
  categoria vera.
- L'ora della notifica e il limite di una ogni 3 giorni.
- La compagna riceve solo la notifica del versamento, e quella delle spese se si
  iscrive lei.
