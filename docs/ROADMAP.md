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

Rimandati dalle revisioni, ancora aperti, da fare in un compito dedicato:
- una sola funzione SQL che scrive insieme la riga e il saldo, così una spesa non resta mai a metà se cade la connessione;
- modificare una spesa di casa pagata con la carta personale (oggi si cancella e si reinserisce);
- `id` dell'obiettivo nel feed del calendario, per eventi stabili quando si rinomina un obiettivo;
- avviso nel percorso guidato su iOS 18 se il menu per il calendario in abbonamento ha parole diverse;
- puntino sulla barra di navigazione quando c'è un promemoria;
- promemoria "Rivedi la quota";
- pulsante "Nuova cosa da mettere da parte" nel foglio di aggiunta.

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

**Cambio palette** (dal verde a blu "corporate", più rassicuranti per l'occhio):
deciso con Fabio di farlo **dopo** la co-gestione. Va fatto qui, come ultimo
passo del blocco.

**Agenti:** impeccable ha agenti propri (finish-reviewer, documenter,
asset-producer). Le modifiche ripetitive si possono delegare.

### 3. Backlog già discusso

- **Conferma versamento** verso obiettivi dilazionati: il riservato diventa
  il minimo tra la quota teorica a tempo e i versamenti confermati.
  - Correzione proposta: il vincolo si attiva **solo** sugli obiettivi per
    cui si è confermato almeno un versamento, così gli obiettivi esistenti non
    crollano a zero.
  - In attesa del sì di Fabio sulla correzione. Serve una nuova tabella
    `goal_versamenti`, con migrazione manuale.
- **Totale app diverso dalla banca:** la matematica è verificata e testata.
  Servono i numeri concreti (quale conto, importo nell'app, importo in banca,
  obiettivi collegati) per trovare il dato sbagliato.
- **Caso limite:** una transazione datata esattamente sul confine di ciclo di
  un obiettivo ricorrente può finire nella finestra adiacente.
- **Prestazioni:** Storico e P.IVA caricano tutte le transazioni senza limite.

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
