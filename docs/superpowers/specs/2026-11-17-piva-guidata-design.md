# P.IVA guidata: design

Data: 17 novembre 2026. Corrisponde al "pezzo 2" della ROADMAP. Nasce dal brainstorming con Fabio.

## Per chi e perché

L'utente è **Miriam**. È una psicologa in regime forfettario, iscritta all'ENPAP, e usa l'app con il proprio account. Fabio non aprirà una P.IVA per circa 3 anni, per via del dottorato. La parte ENPAIA non serve, ma l'app resta valida per qualunque cassa perché i parametri sono modificabili.

Miriam ha due problemi:

1. **Non sa quanto tenere da parte per le tasse.** Il commercialista le manda gli F24 già calcolati, ma solo alla scadenza. Mentre incassa non sa quanti di quei soldi non sono suoi.
2. **Il reddito arriva a strappi.** Alcune fatture vengono pagate dopo mesi. C'è un solo cliente fisso mensile, e con poche entrate. I pazienti in studio vanno e vengono. Per questo non sa quanto può spendere ogni mese.

Come si muovono i soldi oggi:
- Fattura quasi tutto con bonifico. Alcuni pazienti in studio pagano in altri modi, per esempio contanti o POS.
- Tutti i bonifici arrivano sul **conto personale**. Da lì Miriam sposta a mano una parte sul **conto tasse**.
- Presto ci sarà anche un conto cointestato, che è già gestito dalla parte Casa.

L'app deve guidarla e insegnarle come funziona: perché una fattura non pagata non costa ancora tasse, perché il primo anno gli acconti non tornano, da dove viene ogni numero. Non deve diventare un lavoro in più.

## Obiettivi

- A ogni incasso, una frase chiara: "di questi 600 €, metti da parte 130 € sul conto tasse". Lo spostamento si conferma con un tocco.
- Il conto tasse è il **vaso**. L'app sa sempre quanto c'è dentro e quanto servirà alle prossime scadenze.
- **Scadenze** dell'anno nel "Da fare":
  - F24 di giugno e novembre;
  - acconto e saldo ENPAP, che non passano dagli F24.
- Quando arriva la cifra vera, l'app la confronta con il vaso.
- **Fatture in attesa:** la lista di chi le deve soldi, con in evidenza le fatture vecchie. Con un tocco su "pagata" una fattura diventa un incasso.
- **Stipendio:** una cifra fissa al mese che Miriam può spendere. La Home le mostra lo stipendio, non tutto il saldo. Il resto forma il cuscinetto, che copre i mesi magri.
- **Impostazione guidata:** i campi arrivano già compilati per una psicologa ENPAP, e ognuno dice dove si trova il dato. Miriam conferma.

## Non obiettivi

- Emettere fatture o collegarsi allo SDI o a programmi di fatturazione.
- Pagare gli F24 o collegarsi alla banca, come già deciso in PRODUCT.md.
- Il regime ordinario e l'IRPEF a scaglioni.
- Leggere la foto di un F24. Potrà venire in futuro.
- Una consulenza fiscale personalizzata. L'app fa stime con regole fisse e la conferma spetta al commercialista. Si dice una volta, con una frase breve, non con un paragrafo legale.
- Le regole delle singole casse scritte nel codice. Percentuali, minimali e date sono dati modificabili, perché l'ENPAP cambierà le regole dal prossimo anno.

## Cosa non deve succedere

- L'app diventa un secondo gestionale: per ogni incasso più di 2 tocchi oltre a quelli di oggi.
- Numeri che spaventano senza spiegare: ogni cifra ha il suo "Perché?".
- Tono da sportello fiscale o da rimprovero. Se la quota era bassa si dice "alziamo la percentuale", senza colpe.
- Soldi contati due volte: lo stesso euro nel vaso tasse e nel disponibile, oppure un incasso registrato due volte.

## Vincoli

- Next.js 16.3.3 (leggere `node_modules/next/dist/docs/` prima di scrivere codice), React 19, Tailwind 4 e Supabase con RLS. Test con vitest e Testing Library.
- La migrazione è nuova, la **0010**, e Fabio la lancia a mano. Le migrazioni da 0001 a 0009 non si toccano. In fondo al file va un rollback commentato, come nelle precedenti.
- L'aspetto segue "Il Libretto" (DESIGN.md). Componenti esistenti: CoverHeader, FoglioInferiore, SceltePill, AvvisoAnnulla, `.num` e il serif per le cifre grandi.
- Le eliminazioni hanno l'annullamento in 5 secondi, come nel resto dell'app.
- Testi in italiano semplice e senza gergo. Un termine tecnico (acconto, saldo, coefficiente) si spiega la prima volta che compare.
- Le notifiche fuori dall'app sono rare: usano il cron `/api/promemoria` che esiste già.
- Ogni utente vede solo la propria P.IVA. I membri della casa non vedono la P.IVA degli altri.

## Strade considerate

1. **Tabelle nuove per la P.IVA, con operazioni atomiche nel database.** È la strada scelta. Le fatture e le scadenze hanno tabelle proprie. Incasso, quota spostata e saldi dei conti diventano una sola operazione. Richiede più codice, ma ogni concetto ha il suo nome e i calcoli si testano bene.
2. **Riusare entrate e obiettivi senza tabelle nuove.** Una fattura in attesa diventerebbe un'entrata con data futura, una scadenza un obiettivo. Scartata: le entrate non incassate finirebbero nello Storico e nel disponibile, e un F24 sembrerebbe un "obiettivo". È fragile proprio dove ci sono soldi veri, e insegna male.

Fabio ha scelto la prima.

## Il disegno

### Modello dei soldi

```
Fattura emessa (in attesa)  ──"pagata"──►  Incasso sul conto personale
                                              │
                                              ├─ quota tasse ──"Fatto"──► conto tasse (il vaso)
                                              │                              │
                                              │                              └─► paga F24 / ENPAP
                                              └─ resto ──► cuscinetto ──► stipendio del mese (Home)
```

- **Conto tasse:** uno dei conti di Miriam, scelto durante l'impostazione e messo fuori dal disponibile (`conta_in_disponibile = false`). Il suo saldo è il vaso.
- **Cuscinetto:** non è un conto né un obiettivo. È **calcolato**: quello che resta sui conti del disponibile oltre lo stipendio ancora da spendere nel mese.
- **Disponibile in Home:** per chi ha lo stipendio attivo è il minore tra il disponibile di oggi e lo stipendio rimasto del mese. Lo stipendio rimasto è lo stipendio meno le spese personali del mese. Il margine giornaliero si calcola fino a fine mese, non fino alla prossima entrata stimata, perché con entrate irregolari quella data non ha senso. Se il disponibile reale scende sotto lo stipendio rimasto, il cuscinetto è vuoto. L'app lo dice con calma e propone di rivedere lo stipendio.

### 1. Impostazione guidata e quota per incasso

- Il modulo con 8 campi diventa una sequenza breve, con una decisione per schermata:
  1. che lavoro fai e a quale cassa sei iscritta (preset "Psicologa, ENPAP" oppure "Altro");
  2. quando hai aperto la P.IVA (decide se l'aliquota è 5% o 15%);
  3. quale conto usi per le tasse (un conto esistente, oppure "creane uno");
  4. riepilogo dei parametri compilati dal preset, ognuno con la sua nota "dove lo trovi", e un tocco su "Confermo".
- Il preset ENPAP propone: coefficiente 78%, soggettivo 10%, integrativo 2%, minimale soggettivo 856 €. Questi valori vengono da guide non ufficiali e vanno confermati con il commercialista o nell'area riservata ENPAP. L'app lo dice nella nota.
- Le note "dove lo trovi" rimandano alla dichiarazione dei redditi dell'anno prima, all'area riservata della cassa, oppure a "chiedi al commercialista". I testi esatti li scrive il builder, in parole semplici.
- **Percentuale per incasso:** l'app la ricava dai parametri e la mostra come un numero solo, "metti da parte il 14%". Il "Perché?" mostra il dettaglio: imposta, soggettivo e integrativo, ciascuno con una riga di spiegazione. La formula di partenza è prudente:
  - `coefficiente × (aliquota sostitutiva + soggettivo) + integrativo`;
  - non toglie la deduzione dei contributi;
  - per esempio: 78% × (5% + 10%) + 2% ≈ 13,7%; con il 15% di aliquota ≈ 21,5%.
- **Controllo annuale del minimale:** l'app stima anche il totale dell'anno, con le funzioni di `piva.ts` che già tengono conto del minimale. Se il minimale supera quanto si accumulerebbe con la percentuale, mostra la differenza da aggiungere ("il minimo ENPAP è 856 €: aggiungi 120 € entro l'anno").
- **Dopo ogni incasso P.IVA** (cioè ogni entrata nella categoria del fatturato) compare: "Di 600 € metti da parte 82 € sul conto tasse". Ci sono due bottoni:
  - "Fatto, li ho spostati": registra lo spostamento e i saldi dei due conti in una sola operazione;
  - "Più tardi": lo spostamento resta nel "Da fare" finché non viene fatto.
- Il prompt compare uguale qualunque sia la strada dell'incasso: una fattura segnata "pagata", un incasso diretto dalla pagina P.IVA (i contanti in studio) oppure un'entrata aggiunta dal modulo normale con la categoria del fatturato.
- **Il vaso** mostra il saldo del conto tasse. Mostra anche un confronto annuale, scelto da Fabio come "totale dell'anno":
  - quanto è stato messo da parte quest'anno, cioè la somma di `piva_accantonamenti` dell'anno;
  - la stima delle tasse sugli incassi dell'anno, cioè il totale di `piva.ts` con il minimale;
  - la differenza tra i due: "Quest'anno servono circa 4.300 €, ne hai messi da parte 3.100 €".
- Non ci sono stime per le singole scadenze. Gli acconti dipendono dall'anno precedente e da divisioni incerte, quindi una cifra per scadenza rischierebbe di essere sbagliata.

### 2. Scadenze

- Ogni anno l'app prepara 4 scadenze attese, con le date modificabili:
  - F24 di fine giugno: saldo dell'anno prima e primo acconto;
  - F24 di fine novembre: secondo acconto;
  - acconto ENPAP, verso inizio marzo;
  - saldo ENPAP, verso inizio ottobre.
- Le date ENPAP sono indicative. Per un'altra cassa le date si cambiano o si tolgono.
- Finché la cifra vera non arriva, la scadenza mostra solo la data e "cifra in arrivo dal commercialista", senza stima.
- Quando arriva l'F24 o l'avviso ENPAP, Miriam inserisce la cifra (e la data, se diversa).
- Il confronto è immediato: "Nel vaso ci sono 3.100 €, servono 3.400 €: mancano 300 €". Propone di alzare la percentuale e spiega perché è successo, senza colpe.
- "Pagata" registra un'uscita dal conto tasse e chiude la scadenza, in una sola operazione.
- **Il primo anno:** il vaso parte dal saldo attuale del conto tasse. L'app spiega una volta, con parole semplici, che gli acconti si calcolano sull'anno precedente, quindi le prime scadenze possono non coincidere con quanto messo da parte.
- **Il "Da fare" della Home** mostra una scadenza 15 giorni prima. Il posto era già riservato nella spec del 2026-11-11.
- **Notifica fuori dall'app:** una sola, 7 giorni prima della scadenza, con il cron che esiste già.

### 3. Fatture in attesa

- "Nuova fattura" chiede tre cose: chi, quanto, data di emissione (oggi di default). Si inserisce in pochi secondi.
- Per i pazienti che pagano subito c'è "pagata adesso", attivo di default per i pagamenti in studio. Così fattura e incasso sono un'operazione sola.
- La lista "Ti devono" mostra il totale e le fatture ordinate dalla più vecchia. Quelle oltre i 60 giorni sono in evidenza e compaiono nel "Da fare".
- Toccando "Pagata" si sceglie la data (oggi di default) e il conto (il personale di default). Si crea l'entrata nella categoria del fatturato e si aggiorna il saldo, in una sola operazione. Poi compare il prompt della quota tasse.
- Il "Perché?" sulla lista spiega: "Nel forfettario le tasse si pagano su quello che incassi, non su quello che fatturi. Questa fattura non è ancora soldi tuoi, ma neanche tasse da pagare."
- Si possono eliminare (con l'annullamento) e correggere.

### 4. Stipendio

- **La proposta**, mostrata una sola volta:
  - **A**: incassi netti medi degli ultimi 6 mesi, cioè gli incassi meno la percentuale tasse;
  - **B**: quanto le serve al mese, cioè la media delle spese personali degli ultimi 3 mesi più la quota della casa, se c'è;
  - l'app propone il minore. Miriam conferma con "Va bene" o cambia la cifra.
- **Con meno di 3 mesi di incassi nell'app**, chiede una cosa sola: "In un mese magro, quanto incassi più o meno?" Usa quel numero al posto di A.
- **Ogni 3 mesi** l'app ricalcola. Se la proposta si discosta di più del 10%, mette nel "Da fare" una voce con la spiegazione: "Negli ultimi mesi hai incassato di più: puoi alzare lo stipendio a 1.500 €".
- **Cuscinetto e Home:** sono descritti sopra, in "Modello dei soldi". La pagina P.IVA mostra quanto c'è nel cuscinetto e per quanti mesi di stipendio basterebbe: "il cuscinetto copre 2,3 mesi".

### Pagina P.IVA (hub)

Quando la P.IVA è attiva, una pagina unica in ordine di importanza:

```
P.IVA · novembre
Stipendio di questo mese     1.300 €   (te ne restano 640)
Cuscinetto                   2.900 €   copre 2,2 mesi
Vaso tasse                   3.100 €   anno: servono ~4.300 · prossima F24 30/11
Ti devono                    2.400 €   3 fatture, 1 da 90 giorni
[+ Incasso]  [+ Fattura]
Scadenze dell'anno  ›   Impostazioni  ›
```

Ogni riga ha il suo "Perché?" o porta al dettaglio. L'aspetto definitivo lo fissa impeccable, nel mondo "Il Libretto".

### Dati: la migrazione 0010

Le colonne esatte le sceglie il builder. Il contenuto minimo è questo.

- **`piva_settings`, colonne nuove:**
  - `conto_tasse_id` (conto);
  - `preset` (testo, per esempio `'enpap'`);
  - `stipendio_mensile` (numerico, può mancare);
  - `stipendio_rivisto_il` (data);
  - `incasso_mese_magro` (numerico, può mancare).
  - I default delle colonne vecchie non si toccano: il preset scrive i valori.
- **`piva_fatture`:**
  - id, user_id, cliente, importo, data_emissione, data_incasso (vuota finché non è pagata), transaction_id (l'entrata creata), nota, created_at;
  - RLS solo per chi la possiede.
- **`piva_accantonamenti`:**
  - id, user_id, transaction_id (l'incasso da cui nasce, opzionale per i versamenti a mano), importo, data, created_at;
  - registra ogni spostamento verso il vaso.
- **`piva_scadenze`:**
  - id, user_id, anno, tipo (`'f24'` o `'cassa'`), descrizione, data, importo (vuoto finché non arriva la cifra vera), pagata_il, transaction_id (l'uscita);
  - RLS solo per chi la possiede.
- **Funzioni RPC, ognuna atomica e `security invoker`:**
  - incassare una fattura: entrata e saldo del conto;
  - spostare la quota nel vaso: due saldi e la riga in `piva_accantonamenti`;
  - pagare una scadenza: uscita dal conto tasse, saldo e chiusura della scadenza;
  - **aggiungere un movimento e aggiornare il saldo**, cioè la versione atomica del flusso di aggiunta normale. È il debito indicato nella ROADMAP. Lo usano sia la P.IVA sia il modulo di aggiunta.

### Consegna a pezzi

Ogni pezzo si consegna con test, review e un commit su master:

1. migrazione 0010 e RPC, compresa l'aggiunta atomica usata dal modulo normale;
2. impostazione guidata, percentuale, prompt della quota, vaso;
3. scadenze, "Da fare" e notifica;
4. fatture in attesa;
5. stipendio, cuscinetto e Home;
6. finitura impeccable, anteprima `/anteprima?vista=piva…` e documentazione (ROADMAP, DESIGN.md se servono componenti nuovi).

## Decisioni prese dopo la verifica del builder

Queste scelte sono mie, prese durante la verifica del documento. Fabio può correggerle.

- **Ambito solo personale.** Il conto tasse, la categoria del fatturato e tutti i movimenti P.IVA sono personali (`household_id is null`). Le RPC rifiutano i conti e le categorie della casa.
- **Lo spostamento nel vaso** si registra in `piva_accantonamenti` e muove i due saldi. Nello Storico compare come una riga neutra, "Spostato sul conto tasse", che non conta né come spesa né come entrata.
  - Se Miriam elimina l'incasso, la fattura collegata torna "in attesa". Lo spostamento resta, perché in banca è avvenuto davvero, ma perde il collegamento con l'incasso.
  - Lo spostamento si può eliminare a parte, con l'annullamento; i saldi tornano come prima.
  - Correggere o eliminare un'entrata collegata a una fattura segue le stesse regole.
- **"Più tardi" non lascia soldi liberi per sbaglio.** La quota non ancora spostata si toglie subito dal disponibile, come si fa già con `riservaVersamento`. Si aggiunge un input a `computeDisponibileLibero`.
- **Formule della Home per chi ha lo stipendio:**
  - *Spese del mese:* le uscite del mese dai conti del disponibile, più i versamenti alla casa fatti nel mese, meno le spese collegate agli obiettivi (già riservate). I pagamenti dal conto tasse non contano, perché quel conto è fuori dal disponibile.
  - *Stipendio rimasto:* stipendio − spese del mese − `riservaVersamento`.
  - *Disponibile mostrato:* il minore tra `disponibileLibero` (già al netto di obiettivi, versamento, debiti e quota non spostata) e lo stipendio rimasto.
  - *Cuscinetto:* `disponibileLibero` − stipendio rimasto, dove lo stipendio rimasto non scende mai sotto zero. Con le spese oltre lo stipendio il cuscinetto è uguale al disponibile e l'eccedenza si dice in una frase ("Hai già speso 120 € più dello stipendio di questo mese."), con "0 €" rimasti. "Copre N mesi" = cuscinetto ÷ stipendio.
  - *Margine giornaliero:* fino a fine mese, solo per chi ha lo stipendio. Per gli altri non cambia niente.
  - *Caricamento:* `loadHomeData` legge `piva_settings` per tutti. Le altre tabelle P.IVA le legge solo se la P.IVA è attiva.
- **Proposta dello stipendio:**
  - **A**: media mensile delle entrate di categoria fatturato negli ultimi 6 mesi solari interi, × (1 − percentuale tasse);
  - **B**: media delle spese del mese, definite come sopra, negli ultimi 3 mesi interi, più la quota mensile della casa dal piano, se c'è.
- **Impostazioni esistenti.** Le righe già presenti in `piva_settings` ricevono `preset` vuoto. Alla prima apertura dell'hub, se manca il conto tasse, parte l'impostazione guidata già compilata con i valori salvati. Il vecchio cruscotto sparisce: il fatturato dell'anno e la stima annuale finiscono nel "Perché?" del vaso, la "quota mensile suggerita" non serve più.
- **Notifica della scadenza.** È un tipo nuovo in `/api/promemoria`, con un proprio segno della data dell'ultimo invio. Passa da `decidiNotifica` e rispetta il limite di una notifica al giorno. Nei 7 giorni prima di una scadenza ha la precedenza sulle altre. Il cron filtra sempre per utente.
- **Creazione delle scadenze.** Le crea l'hub quando si apre, senza doppioni: una sola per utente, anno e chiave (`f24_giugno`, `f24_novembre`, `cassa_acconto`, `cassa_saldo`).
  - Se la P.IVA si attiva a metà anno, si creano solo le scadenze future.
  - Una scadenza tolta resta come "nascosta" e non si ricrea.
- **Categorie.** Al primo pagamento di una scadenza si crea la categoria di spesa "Tasse e contributi". Compare nello Storico, ma non pesa sullo stipendio, perché esce dal conto tasse. Gli incassi in contanti o con il POS vanno sul conto personale di default; si può scegliere un altro conto.
- **Aggiunta atomica.** La nuova RPC copre solo la **creazione** di un movimento e mantiene il collegamento all'obiettivo, l'ambito della casa e i ricorrenti. Modifica ed eliminazione restano come sono e sono fuori da questo lavoro.

## Lasciato al builder

- Nomi esatti di colonne, funzioni e componenti, coerenti con il codice esistente.
- Testi in italiano delle note e dei "Perché?", seguendo i principi di PRODUCT.md.
- Come si inserisce il prompt della quota nel flusso di aggiunta che esiste già, senza aggiungere passaggi per chi non ha la P.IVA.
- Come gestire un'entrata di categoria fatturato aggiunta senza fattura: vale come incasso diretto.
- Dove compare la dichiarazione "stima, la conferma è del commercialista": una volta nel hub e nel "Perché?", non su ogni schermata.
