# Orientarsi: il menu del + e i fumetti

Data: 20 novembre 2026. Stato: approvata da Fabio il 20 novembre 2026.
Questa è la prima di due spec del blocco "deve essere semplice". La seconda ("Sposta tra i conti" e le rate fatte a se stessi) arriva dopo e aggiunge due voci al menu descritto qui.

## Perché

Fabio ha fatto provare l'app a Miriam senza spiegarle niente, di proposito: "l'app deve essere utilizzabile senza una persona che ti spiega passo passo dove premere". Miriam si è sentita spaesata nella navigazione. Non capiva quali possibilità ci fossero e cosa potesse fare con l'app.

Oggi le azioni sono sparse. Il + porta dritto alla spesa. Un'entrata richiede di toccare il riepilogo e cambiare tipo. Per mettere da parte o confermare una rata si passa da Altro, poi Obiettivi. La lista d'attesa sta in Altro. Niente dice cosa c'è dove.

Due risposte, insieme:
1. il + diventa la risposta a "cosa posso fare adesso?": un menu di azioni, ognuna con una riga che dice a cosa serve;
2. dei fumetti che spiegano l'app la prima volta: un giro breve della barra e un fumetto la prima volta che si entra in ogni schermata.

In più si dà un nome concreto alle cose: gli "Obiettivi" diventano "Cassetti".

## Obiettivi

- Chi apre l'app per la prima volta, senza nessuno accanto, capisce cosa può fare e dove.
- Ogni azione frequente parte dal +.
- La spesa resta veloce: + → "Registra una spesa" → importo → Salva. Sono 3 tocchi più le cifre, sotto i 10 secondi (vincolo di PRODUCT.md).
- L'entrata diventa più veloce: da 4 a 3 tocchi.
- I fumetti si vedono una volta sola e si possono rivedere quando si vuole.
- Un nome solo per ogni cosa: "cassetto" è una cifra che l'app tiene da parte, "conto" è un conto vero in banca.

## Cosa non si fa

- Niente nuove funzioni di calcolo: il menu apre flussi che esistono già. "Sposta tra i tuoi conti" e "Rimetti a rate" arrivano con la seconda spec.
- Niente tutorial in una modalità separata con dati finti: i fumetti indicano l'app vera.
- Niente migrazioni del database.
- Niente cambi di percorsi (le URL restano `/goals` ecc.) né dei nomi nel codice: cambia solo il testo che si legge.
- Niente nuove dipendenze (librerie di tour).

## Cosa sarebbe un fallimento anche se funziona

- La spesa richiede più di 3 tocchi, o il menu si apre in ritardo perché aspetta dei dati.
- I fumetti ricompaiono dopo essere stati chiusi, o se ne vedono due insieme.
- Un fumetto copre un foglio aperto, l'avviso dopo una spesa, o i Primi passi.
- I testi spiegano troppo, danno ordini ("devi"), o usano parole tecniche.
- Miriam, dopo il giro, si chiede ancora dove sono le cose.

## Approcci considerati

**Il menu del +**
- **A. Il + apre il menu, con "Registra una spesa" in cima e più grande.** È una mappa chiara di cosa si può fare, cioè proprio il problema di Miriam. Costa un tocco in più sulla spesa, circa un secondo. **Scelto da Fabio.**
- B. Il + apre la spesa come oggi, con una fila di altre azioni in alto nel foglio. La spesa resta a 2 tocchi, ma le altre azioni sono piccole, sotto la tastiera già aperta e un titolo "Nuova transazione": per chi non conosce l'app sembra una spesa, non un menu. Scartato.
- C. Un tocco apre il menu, il tocco lungo apre la spesa. Il tocco lungo non si vede: Miriam non lo troverebbe. Scartato.

**I fumetti**
- 1. Solo un giro breve della barra alla prima apertura. Spiega la mappa in un minuto, ma niente dentro le schermate.
- **2. Il giro breve più un fumetto la prima volta che si entra in ogni schermata.** La spiegazione arriva quando serve. **Scelto da Fabio.**
- Un giro lungo di tutte le funzioni all'inizio è stato scartato subito: si salta con "Avanti, Avanti" e si dimentica.

## Il menu del +

Il + della barra apre un foglio dal basso (`FoglioInferiore`) con il titolo **"Cosa vuoi fare?"**.

```
 ┌─────────────────────────────────────┐
 │ Cosa vuoi fare?                   ✕ │
 │ ┌─────────────────────────────────┐ │
 │ │  Registra una spesa             │ │  bottone primario pieno, 56px
 │ └─────────────────────────────────┘ │
 │  ↓  Entrata                       › │
 │     Uno stipendio, un rimborso      │
 │ ─────────────────────────────────── │
 │  ◫  Metti da parte                › │
 │     Crea un cassetto per una cosa   │
 │     che arriva                      │
 │ ─────────────────────────────────── │
 │  ⧗  Ci penso su                   › │
 │     Lista d'attesa prima di comprare│
 │ ─────────────────────────────────── │
 │  ✓  Versa nel cassetto            › │
 │     Conferma la rata del mese       │
 │ ─────────────────────────────────── │
 │  ⌂  Versa la quota della casa     › │
 │     Quanto ti tocca questo mese     │
 └─────────────────────────────────────┘
```

Le voci, nell'ordine. Le due che dipendono dai dati stanno in fondo: quando compaiono non spostano niente sopra di loro.

| Voce | Riga sotto | Cosa fa | Quando c'è |
|---|---|---|---|
| **Registra una spesa** (in Casa: **Registra una spesa di casa**) | nessuna | Apre il foglio della spesa di oggi, con l'importo e la tastiera pronti. Lo spazio (personale o Casa) segue le regole di oggi: dentro Casa parte da Casa, altrove ricorda l'ultima scelta. | Sempre |
| **Entrata** | Uno stipendio, un rimborso | Apre lo stesso foglio, già su Entrata. | Sempre |
| **Metti da parte** | Crea un cassetto per una cosa che arriva | Apre direttamente il modulo per creare un cassetto nuovo (oggi in Obiettivi). | Sempre |
| **Ci penso su** | Lista d'attesa prima di comprare | Apre la lista d'attesa con il campo "Cosa" pronto. | Sempre |
| **Versa nel cassetto** | Conferma la rata del mese (quando le rate del mese sono tutte confermate: "Le rate di questo mese sono fatte") | Apre la stessa conferma del bottone "Ho messo da parte" della card. Con un solo cassetto a rate apre subito la conferma di quel cassetto. Con più cassetti mostra prima la scelta del cassetto, con la rata accanto a ciascuno. Resta nel menu anche dopo la conferma: si può versare di più. | Solo se c'è almeno un cassetto personale a rate (oggi: obiettivo dilazionato con quota mensile) |
| **Versa la quota della casa** | Quanto ti tocca questo mese | Apre il versamento della quota della Casa (lo stesso modulo dei pannelli versamenti). | Solo se chi scrive è in una casa |

Regole:
- Il menu si apre subito, senza aspettare dati. Le voci che dipendono dai dati ("Versa nel cassetto", "Versa la quota") sono le ultime: compaiono quando i dati sono pronti, in fondo, senza spostare nessuna voce sopra di loro.
- I nomi: nel menu "Versa nel cassetto" dice cosa stai per fare; il bottone della card resta "Ho messo da parte" perché dice cosa hai fatto. Aprono la stessa conferma. "Metti da parte" è un'altra cosa: crea un cassetto.
- Stile "Il Libretto": la spesa è il bottone primario (Passbook Blue pieno, 56px, come l'azione unica della vista semplice di Casa); le altre sono righe da registro, alte almeno 56px, con icona lucide 20px, nome semibold 16px, riga sotto 13px in inchiostro tenue, chevron a destra, separate da filetti. Niente colori nuovi, niente ombre.
- Il bottone + nella barra cambia la sua etichetta accessibile in "Cosa vuoi fare?".
- Il bottone "Aggiungi una spesa di casa" della vista semplice di Casa resta com'è: apre la spesa direttamente, senza menu.
- Il "+ Incasso" della pagina P.IVA resta com'è.
- Dopo una spesa o un'entrata salvata tutto continua come oggi (timbro, avviso sui fondi, quota P.IVA, lezione).
- Dentro una schermata dove l'azione scelta ha già il suo foglio (per esempio Casa), l'azione si apre lì. Altrove si apre nella Home, come succede oggi con `?aggiungi=1`.

## Cassetti al posto di Obiettivi

In tutto il testo visibile, "obiettivo/obiettivi" diventa "cassetto/cassetti": la voce in Altro ("Cassetti"), il titolo della pagina, "Nuovo cassetto", le card, le frasi della Home e del consiglio, "Come si calcola?", le lezioni di Impara, i promemoria, le notifiche, gli avvisi. Anche i testi della Casa che dicono "obiettivo" passano a "cassetto"; il titolo "Da parte" della Casa resta.

Il conto in banca resta "conto" (per esempio "conto risparmio").

Non cambiano: le URL, i nomi nel codice, le tabelle, i messaggi d'errore scritti nelle funzioni del database (non si fanno migrazioni). Se uno di quei messaggi arriva sullo schermo così com'è, l'app lo sostituisce con un testo suo. I testi delle notifiche e dei promemoria sono costruiti dall'app al momento: cambiano da soli. Le notifiche già arrivate sul telefono restano come sono. I nomi scritti dall'utente (per esempio un cassetto chiamato "Obiettivo vacanze") non si toccano. I test che controllano i testi si aggiornano. La parola nuova deve passare `PAROLE_VIETATE`.

## I fumetti

### Il giro

Si vede una volta, alla prima apertura dell'app dopo questo rilascio. Lo vedono anche Fabio e Miriam, che hanno già un account.

Lo schermo si scurisce (velo piatto al 40%, come quello dei fogli, senza sfocatura). Il pezzo spiegato resta in luce, con un anello Passbook Blue. Accanto c'è il fumetto: carta bianca, filetto, raggio 1rem, una punta verso il pezzo. Contiene una frase in 15px, "1 di 5" in inchiostro tenue, "Avanti" (bottone primario piccolo) e "Salta" (azione di testo). All'ultimo passo "Avanti" diventa "Fatto".

| Passo | Pezzo in luce | Testo (bozza) |
|---|---|---|
| 1 | La cifra del disponibile nella Home | Questo è quanto puoi spendere adesso. I soldi dei cassetti sono già tolti. |
| 2 | Storico nella barra | In Storico trovi tutti i movimenti, giorno per giorno, e dove vanno i soldi. |
| 3 | Il + | Con il + registri una spesa in pochi secondi. Dentro trovi anche le altre cose che puoi fare. |
| 4 | Casa nella barra | Casa è lo spazio che condividete: spese comuni, quota del mese e se siete in pari. (Senza casa: Qui puoi creare una casa da condividere con chi vive con te.) |
| 5 | Altro nella barra | In Altro ci sono i cassetti, i conti, le lezioni di Impara e le impostazioni. |

Il giro si fa nella Home. Se l'app si apre su un'altra pagina, il giro aspetta la prossima volta che si è nella Home.

### Il fumetto della prima volta

La prima volta che si entra in una di queste schermate compare un solo fumetto, che indica il pezzo principale. Non scurisce niente e non blocca lo schermo. Si chiude con "Ho capito" o toccando la X.

| Schermata | Pezzo indicato | Testo (bozza) |
|---|---|---|
| Storico | La fila dei periodi | Scegli il periodo. Sotto vedi quanto è andato in ogni categoria. |
| Casa (chi gestisce) | La card "Da fare" | Qui c'è una cosa da fare alla volta. Quando è fatta, compare la prossima. |
| Casa (vista semplice) | La cifra della quota | Questa è la tua quota del mese: quanto versare nel conto di casa. |
| Cassetti | Il primo cassetto, o "Nuovo cassetto" se non ce ne sono | Un cassetto tiene da parte i soldi per una cosa che arriva. L'app li toglie dal disponibile un po' alla volta. |
| Conti | Il primo conto | Qui scrivi il saldo dei tuoi conti come lo vedi in banca. L'app non si collega alla banca. |
| Lista d'attesa | Il campo "Cosa" | Scrivi qui una cosa che vuoi comprare. Fra qualche giorno l'app ti chiede se la vuoi ancora. |
| Impara | La prima lezione | Lezioni da un minuto, con i tuoi numeri. Non c'è un ordine da seguire. |
| P.IVA | La cifra del vaso delle tasse | Qui vedi quanto c'è da parte per le tasse e le prossime scadenze. |

Home e Altro non hanno un fumetto proprio: li copre il giro.

### Regole comuni

- Un fumetto alla volta. Mai sopra un foglio aperto, l'avviso dopo una spesa, il foglio di conferma o l'avviso "Annulla": aspetta che si chiudano, o la prossima visita.
- Il fumetto della prima volta non compare nella stessa apertura del giro.
- I Primi passi (la card che nella Home prende il posto del consiglio finché i passi iniziali sono aperti) restano dove sono. Il giro viene prima: è la mappa, i Primi passi sono le cose da fare. Il passo 1 indica la cifra del disponibile, che sta sopra la card, e il velo copre anche la card finché il giro è aperto. Chiuso il giro, i Primi passi sono lì come oggi.
- Un fumetto della prima volta non copre mai i Primi passi: se il pezzo da indicare non si vede, aspetta la prossima visita.
- "Già visto" si salva sul telefono, separato per ogni persona (la chiave contiene l'id dell'utente e una versione). La versione è una costante nel codice, alzata a mano solo quando il giro o un fumetto cambia in modo che valga la pena rivederlo. Un rilascio qualsiasi non la tocca. Si può alzare la versione di un solo fumetto senza far ripartire il giro. Se il browser non salva, i fumetti non devono comparire a ogni apertura: in quel caso si mostrano al più una volta per sessione.
- In Altro c'è **"Rivedi il giro"**: fa ripartire il giro e tutti i fumetti della prima volta.
- "Ricomincia da zero" fa ripartire anche i fumetti.
- Accessibilità: il giro è un dialogo modale (il focus va su "Avanti", Tab resta dentro, Esc vale come "Salta", il focus torna dov'era). Il fumetto della prima volta è un dialogo non modale, annunciato una volta. Con il movimento ridotto niente animazioni. Bersagli da 44px.
- Testi: una frase, niente "devi/dovresti", niente colpa, niente parole tecniche, test `PAROLE_VIETATE`.

## Vincoli

- Next.js 16.3.3: prima di scrivere codice leggere `AGENTS.md` e la guida in `node_modules/next/dist/docs/`.
- Mondo "Il Libretto" (`DESIGN.md`): fogli, filetti, Passbook Blue, niente ombre né gradienti. Dopo il lavoro si aggiorna `DESIGN.md` con il menu e i fumetti.
- Nessun costo, nessuna dipendenza nuova, nessuna migrazione.
- iPhone, PWA installata, una mano sola. Il fumetto non deve mai uscire dallo schermo a 375px, e tiene conto delle zone sicure.

## Lasciato a chi costruisce

- Come il menu legge i dati di "Versa nel cassetto" e "Versa la quota" senza rallentare l'apertura.
- Come si apre ciascuna azione dalla pagina in cui si trova (eventi, parametri nella URL o foglio globale), purché rispetti le regole sopra.
- Come si misura e si segue il pezzo indicato dal fumetto (posizione, scorrimento, rotazione).
- La forma esatta della chiave "già visto" e il componente dei fumetti.
- I testi definitivi dei fumetti, partendo dalle bozze, con le stesse regole.
- La copertura dei test (menu, regole dei fumetti, rinomina dei testi).
