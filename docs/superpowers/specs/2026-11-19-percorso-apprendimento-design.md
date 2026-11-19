# Percorso di apprendimento personale ("pezzo 3")

Data: 19 novembre 2026. Stato: approvata da Fabio il 19 novembre 2026.
Base dei contenuti: `docs/research/2026-11-19-percorso-apprendimento.md` (15 argomenti, triage per il mese stretto, evidenza su come si impara) e `docs/research/2026-11-08-economia-domestica.md` (coppia e casa).

## Perché

Fabio, nelle sue parole: ha messo da parte dei soldi e dopo un mese li stava già usando, ed è successo più volte. Una volta per un guasto all'auto, una volta per le spese per vivere. Il fondo per riparare il PC fisso (600-800 €) è sparito allo stesso modo. Compra "a caso" finché non arriva "l'acqua alla gola", e perde tanti spiccioli che col tempo diventano soldi. Dice di non sapere come gestire entrate e spese. In questo momento ha poco sul conto e non sa quando arriva la prima rata della borsa di dottorato.

Vuole che l'app gli insegni **tutta la base dell'economia domestica**, non solo questi tre problemi.

Cosa vuol dire riuscirci, sempre nelle sue parole:
1. avere un piccolo fondo per le emergenze, che resta lì;
2. gestire i soldi per come stanno davvero;
3. riuscire a pianificare a lungo termine, che oggi è impossibile.

Un vincolo decisivo: Fabio fatica a mantenere un impegno costante (il basso è fermo, la chitarra è durata poco). Il percorso **non deve dipendere dalla sua costanza**.

Fabio sta finendo di costruire l'app, poi farà un azzeramento e ripartirà da zero con dati veri. Il percorso coincide con la ripartenza.

## Obiettivi

- Insegnare i 15 argomenti della ricerca, tutti in questa versione.
- Ogni lezione arriva nel momento in cui i numeri dell'utente la rendono utile. Dura circa un minuto e finisce con una sola azione nell'app, che sistema qualcosa al posto suo.
- I "Primi passi" fanno ripartire l'app da zero e insegnano mentre la si configura.
- L'app si accorge quando una spesa sta usando soldi già messi da parte e lo dice in quel momento, senza rimproveri.
- Un pulsante "Ricomincia da zero" azzera lo spazio personale.
- Un indice facoltativo di tutte le lezioni, da sfogliare.
- Vale per ogni utente con i suoi dati: Fabio e Miriam hanno ciascuno il proprio percorso, privato come il resto dello spazio personale.

## Cosa non si fa

- Niente corso da seguire in ordine, niente "sei rimasto indietro".
- Niente quiz, punti, serie di giorni, badge, lodi esagerate.
- Niente consigli d'investimento, fiscali o previdenziali personalizzati. Sugli argomenti 14 e 15 si arriva solo a "cos'è, cosa vuol dire rischio, dove trovare informazione imparziale". Le tasse di Miriam restano alla commercialista, come nella parte P.IVA.
- Niente IA: le lezioni sono testi fissi e le regole sono fisse, come il consiglio di oggi.
- Il reset non tocca la Casa. Per ripartire con la casa c'è già "Chiudi la casa".
- Niente notifiche nuove. Le lezioni si vedono solo dentro l'app.

## Cosa sarebbe un fallimento anche se funziona

- Una lezione o un avviso che fa sentire in colpa, o che giudica una spesa.
- Il percorso diventa un'altra cosa da tenere al passo, cioè un lavoro (principio 6 di `PRODUCT.md`).
- L'avviso sui fondi suona di continuo in un mese stretto.
- Il reset cancella o sposta i numeri della Casa (crediti, debiti, versamenti) o i dati di un altro membro.
- Un testo dà per certo un dato che la ricerca segna come non verificato.

## Strade considerate

1. **Lezioni a regole, più Primi passi, più una piccola migrazione (scelta).** Le lezioni sono testi fissi nel codice. Ognuna ha una regola che decide quando serve, come il consiglio di oggi. I Primi passi si segnano da soli quando la cosa esiste davvero. Una migrazione 0011 ricorda cosa si è già visto, i "più tardi", le risposte all'avviso e la lista d'attesa. Costo medio, una migrazione da lanciare a mano.
2. **Tutto dentro il consiglio, senza tabelle.** Nessuna migrazione, ma l'app non sa cosa hai già letto e si ripete. Non ha posto per i Primi passi in ordine né per l'indice. Scartata.
3. **Corso a capitoli.** Una pagina con capitoli in ordine e segni di lettura. Scartata: chiede proprio la costanza che Fabio dice di non avere.

Fabio ha lasciato a Claude la scelta del come, e la scelta è la strada 1. Le parti in cui ha deciso lui: l'avviso sui fondi (strada B, contro "solo lezioni"); il percorso coincide con la ripartenza (contro un percorso separato); il reset lascia fuori la Casa; tutte e 15 le lezioni subito; l'indice c'è, facoltativo.

## Il disegno

### 1. Le lezioni

Le lezioni sono 15, una per argomento della ricerca, con lo stesso ordine e gli stessi titoli. Il testo è scritto in italiano semplice con parole proprie, partendo dalla ricerca. Struttura di ogni lezione:

- **Titolo.**
- **In breve:** 2-3 frasi con l'idea.
- **Con i tuoi numeri:** una frase costruita sui dati dell'utente quando ci sono (es. "Questo mese 18 spese sotto i 5 € fanno 41 €"). Se i dati non ci sono, un esempio con cifre segnate come esempio.
- **Prova:** una sola azione, con un pulsante che porta al flusso già compilato, più "Più tardi".
- **Per saperne di più:** al massimo 2 link a fonti ufficiali (Banca d'Italia, Consob, IVASS, INPS, Edufin), solo indirizzi controllati a mano prima della pubblicazione.

Lunghezza: si legge in circa un minuto, al massimo 150 parole esclusi i link.

Le cifre della ricerca segnate [Non verificato] non entrano nei testi come fatti. Le cifre degli studi entrano solo se servono, e vanno ricontrollate.

Pagina: `/impara/[argomento]`. La lezione si apre anche come foglio dal basso quando arriva dopo un salvataggio. La forma esatta la decide chi costruisce, nel libretto di `DESIGN.md`.

**Quando compare una lezione.** Le lezioni compaiono in tre modi:
1. dal "Perché?" del consiglio in Home;
2. dopo un salvataggio che la rende utile (vedi la tabella);
3. dall'indice, quando l'utente la cerca.

Al massimo **una lezione proposta al giorno**, cioè nei modi 1 e 2 senza che l'utente la cerchi. "Più tardi" la rimanda di 14 giorni (scelta di Claude). Una lezione già vista si ripropone solo per un evento nuovo dello stesso tipo, e non prima di 60 giorni (scelta di Claude: la ricerca dice che le lezioni svaniscono col tempo, quindi riproporle in un momento nuovo è utile, non ripetitivo).

**Regole e azioni (le soglie sono scelte di Claude, si correggono senza cambiare il disegno):**

| N. | Argomento | Quando si propone | Azione "Prova" |
|---|---|---|---|
| 1 | Dove vanno i soldi e gli spiccioli | Fine della settimana dei Primi passi; spese sotto 5 € oltre 30 € nel mese; consiglio "senza dettaglio" o "categoria sopra" | Guarda le piccole spese del mese (somma e numero dentro la lezione), scegli una voce da tenere d'occhio per un mese |
| 2 | Un piano per ogni euro | Prima entrata registrata nel mese; disponibile sotto 50 € | Apri "Come si calcola?" del disponibile |
| 3 | Spese irregolari ma certe | Una spesa in una categoria "certa" (auto, assicurazioni, tasse locali) senza un fondo collegato; consiglio "obiettivo corto"; frase TARI del consiglio | Crea il fondo dall'elenco delle spese certe |
| 4 | Fondo imprevisti | Una spesa sopra 150 € non collegata a un fondo; nessun fondo imprevisti dopo i Primi passi | Crea il fondo imprevisti con un primo traguardo piccolo |
| 5 | Mettere da parte prima | Un'entrata sopra 300 € mentre esiste un fondo con quota del mese non ancora coperta | Metti da parte ora la quota del mese |
| 6 | Acquisti d'impulso e attesa | Una spesa sopra 40 € in una categoria di svago o acquisti, al massimo una volta al mese | Aggiungi qualcosa alla lista d'attesa |
| 7 | Bisogni, desideri e regole pratiche | Frase 50/30/20 del consiglio; dall'indice | Guarda come si divide il tuo mese (solo lettura, nessun voto) |
| 8 | Reddito irregolare | Passo "Quando entrano" con entrate irregolari o P.IVA; secondo mese con entrate molto diverse | Per chi ha la P.IVA: la guida e lo stipendio fisso già esistenti. Per gli altri: scegli un "reddito base" prudente |
| 9 | Debiti e rate | Una spesa con descrizione o categoria da rate (es. "rata", "Klarna", "Scalapay", "finanziamento") | Registra la rata come impegno ricorrente, così il disponibile la tiene già da parte |
| 10 | Truffe e phishing | Dall'indice; una volta l'anno dentro il consiglio "in linea" | Nessuna azione: scheda con i 4 segnali e i 3 passi dopo |
| 11 | Soldi in coppia | Check-in della Casa; frasi "quota" e "in comune" del consiglio | Apri il check-in o il piano della quota |
| 12 | Assicurazioni di base | Creazione di un fondo per l'assicurazione auto o casa; dall'indice | Aggiungi l'assicurazione alle spese certe |
| 13 | Inflazione | Dall'indice; consiglio "in linea" dopo 12 mesi di dati | Nessuna azione: confronto con una tua spesa di un anno fa, se c'è |
| 14 | Risparmiare e investire | Fondo imprevisti al traguardo; dall'indice | Nessuna azione: le tre domande e i link Consob e Banca d'Italia |
| 15 | Pensione | Dall'indice; una volta l'anno dentro il consiglio "in linea" | Nessuna azione: il link al simulatore INPS |

Le parole chiave per le rate (9) e l'elenco delle categorie "certe" (3) e "di svago" (6) le sceglie chi costruisce, insieme alle categorie iniziali (sezione 5).

**Il "Perché?" del consiglio** porta alla lezione giusta: "senza dettaglio" e "categoria sopra" alla 1, "obiettivo corto" alla 3. Le quattro frasi "in linea" portano alla 3 (TARI), alla 7 (50/30/20) e alla 11 (quota, in comune). Sopra il link resta la spiegazione breve di oggi.

**Mese stretto.** Quando il disponibile è sotto zero o non c'è un'entrata da più di 30 giorni, le lezioni proposte seguono il triage della ricerca. Prima "adesso" (1, 3, 9, 10, 2), poi "appena entrano soldi" (4, 5, 6, 8). Gli argomenti "dopo" (7, 11-15) si propongono solo dall'indice o dal consiglio.

### 2. Primi passi

Si vedono in Home al posto del consiglio finché non sono finiti o nascosti.

```
PRIMI PASSI                      2 di 6
✓ Dove sono i tuoi soldi   conti e saldi veri
→ Quando entrano            "non so ancora la data" va bene
  Una settimana di spese    segni e basta, poi guardiamo insieme
  Le spese certe dell'anno  bollo, assicurazione: diventano fondi
  Fondo imprevisti          primo traguardo piccolo
  Il tuo primo obiettivo    es. il PC
```

Ogni passo apre un minuto di spiegazione e una sola azione. Un passo è fatto quando la cosa esiste nei dati, non con una spunta. Per chi ha già dei dati, i passi già soddisfatti risultano fatti da soli.

1. **Dove sono i tuoi soldi.** Almeno un conto personale con il saldo di oggi. Spiega cos'è il disponibile e perché conta solo i soldi che ci sono.
2. **Quando entrano.** L'utente dice che tipo di entrate ha (fisse, irregolari, P.IVA), quanto si aspetta e quando. "Non so ancora la data" è una risposta valida. La spiegazione: l'app non conta i soldi promessi finché non arrivano. È fatto quando ha risposto. Se l'utente sceglie P.IVA, si aggiunge un passo "Le tasse da parte" che porta alla guida P.IVA esistente, e il passo è fatto quando la guida è completata.
3. **Una settimana di spese.** Si segna e basta, per 7 giorni dall'inizio del passo. Il settimo giorno arriva un riepilogo: totale, le 3 voci più grandi, le piccole spese (lezione 1). Se non ha segnato niente il tono resta neutro ("Questa settimana non ci sono spese segnate. Ripartiamo da oggi"), e i 7 giorni ricominciano.
4. **Le spese certe dell'anno.** Un elenco precompilato di spese irregolari personali tipiche (assicurazione auto, bollo, tagliando e revisione, gomme, abbonamenti annuali, regali), ognuna con una cifra modificabile e un mese. Un tocco crea gli obiettivi dilazionati. È fatto quando esiste almeno un fondo così, oppure con "Non ne ho".
5. **Fondo imprevisti.** Crea il fondo imprevisti con un primo traguardo piccolo (proposta: 200 €, modificabile) e una quota mensile. Il fondo deve crescere mese per mese, non riservare tutto subito: con il saldo basso un fondo riservato tutto insieme porterebbe il disponibile sotto zero. Include il test delle tre domande: imprevedibile, necessario, non c'è altro modo di pagarlo. È fatto quando il fondo esiste.
6. **Il tuo primo obiettivo.** Un obiettivo vero con cifra e data (per Fabio, il PC). È fatto quando esiste, oppure con "Più avanti".

Si possono nascondere in qualsiasi momento ("Li vedo più tardi"). Restano raggiungibili dall'indice, senza conseguenze.

### 3. L'avviso sui fondi

Scatta dopo il salvataggio di una spesa personale che porta il disponibile da zero o più a sotto zero. Non scatta se il disponibile era già sotto zero, e torna attivo solo quando il disponibile risale a zero o più. Al massimo una volta per spesa.

```
Questa spesa usa 50 € che avevi messo da parte.
È un imprevisto vero?
[Sì, prendili dal fondo imprevisti]   [No, è una spesa normale]
```

- **Sì:** la spesa si collega al fondo imprevisti con lo "speso collegato" che c'è già. Il fondo scende, il disponibile torna giusto e l'app conferma con calma ("Il fondo ha fatto il suo lavoro"). Se il fondo non basta, si collega la parte che c'è e il resto lo spiega la frase del "No".
- **No:** la spesa resta normale. L'app spiega che la prossima entrata copre prima questo buco, e propone la lezione 5 o la 6. Nessun rimprovero.
- **Se non c'è un fondo imprevisti:** solo l'informazione e la lezione 4.
- **Se il buco tocca soldi che non sono un fondo**, cioè la quota della casa o le tasse da parte: l'avviso dice di quali soldi si tratta. Non offre di prenderli e non offre il "Sì".

Quale cifra usare: la parte della spesa che va sotto zero, cioè quanto il disponibile è sceso sotto lo zero. La risposta si salva: serve a non ripetere l'avviso e a scegliere le lezioni.

Tono: informazione, mai giudizio. In un mese stretto usare i fondi può essere l'unica strada, e l'app lo dice.

### 4. Lista d'attesa

Serve alla lezione 6. È una lista minima: nome, cifra, data di aggiunta, data in cui rivederla (proposta: dopo 7 giorni). Quando arriva la data, la cosa compare nel "Da fare" della Home con due scelte: "Lo voglio ancora", che apre l'aggiunta della spesa o crea un obiettivo, oppure "Non più". Nessun conteggio di "soldi risparmiati". Si trova in Altro e dentro la lezione 6.

### 5. Ricomincia da zero

Si trova in Altro, con il nome "Ricomincia da zero".

- **Cancella** lo spazio personale dell'utente: movimenti, conti, obiettivi, categorie personali, dati P.IVA, progressi del percorso, lista d'attesa.
- **Resta:** il login, le iscrizioni alle notifiche e le impostazioni dei promemoria, l'iscrizione alla casa e tutti i dati della Casa.
- **Vincolo della Casa:** i numeri della Casa (crediti, debiti, versamenti, registri) devono restare identici prima e dopo. Un conto personale usato da righe della Casa non si può cancellare, perché `transfers.da_account_id` e `a_account_id` sono `on delete restrict`. Quel conto resta, archiviato e fuori dal disponibile, e il suo saldo va a zero. Lo stesso vale per qualunque altra riga personale a cui la Casa fa riferimento. Chi costruisce deve controllare ogni chiave esterna, e un test deve confrontare i numeri della Casa prima e dopo.
- **Conferma:** chiede sempre, anche con "Non avvisarmi più" attivo. Si conferma scrivendo una parola (proposta: RICOMINCIA). Prima di confermare l'app dice cosa cancella. Dice anche che il piano gratuito di Supabase non ha backup, quindi i dati non si recuperano.
- Se nella casa c'è un debito o un credito aperto dell'utente, lo dice prima, ma non blocca.
- Il reset si fa in un'unica operazione nel database. O si cancella tutto, o non si cancella niente.
- Dopo il reset: si creano le categorie iniziali e si aprono i Primi passi.

**Categorie iniziali** (scelta di Claude): un utente nuovo oggi non ha categorie personali. Dopo il reset, e per chi non ne ha nessuna, si crea un piccolo insieme italiano modificabile, per esempio Spesa, Bar e ristoranti, Trasporti, Auto, Casa, Salute, Abbonamenti, Svago e acquisti, Regali, Altro. Le categorie servono alle regole della tabella (3, 6, 9).

### 6. Indice "Impara"

È una voce in Altro. Mostra i 15 argomenti nell'ordine della ricerca, con un segno discreto su quelli già visti e nessuna percentuale. Da qui si riaprono i Primi passi se nascosti e la lista d'attesa. È facoltativo.

### 7. Dati (migrazione 0011)

Per ogni utente, con RLS "solo le proprie righe" come per `promemoria_utente`, serve ricordare:
- lo stato dei Primi passi: risposte del passo 2, inizio della settimana del passo 3, passi chiusi a mano con "Non ne ho" o "Più avanti", nascosti sì o no;
- per lezione: vista il, rimandata al, azione fatta il, ultima proposta il;
- l'ultima lezione proposta, per il limite di una al giorno;
- l'avviso sui fondi: per spesa, la risposta e se è già scattato; lo stato "sotto zero" per non ripeterlo;
- la lista d'attesa;
- quale obiettivo è il fondo imprevisti, per esempio con un segno sull'obiettivo;
- la funzione del reset.

La forma delle tabelle la decide chi costruisce. La migrazione si lancia a mano nel pannello Supabase, come le altre, e le migrazioni già applicate non si toccano.

## Vincoli

- Next.js 16.3.3: prima di scrivere codice si leggono le guide in `node_modules/next/dist/docs/` (vedi `AGENTS.md`).
- Solo piani gratuiti (Supabase, Vercel). Nessun servizio nuovo, niente Google.
- Tutto in italiano semplice, `it-IT`. I testi nuovi passano il test che vieta le parole non volute.
- Stile e componenti del libretto (`DESIGN.md`). Bersagli tattili di almeno 44 px.
- Le scritture seguono le regole di oggi: interfaccia subito aggiornata, scrittura in background, nessun offline.
- Lo spazio personale resta invisibile agli altri membri (`PRODUCT.md`, principio 3).
- I calcoli nuovi (regole delle lezioni, passi fatti, cifra dell'avviso) sono funzioni pure con test vitest, come in `src/lib/calculations/supporto/`.
- Ogni schermata nuova ha una vista in `/anteprima`.

## Precisazioni dopo la verifica del documento

Un revisore ha letto il documento come se dovesse costruirlo e ha fatto le domande che seguono. Le risposte sono tutte scelte di Claude.

- **Come cresce il fondo imprevisti.** È un normale obiettivo dilazionato, con nessun tipo nuovo. La scadenza si ricava da traguardo e quota: 200 € a 20 € al mese fanno 10 mesi da oggi. Si riconosce con un segno sull'obiettivo (0011). Nell'avviso, il "Sì" collega al massimo quanto il fondo ha messo da parte finora, cioè `computeAccantonatoFinora`.
- **Azioni delle lezioni 1, 7 e 8, solo lettura dove manca un posto.**
  - Lezione 1: somma e numero delle piccole spese dentro la lezione, più un link allo Storico. Nessuna "voce da tenere d'occhio" salvata.
  - Lezione 7: la divisione del mese (spese fisse, variabili, messo da parte) calcolata e mostrata dentro la lezione. Nessuna pagina nuova, nessun voto.
  - Lezione 8, per chi non ha la P.IVA: il "reddito base" è una risposta salvata con quelle del passo 2. Serve solo ai testi delle lezioni. Non cambia il disponibile.
- **Risposte del passo 2.** Si salvano e servono solo a tre cose: scegliere le lezioni (8, mese stretto), scrivere i testi ("la borsa non la conto finché non arriva") e far comparire il passo P.IVA. Non c'è un modello di "entrata attesa" e il disponibile non cambia.
- **Utenti che hanno già dei dati (Miriam).**
  - I Primi passi compaiono a chiunque non li abbia finiti o nascosti.
  - Se tutti i passi risultano già fatti dai dati, la scheda non compare e in Home resta il consiglio.
  - Il reset cancella anche i progressi delle lezioni, ed è voluto: dopo il reset ogni lezione si può riproporre.
- **Quando scatta l'avviso.** Solo al salvataggio di una spesa personale nuova dai flussi di aggiunta dell'app (foglio veloce e modulo), con data di oggi o passata. Non scatta per modifiche, eliminazioni, date future o righe della Casa. Il controllo avviene dopo che il salvataggio è riuscito, con lo stesso calcolo del disponibile della Home (`computeDisponibileLibero`) sui dati aggiornati. Se il disponibile va sotto zero perché un obiettivo matura e non per una spesa, l'avviso non scatta.
- **Reset e righe della Casa.**
  - Una riga personale a cui la Casa fa riferimento (conto, categoria o altro) non si cancella e non si mette a null. Resta archiviata, e un conto resta anche fuori dal disponibile.
  - Il saldo del conto archiviato si porta a zero scrivendo direttamente il saldo, non con un movimento di pareggio: il reset è un azzeramento, non un movimento.
  - Il test confronta prima e dopo: crediti, debiti, arretrati, versamenti, saldo del conto comune, disponibile casa, stima contro reale e check-in.
- **Categorie e regole.**
  - Le categorie personali hanno un tipo facoltativo (0011): "spesa certa", "svago e acquisti" o nessuno. Le categorie iniziali nascono con il tipo già messo.
  - Per chi ha già delle categorie, il tipo si sceglie nella pagina Categorie. Finché il tipo è vuoto vale un riconoscimento per nome (es. "auto", "assicurazione", "bollo" per spesa certa).
  - Le categorie iniziali si creano dopo il reset e per chi non ha nessuna categoria personale. Chi ne ha già non riceve nulla.

## Lasciato a chi costruisce

- La forma visiva di lezione, foglio, Primi passi, avviso, lista e indice, nello stile di `DESIGN.md`.
- Lo schema delle tabelle della 0011 e i nomi.
- I testi definitivi delle 15 lezioni, nei limiti di questa spec e della ricerca, con i link ufficiali ricontrollati a mano.
- L'elenco delle parole chiave per le rate, le categorie "certe" e "di svago", le cifre proposte per le spese certe.
- L'ordine delle consegne.
