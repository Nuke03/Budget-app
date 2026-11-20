# Roadmap — novembre 2026

Punto di partenza per le prossime chat. Ogni blocco è pensato per una chat
nuova con contesto pulito: si apre la chat, si indica il blocco, e la chat
legge questo file più i documenti citati.

## Stato attuale (8 novembre 2026; per il blocco 1 vedi sotto)

- App in produzione su Vercel, database Supabase (piano gratuito).
- **Down di novembre risolto.** Causa: Supabase mette in pausa i progetti
  gratuiti dopo circa 7 giorni senza richieste, e il loro indirizzo smette di
  esistere. Ora un cron Vercel giornaliero (`vercel.json`, 06:00 UTC) chiama
  `/api/keep-alive`, che legge una riga. Se il database non risponde, l'app
  mostra "Non riesco a raggiungere il database" con un pulsante Riprova
  (`src/app/error.tsx`).
  - Opzionale: impostare `CRON_SECRET` nelle variabili d'ambiente Vercel per
    chiudere la route ai non autorizzati.
  - Da verificare tra qualche giorno: nella dashboard Vercel → Cron Jobs le
    esecuzioni devono risultare 200.
- Scelta tecnica confermata: **si resta su Supabase**. Google Apps Script e
  Google Sheets sono esclusi, perché l'account Google ha uno strike di sicurezza aperto.
- Ultimi rilasci: modifica di tutte le entità, obiettivi con "speso
  collegato", collegamento transazione → obiettivo, chiusura obiettivi.

**Pulizia prima del test, fatta (20 novembre 2026).** Piano: `docs/superpowers/plans/2026-11-19-pulizia-prima-del-test.md`. Mappa delle voci: `docs/superpowers/plans/2026-11-19-pulizia-mappa.md`. Migrazione 0012 lanciata da Fabio, con i 3 test SQL passati (`movimenti_atomici.sql`, `ricomincia_da_zero.sql`, `rls_casa.sql`: 206 OK). Cosa è cambiato:
- **Movimenti atomici:** modifica ed eliminazione di un movimento scrivono riga e saldo insieme, con una sola funzione SQL. Se l'app si chiude a metà, un'eliminazione in sospeso si ripete alla riapertura, senza cancellare due volte.
- **Casa:** una spesa di casa pagata con la carta personale si può modificare. Il calendario usa l'id dell'obiettivo. Due soci che toccano "Metti da parte" insieme creano un solo fondo. "Più tardi" si salva nel database. Il puntino sulla barra segnala un promemoria. C'è il promemoria "Rivedi la quota" e il pulsante "Nuova cosa da mettere da parte". Una sola regola per le spese collegate a un fondo. Il mese del passaggio da Tricount ha due voci. La quota parte dal giorno d'ingresso.
- **P.IVA:** "Scarta" sulle quote, domanda sulla quota dopo un incasso eliminato, cambio categoria che riparte da oggi. Lo stipendio superato mostra 0 € con una frase calma. Una notifica per tutte le scadenze della settimana. La Home dice se la P.IVA non si legge. Una sola fattura per ogni incasso, e la data d'incasso non può essere prima dell'emissione.
- **Percorso:** le categorie di partenza si creano con un blocco, e solo se non ci sono movimenti personali. La lezione dell'avviso conta come lezione del giorno. "Lo voglio ancora" apre il nuovo obiettivo con nome e cifra già scritti. Altro dice se la Casa non si legge. Meno letture dopo ogni salvataggio.
- **Conferma versamento:** su un obiettivo dilazionato con almeno una conferma, il riservato è il minore fra la quota a tempo e quanto confermato, meno lo speso collegato. Compare "Ho messo da parte" nella card e nel "Da fare" della Home.
- **Design:** il logo del login è l'icona dell'app. Il timbro è più leggibile. La figura della P.IVA segue i token del design.

## Checklist del test da zero

Per Fabio, nell'ordine. Ogni passo dice cosa guardare.

1. Prima del reset, annota i crediti della Casa e il saldo del conto comune.
2. In Altro, tocca "Ricomincia da zero".
3. Fai i Primi passi.
4. Fai una spesa che porta il disponibile sotto zero. Deve comparire l'avviso sul fondo imprevisti.
5. Fai una spesa da 160 €. Deve comparire la lezione sul fondo imprevisti.
6. Modifica un movimento, poi eliminane un altro. Controlla che il saldo torni giusto dopo ogni passo.
7. Su un obiettivo con scadenza, tocca "Ho messo da parte". Controlla il disponibile e il riservato.
8. Con Miriam: la prova dal vivo della P.IVA (vedi "Da controllare per Fabio" più sotto).
9. Dopo il reset, controlla che i numeri della Casa siano gli stessi di prima.
10. Tocca il + della barra. Deve aprirsi "Cosa vuoi fare?" con "Registra una spesa" in cima e una riga che dice a cosa serve ogni altra voce.
11. Registra una spesa in 3 tocchi: + → "Registra una spesa" → importo → Salva. Il tempo deve restare sotto i 10 secondi.
12. Alla prima apertura, il giro di 5 fumetti sulla barra (disponibile, Storico, +, Casa, Altro). Deve chiudersi con "Fatto" o "Salta", e non tornare alla prossima apertura.
13. Apri Storico la prima volta: un fumetto indica la fila dei periodi. Si chiude con "Ho capito" e non torna.
14. In Altro tocca "Rivedi il giro": il giro e i fumetti della prima volta ripartono.

## Obiettivo trasversale: insegnare l'economia domestica

Richiesta di Fabio, valida per ogni blocco: oltre a tenere i conti, l'app deve
aiutare lui e la compagna ad acquisire le competenze di economia domestica,
che nessuno ha mai insegnato loro. In ogni spec e in ogni passata di design
servono: percorsi guidati e piccoli compiti, "Come si calcola?" sui numeri,
italiano semplice senza gergo, spiegazioni nel momento in cui si decide,
nessun senso di colpa e nessuna gamification. Base dei contenuti:
`docs/research/2026-11-08-economia-domestica.md`.

## Ordine dei blocchi

### 1. Co-gestione casa (priorità: affitto in arrivo)

**Stato (8 novembre 2026):** spec approvata in `docs/superpowers/specs/2026-11-08-co-gestione-casa-design.md`; consegne 1 a 3 pianificate in `docs/superpowers/plans/2026-11-08-casa-comune-consegne-1-3.md`. Le domande iniziali sono risolte nella spec. Consegna 1 (fondamenta) e consegna 2 (casa, invito, ingresso, uscita): fatte. Consegna 3 (la quota): fatta.

**Stato (9 novembre 2026):** consegne 4 e 5 fatte, piano in `docs/superpowers/plans/2026-11-08-casa-comune-consegne-4-5.md`, migrazioni fino alla 0007 eseguite: spese di casa con selettore Personale|Casa, conto comune, spesa con carta personale e credito, versamenti, rimborsi, restituzioni, righe neutre nello storico, quota e debiti riservati nel disponibile personale, promemoria in app, calendario privato in abbonamento, invito con link. 

**Stato (9 novembre 2026, consegne 6 a 8):** fatte, piano in `docs/superpowers/plans/2026-11-09-casa-comune-consegne-6-8.md`, migrazioni fino alla 0008 eseguite. Cosa c'è ora:
- bollette in un tocco (voci del piano collegate a un obiettivo, "da parte" con preselezione);
- costi di ingresso con spiegazione di ogni voce e data di ingresso;
- disponibile casa completo, con cuscinetto e "Come si calcola?";
- controllo del saldo del conto comune, con la riga delle spese non registrate e il promemoria;
- check-in mensile, con destinazione dell'avanzo e avviso al secondo ammanco;
- stima contro reale, con card nel check-in e nella pagina della quota;
- stati vuoti e di errore della parte Casa, e un test che vieta le parole non volute nei testi.

Rimandati dalle revisioni: tutti chiusi il 20 novembre 2026 (vedi il blocco «Pulizia prima del test» più sopra). Resta il fatto del 18 novembre:
- **Fatto (18 novembre 2026):** una sola funzione SQL (`crea_movimento`) scrive insieme la riga e il saldo, così una spesa non resta mai a metà se cade la connessione.

**Tipo:** architetturale. Cambia la premessa del prodotto: `PRODUCT.md` oggi
dice "dati completamente isolati tra i due utenti".

**Processo:** brainstorming (superpowers) → spec in `docs/superpowers/specs/`
→ piano → implementazione con subagent.

**Domande da chiarire con Fabio all'inizio:**
- Conto comune reale in banca, oppure ognuno paga dal proprio conto e poi si
  pareggia?
- Divisione delle spese comuni: 50/50, proporzionale al reddito, oppure
  decisa per singola spesa?
- Cosa vede la compagna della parte personale di Fabio, e viceversa? Niente,
  solo i totali, oppure tutto?
- Il "disponibile libero" personale deve scalare la propria quota delle spese
  comuni (affitto, bollette)?
- Serve il saldo "chi deve quanto a chi", stile Tricount, con il pareggio?

**Impatto tecnico previsto:**
- nuove tabelle `households` e `household_members`, più l'invito della
  partner;
- conti e transazioni con un ambito personale o di casa;
- policy RLS basate sull'appartenenza alla casa, non più solo su `auth.uid()`;
- migrazione dei dati esistenti senza perdite.

La migrazione SQL va eseguita a mano nel pannello Supabase.

### 2. Design e UX (impeccable)

**Tipo:** design. Si fa con `/impeccable:impeccable`.

**Passi:**
1. Aggiornare `PRODUCT.md` con la co-gestione, decisa nel blocco 1.
2. Fare critica e audit dell'app attuale su UI e UX:
   - flussi principali: inserimento spesa in meno di 10 secondi, lettura del
     disponibile, obiettivi, storico;
   - navigazione con la nuova sezione Casa;
   - stati vuoti, di errore e di caricamento.
3. Scrivere `DESIGN.md`, il design system di riferimento.
4. Applicare le correzioni, schermata per schermata.

**Eliminazioni con annullamento** (richiesta di Fabio, 8 novembre): ogni
eliminazione (spesa, entrata, conto, obiettivo, categoria, movimento di casa)
non deve essere definitiva subito. Dopo il tocco compare un avviso in basso con
il pulsante "Annulla" per qualche secondo; solo allo scadere la cancellazione
diventa effettiva. Per le eliminazioni più pesanti, prima del tocco, un avviso
di conferma con l'opzione "Non avvisarmi più", che si può riattivare dalle
impostazioni. Da applicare in modo uniforme in tutta l'app, Casa compresa.

**Ordine deciso con Fabio (9 novembre):** prima questo blocco di design e UX,
poi si implementano nel nuovo design la parte P.IVA guidata con il reddito
irregolare ("pezzo 2": dove trovare i dati, stipendio dal cuscinetto, scadenze
F24 di giugno e novembre) e il percorso di apprendimento personale ("pezzo 3").
Durante questo blocco si progetta come se le due parti esistessero già, con
segnaposto nelle schermate e nella navigazione, così non serve ristrutturare
dopo.

**Semplicità d'uso** (Fabio, 9 novembre): oggi il piano della quota e i
flussi simili risultano meccanici e difficili da gestire. Nell'audit vanno
trattati come difetti: meno passaggi, valori di partenza sensati, una decisione
per schermata, parole semplici. Si mette in conto di ristrutturare questi flussi.

**Velocità** (segnalazione di Fabio, 9 novembre: "l'app sta rallentando un
botto"). Prima di toccare la grafica, misurare i tempi reali di Home, Casa e
Storico sul telefono e correggere le cause. Sospetti già noti dalle revisioni:
- la home e `/casa` leggono a ogni apertura tutte le transazioni e tutti i
  trasferimenti della casa per calcolare crediti, debiti e arretrati, e alcune
  letture sono in sequenza invece che in parallelo (`loadHomeData`,
  `loadCasaStato`, `loadCasaData`);
- Storico e P.IVA caricano tutte le transazioni senza limite (già nel backlog);
- oltre circa 1000 righe Supabase tronca le risposte e i registri della casa
  diventerebbero sbagliati: spostare il calcolo di crediti, debiti e arretrati in
  SQL (le funzioni `_casa_*` esistono già) o filtrare le righe necessarie;
- stati di caricamento: mostrare subito la pagina con i dati principali e il
  resto dopo.
- Novità delle consegne 6 a 8 (9 novembre): letture aggiunte, le due `limit 1` in
  `loadCasaData` e `loadCasaStato` (ultimo controllo e ultimo check-in); il
  check-in, il disponibile casa (D) e la stima contro reale non leggono altro,
  usano le transazioni già caricate. Letture tolte: la pagina Da parte faceva una
  query per obiettivo, ora ne fa una sola. Avvertenza: D, stima e check-in vanno
  spostati su letture per mese quando si risolve il limite di circa 1000 righe,
  altrimenti con le righe troncate i loro numeri sarebbero sbagliati.

**Velocità, fatto (11 novembre 2026).** Misura: ogni pagina replicata con le
stesse richieste in fila verso il progetto Supabase reale (dall'Italia, chiave
anonima: conta la rete e PostgREST, non il volume dei dati), mediana di 11 prove.

| Pagina | Prima | Dopo | Richieste in fila |
|---|---|---|---|
| Home | 769 ms | 264 ms | 8 → 3 |
| Casa | 689 ms | 254 ms | 8 → 3 |
| Quota | 1177 ms | 354 ms | 13 → 4 |
| Storico | 514 ms | 176 ms | 6 → 2 |
| P.IVA | 87 ms | 87 ms | 1 (ora solo le entrate dell'anno) |

Cause e correzioni:
- verifica dell'utente, poi casa (3 letture in fila), poi dati, poi piani (2
  letture per versione), poi speso per obiettivo: ora le letture partono insieme
  alla verifica (`conUtente`, `utenteECasa` in `src/lib/utenteOLogin.ts`), la
  casa si legge in una sola andata, i piani in due qualunque sia il numero di
  versioni, lo speso collegato in una query;
- Supabase è in Irlanda (eu-west-1); Vercel, se nessuno ha cambiato la regione,
  esegue le funzioni a Washington (`iad1`), e allora ogni richiesta del server
  attraversa l'oceano (non verificato: serve l'indirizzo di produzione).
  `vercel.json` ora fissa `dub1`. Per controllare: nella risposta di una pagina,
  l'header `x-vercel-id` deve finire con `dub1`;
- nessuna schermata di caricamento: ora `src/app/loading.tsx` appare subito;
- limite di 1000 righe: `getTransactions` e `getTransfers` leggono a pagine
  (`src/lib/data/leggiTutte.ts`), quindi registri, D, stima e check-in restano
  giusti anche oltre; la home legge solo le spese anticipate per i crediti,
  `getLastIncomeDate` una riga, Storico l'ultimo anno (di più solo con un periodo
  personalizzato), P.IVA solo le entrate dell'anno. Nessuna migrazione serve.
- Resta: `/casa`, movimenti e check-in leggono ancora tutto lo storico della
  casa (giusto, ma cresce col tempo); quando pesa, passare a letture per mese.

**Cambio palette** (dal verde a blu "corporate", più rassicuranti per l'occhio):
deciso con Fabio di farlo **dopo** la co-gestione. Va fatto qui, come ultimo
passo del blocco.

**Agenti:** impeccable ha agenti propri (finish-reviewer, documenter,
asset-producer). Le modifiche ripetitive si possono delegare.

**App di supporto (brainstorming dell'11 novembre 2026).** Lo spec è
`docs/superpowers/specs/2026-11-11-app-di-supporto-design.md`. Il piano A
(`docs/superpowers/plans/2026-11-11-app-di-supporto-logica.md`) è fatto e
rivisto. Contiene:
- la prova delle notifiche;
- la migrazione 0009;
- i calcoli: andamento, consiglio, categoria indovinata, chi gestisce, quando
  avvisare;
- il saldo da Tricount;
- il controllo giornaliero `/api/promemoria`.

Cosa resta, in ordine:
1. **Fabio** lancia la `0009_supporto_e_notifiche.sql` nel SQL editor di
   Supabase.
2. Si pubblicano su master i commit del piano A rimasti in locale. Prima della
   0009 romperebbero la lettura delle transazioni, perché leggono la colonna
   `stima`.
3. **Fabio**, su Vercel (Production), aggiunge `NEXT_P_VAPID_P_KEY` (chiave
   pubblica), `VAPID_PR_KEY` (privata; Vercel rifiuta i nomi con PUBLIC e
   PRIVATE, vedi `src/lib/chiaviVapid.ts`), `VAPID_SUBJECT` (le chiavi le genera con
   `npx web-push generate-vapid-keys`), `SUPABASE_SERVICE_ROLE_KEY` e
   `CRON_SECRET`, poi rifà il deploy.
4. **Fatto (11 novembre 2026):** la notifica di prova arriva sull'iPhone di
   Fabio, con l'app installata in Italia. Il piano B quindi manda i
   promemoria come notifiche.
5. **Fatto:** pagina `src/app/prova-notifiche/` cancellata. `public/sw.js`,
   `src/lib/pushEndpoint.ts` e `src/lib/chiaviVapid.ts` restano.
6. Poi `PRODUCT.md`, audit con impeccable, `DESIGN.md`, e il **piano B**, cioè
   le schermate. Passi 1-3 fatti.

**Piano B1 "Il Libretto", fatto (12 novembre 2026).** Riferimenti:
- piano: `docs/superpowers/plans/2026-11-12-libretto-home-aggiunta.md`;
- stile: `DESIGN.md`;
- contratto di direzione: `.impeccable/surfaces/src-app-page-tsx.md`.

Cosa contiene:
- colori e caratteri del libretto, compresa la modalità scura;
- barra in basso con il + al centro;
- pagina Altro;
- Home a libretto: disponibile spiegato, andamento a barre, registro con "Nel mese", prossima cosa da fare, consiglio, timbro "REGISTRATO";
- aggiunta veloce col solo importo;
- iscrizione ai promemoria;
- pagina "Rimettiamoci in pari".

Revisioni fatte: per ogni task, revisione finale di impeccable (verdetto: da pubblicare) e revisione opus. I due errori sui soldi trovati alla fine sono corretti.

Per provare le schermate senza login: `/anteprima?vista=home|foglio|in-pari|vuota`, solo in sviluppo. Va avviata con la configurazione `dev-webpack` di `.claude/launch.json`: con Turbopack in sviluppo `next/font` non si carica. La build di produzione invece funziona.

**Piano B2 "Il Libretto per la Casa", fatto (12 novembre 2026).** Piano:
`docs/superpowers/plans/2026-11-12-libretto-casa.md`. Cosa contiene:
- pallini colorati delle categorie nel registro e nel foglio di aggiunta;
- Casa di chi gestisce: disponibile, spese del mese contro il previsto (stesso calcolo del check-in), una sola cosa da fare con "Più tardi", ultime 3 spese, "Dettagli";
- vista semplice per chi entra ogni tanto: quota e scadenza, siete in pari, la casa ti deve, aggiungi spesa, versamento con un tocco, "Vedi tutto";
- saldo da Tricount in Impostazioni, con il link da Dettagli;
- tutte le pagine di Casa nel libretto;
- percentuali della quota già compilate dai redditi.

Revisioni fatte: per ogni task, revisione finale di impeccable (verdetto: da pubblicare) e revisione opus, con le correzioni fatte. `DESIGN.md` è aggiornato.

**Piano B3, fatto (17 novembre 2026). Il blocco 2 è chiuso.** Piano:
`docs/superpowers/plans/2026-11-17-libretto-b3.md`. Cosa contiene:
- ogni eliminazione si può annullare per 5 secondi, e il conto alla rovescia si ferma se tocchi l'avviso;
- cambiando pagina l'eliminazione parte subito, e il saldo non viene mai scalato due volte;
- le azioni pesanti chiedono conferma, con "Non avvisarmi più" che si riattiva da Altro, mentre chiudere o lasciare la casa chiede sempre;
- Storico per giorno, obiettivi, conti, categorie e P.IVA sono nel libretto, con icone vere;
- c'è l'icona dell'app.

Revisioni fatte: impeccable (verdetto: da pubblicare) e opus, con le correzioni fatte. `DESIGN.md` è aggiornato.

**Icona sull'iPhone:** per vederla, togli l'app dalla schermata Home e aggiungila di nuovo da Safari.

**P.IVA guidata (pezzo 2), fatta (18 novembre 2026).** Piano: `docs/superpowers/plans/2026-11-17-piva-guidata.md`. Spec: `docs/superpowers/specs/2026-11-17-piva-guidata-design.md`. Commit da `e2843f3` a `bc6b247` su master, più eventuali correzioni finali. Cosa contiene:
- migrazione 0010: tabelle per fatture, accantonamenti e scadenze, con funzioni atomiche;
- impostazione guidata in 4 passi, con preset ENPAP;
- percentuale per incasso, e il prompt "metti da parte" a ogni incasso;
- conto tasse come vaso, con il confronto sul totale dell'anno;
- scadenze F24 ed ENPAP con confronto cumulativo sul vaso. Compaiono nel "Da fare" 15 giorni prima, con notifica 7 giorni prima;
- fatture in attesa, con "Pagata" a un tocco;
- stipendio fisso con cuscinetto, anche in Home;
- viste di prova: `/anteprima?vista=piva`, `piva-guida`, `piva-scadenze`.

Debito chiuso: l'aggiunta di un movimento è atomica. La funzione `crea_movimento` scrive riga e saldo in un'operazione.

**Percorso di apprendimento personale (pezzo 3), fatto (19 novembre 2026).** Piano: `docs/superpowers/plans/2026-11-19-percorso-apprendimento.md`. Spec: `docs/superpowers/specs/2026-11-19-percorso-apprendimento-design.md`. Commit da `aa4b573` a quello di "ruolo delle categorie, anteprime e documenti" su master. Cosa contiene:
- migrazione 0011: stato del percorso, lista d'attesa, ruolo delle categorie e la funzione che azzera i dati personali;
- 15 lezioni in "Impara", con i numeri dell'utente e il "Perché?" del consiglio;
- "Primi passi": conti, entrate, P.IVA, una settimana di spese, spese certe, fondo imprevisti, un obiettivo;
- avviso quando una spesa porta il disponibile sotto zero, con la domanda sul fondo imprevisti;
- una lezione proposta dopo il salvataggio giusto;
- lista d'attesa di 7 giorni per gli acquisti non urgenti;
- "Ricomincia da zero" in Altro, con conferma scritta;
- scelta "Tipo" (Normale, Spesa certa, Svago e acquisti) nella modifica di una categoria di spesa;
- "Perché?" nel check-in della casa, verso la lezione sulla coppia;
- viste di prova: `/anteprima?vista=impara`, `lezione`, `primi-passi`, `passo-imprevisti`, `avviso-fondi`, `attesa`, `ricomincia`.

**Prossimi passi:** la prova dal vivo, vedi la checklist del test da zero.

I resti dei piani B1, B2 e B3 sono chiusi il 20 novembre 2026 (vedi il blocco «Pulizia prima del test»).

**Critica impeccable (11 novembre 2026):** 23 su 40. Il rapporto è in
`.impeccable/critique/2026-11-11T16-57-29Z__src-app.md`. Problemi, in
ordine:
1. [P0] Aggiunta spesa oltre i 10 secondi.
2. [P1] Casa troppo piena e senza ruoli.
3. [P1] Disponibile difficile da capire.
4. [P2] Cancellazioni senza annulla e bersagli piccoli.
5. [P2] Contrasto.

Decisioni di Fabio:
- Si parte dall'aggiunta spesa.
- Tono "calmo e affidabile": blu sobrio, molto spazio, numeri grandi.
- Nel piano B entrano tutti e 5 i problemi.

**Icona dell'app** (Fabio, 11 novembre: quella di oggi è brutta). Va rifatta
insieme all'identità visiva in `DESIGN.md` e al cambio di palette, con
impeccable (agente asset-producer). Va rifatta in tutti i formati:
`public/icons/icon-192.png` e `icon-512.png`, la versione per iPhone
(apple-touch-icon, 180×180, senza trasparenza), il favicon e il colore di
`manifest.json`. È la stessa icona che compare nelle notifiche.

Piano B: chiuso anche il resto (saldo Tricount in una riga sua, test SQL del debito Tricount, frase neutra in `CheckinMensile`).

### 3. Backlog già discusso

- **Conferma versamento:** fatta il 20 novembre 2026 (vedi il blocco «Pulizia prima del test»).
- **Caso limite** (K3) e **Prestazioni:** chiusi.
- **Totale app diverso dalla banca (K2):** la matematica è verificata e testata.
  Servono i numeri concreti (quale conto, importo nell'app, importo in banca,
  obiettivi collegati) per trovare il dato sbagliato. Probabile causa: le due
  richieste separate di modifica ed eliminazione, ora corrette con una sola funzione SQL.

### Da controllare per Fabio

- Link delle 15 lezioni del percorso (`src/lib/percorso/lezioni.ts`): aprirli a mano prima della pubblicazione, perché i siti cambiano indirizzi. Elenco: https://economiapertutti.bancaditalia.it/ ; https://www.bancaditalia.it/pubblicazioni/guide-bi/index.html ; https://www.bancaditalia.it/focus/cybersicurezza/truffe-cyber ; https://www.arbitrobancariofinanziario.it ; https://www.consob.it/web/investor-education/ ; https://www.ivass.it/consumatori/index.html ; https://www.inps.it (home, non la pagina del servizio pensione, che la ricerca ha letto solo in parte).
- Prova dal vivo della 0011 (percorso): vedi la checklist del test da zero più sopra. La migrazione è applicata dal 19 novembre 2026 e il test SQL (`supabase/tests/ricomincia_da_zero.sql`) è passato.
- Le soglie del percorso (`src/lib/calculations/percorso/soglie.ts`) sono stime: da ritoccare dopo un po' di uso vero.
- La migrazione 0010 è stata lanciata su Supabase il 18 novembre 2026. Nessun test l'ha eseguita su Postgres: da provare dal vivo con l'account di Miriam, guardando i saldi dopo ogni passo. Prova: guida, una fattura "pagata adesso", "Fatto, li ho spostati", annulla lo spostamento nello Storico, paga una scadenza, elimina nello Storico l'incasso e l'uscita della scadenza (la fattura torna in attesa, la scadenza si riapre).
- I valori ENPAP del preset (78%, 10%, 2%, minimale 856 €) vengono da guide non ufficiali. Da confermare con il commercialista o nell'area riservata ENPAP.
- Le regole ENPAP cambiano dal prossimo anno: aggiornare i parametri quando escono.
- Futura migrazione 0013 (difese in più, nessun difetto visibile): la WITH CHECK di `piva_quote_scartate` deve verificare che la transazione sia di chi scrive; togliere `adjust_account_balance` ad `authenticated` (non ha più chiamanti dal client); limitare per data la lettura di `goal_versamenti`.
- Prova dal vivo con Miriam: "La riporto indietro?" compare solo se si resta nello Storico per 5 secondi dopo l'eliminazione; controllare anche che si capisca cosa fare se non compare.

### Aperto dopo la pulizia (20 novembre 2026)

- **P12** (tabelle P.IVA in sola lettura dal client): rimandata. Toglie le policy di scrittura, quindi servono due migrazioni e un rilascio coordinato. È una difesa in più, non un difetto visibile.
- **K2** (totale diverso dalla banca): serve il caso reale, vedi sopra. Probabile causa già corretta.
- **P13** (idea "metti da parte di più"): quando il vaso non basta per una scadenza, si mette da parte una percentuale in più. Oggi l'app dice di spostare la differenza prima della scadenza. È un'idea, non un difetto.
- Rinviati piccoli, dalla pulizia:
  - le righe della riconciliazione si possono ancora modificare, come prima;
  - la soglia del reddito irregolare (0,3) non ha un test che la blocca;
  - se la risposta del server si perde, il messaggio di errore è generico;
  - P2: le scadenze dell'anno dopo compaiono solo dopo aver aperto la P.IVA;
  - P3: il prompt "La riporto indietro?" si perde se si lascia lo Storico in meno di 5 secondi (si può annullare comunque);
  - due eliminazioni di incassi molto vicine: il secondo prompt sostituisce il primo;
  - riga "P.IVA non letta": per chi non ha la P.IVA, un errore di lettura passeggero non è ancora gestito;
  - un disponibile negativo viene mostrato a 0 senza frase, nella funzione `mostrato`;
  - data futura e importi enormi del versamento sono controllati solo nell'app, non nel database;
  - Home e P.IVA leggono i dati in due modi separati: se una lettura fallisce, le due schermate possono non dire lo stesso.

## Come lavorare per risparmiare token

- Una chat per blocco. Questa chat è già stata compattata una volta.
- La chat principale fa solo le decisioni con Fabio: domande, design,
  approvazioni. L'implementazione dei task di un piano va ai subagent
  (superpowers:subagent-driven-development) su modelli più economici, con
  review a fine task.
- Regola fissa: alla fine di ogni feature committare e pushare direttamente,
  così Fabio la vede subito su Vercel.
- Leggere `AGENTS.md`: Next 16 ha API diverse. Per esempio `proxy.ts` al
  posto di `middleware.ts`, e `retry` al posto di `reset` in `error.tsx`.
