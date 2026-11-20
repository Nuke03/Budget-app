# Rimetti a rate e Sposta tra i tuoi conti

Data: 20 novembre 2026. Stato: approvata da Fabio il 20 novembre 2026.
Seconda spec del blocco "deve essere semplice". Parte dalla prima (`2026-11-20-orientarsi-design.md`): aggiunge due voci al menu del + e usa la parola "cassetto" (l'ex "obiettivo") come lì.

## Perché

Fabio e Miriam hanno comprato i biglietti di un concerto. Miriam li ha pagati direttamente dal suo conto risparmio, un conto in banca separato (anche Fabio ne ha uno). Vogliono segnare la spesa e poi rimettere quei soldi nel risparmio un po' al mese: una rata fatta a se stessi, l'"autorata".

Oggi l'app sa farlo solo per il fondo imprevisti, con il "Sì" dell'avviso sui fondi (`rifondaImprevisti`), e senza scegliere i mesi. Non sa spostare soldi fra due conti, tranne la quota delle tasse di Miriam.

Fabio vuole l'autorata per tutto: conti risparmio, cassetti personali e cassetti di Casa ("tanto si usa solo se serve"). E vuole che non dipenda dalla costanza: l'app tiene da parte la rata da sola e ricorda quando c'è da spostare soldi veri.

Il valore educativo: rimborsare se stessi è un modo concreto di trattare una spesa grande presa dai risparmi. Il risparmio torna dove era, senza pesare tutto su un mese.

## Obiettivi

- Si sceglie dove rimettere (un conto risparmio, un cassetto personale, un cassetto di Casa), quanto e in quanti mesi; l'app calcola la rata.
- Ogni mese la rata esce dal disponibile da sola.
- Per un cassetto il cassetto risale da solo. Per un conto la Home ricorda "Sposta … sul …" e "Fatto, li ho spostati" aggiorna i due saldi.
- "Sposta tra i tuoi conti" esiste per tutti i conti personali, anche senza autorata.
- Dopo una spesa presa da un conto risparmio, l'app propone l'autorata con una domanda.

## Cosa non si fa

- Il fondo imprevisti e il suo "Sì" restano come sono.
- La quota delle tasse di Miriam resta com'è (le sue tabelle e il suo "Fatto, li ho spostati"). Non si unifica con "Sposta".
- Niente autorata verso i conti della Casa e niente "Sposta" fra conti della Casa: arrivano dopo, se servono.
- Niente notifiche sul telefono nuove: il ricordo è solo nella Home.
- L'autorata non cambia da sola la quota della Casa.
- Dopo una spesa da un cassetto l'app non chiede niente (spesso la spesa è proprio lo scopo del cassetto).
- Niente interessi, niente scadenze di pagamento, niente "sei in ritardo".

## Cosa sarebbe un fallimento anche se funziona

- Il disponibile conta due volte la stessa rata (per esempio la tiene da parte e intanto il saldo è già stato spostato).
- Un cassetto sale oltre quanto dovrebbe esserci.
- La domanda dopo la spesa compare quando non c'entra (spesa da un conto che conta nel disponibile, conto tasse).
- Le rate non spostate diventano un rimprovero ("sei indietro di 3 rate").
- Uno "Sposta" fallito a metà lascia un saldo cambiato e l'altro no.
- Miriam vede l'autorata di Fabio su un conto personale di lui, o viceversa.

## Approcci considerati

- **A. Ogni autorata è una "rata" a sé, salvata a parte** (dove, quanto, mesi, da quando). L'app calcola quanto è maturato. Per un cassetto lo aggiunge al cassetto. Per un conto lo toglie dal disponibile finché non lo sposti. "Sposta" è un movimento vero che aggiorna i due saldi insieme. Pro: una regola sola per conti, cassetti e Casa; il cassetto non si ritocca; si annulla cancellando l'autorata; i mesi li scegli tu. Contro: serve la migrazione 0013, e il nuovo calcolo va portato in ogni punto in cui si calcola il disponibile. **Scelto da Fabio.**
- B. Ogni autorata diventa un cassetto nuovo ("Rientro concerto"). Per un cassetto svuotato ci sarebbero due cassetti ("Vacanze" e "Rientro Vacanze") che confondono; per un conto lo spostamento va costruito comunque. Scartato.
- C. Per i cassetti si allarga il meccanismo del fondo imprevisti, per i conti si copia il vaso delle tasse. Sul cassetto i mesi non si scelgono (la rata resta, si allunga la scadenza), e conti e cassetti funzionano in due modi diversi. Scartato.

## Le parole

- **Rimetti a rate**: la voce del menu e il titolo del foglio.
- **Rientro**: come si chiama sulla card ("Rientro: 100 € al mese fino a gennaio").
- **Sposta tra i tuoi conti**: la voce del menu. Il movimento nello Storico si legge "Spostato da Corrente a Risparmio".
- Niente "autorata", "debito", "rimborso" nei testi: l'autorata è il nome che usa Fabio, non serve nell'app.
- Testi senza "devi/dovresti", senza colpa, devono passare `PAROLE_VIETATE`.

## Come funziona un rientro

Un rientro ha:
- di chi è: personale (di chi lo crea) o della casa (visibile e modificabile da tutti i membri attivi, come le spese di casa);
- dove va: **un cassetto** (personale o della casa) oppure **un conto personale che non conta nel disponibile** (escluso il conto tasse della P.IVA guidata). Mai tutti e due, mai un conto della casa;
- quanto (fra 0 escluso e 1 miliardo escluso, ai centesimi);
- i mesi (2, 3, 4, 6 o 12);
- il mese di partenza: quello in cui si crea;
- lo stato salvato: aperto o fermato. "Finito" non si salva, si calcola (cassetto: dopo l'ultimo mese; conto: spostato ≥ quanto), così eliminare uno spostamento riapre da solo un rientro che sembrava finito.

Un rientro non si modifica: per cambiare cifra o mesi si ferma e se ne crea un altro. (Scelta di Claude.)

**La rata.** `rata = arrotonda2(quanto / mesi)`. L'ultima rata prende i centesimi che avanzano, così la somma è esattamente "quanto".

**Il maturato.** La prima rata è quella del mese di partenza, anche se il rientro nasce l'ultimo giorno del mese (l'ha scelto chi lo crea). Nel mese k (contando da 1 il mese di partenza, giorno di Roma) il maturato è `min(quanto, rata × k)`, e dopo l'ultimo mese è `quanto`. Un rientro fermato resta al maturato del mese in cui si è fermato.

### Verso un cassetto

Il riservato del cassetto diventa:

- cassetto senza conferme ("a tempo", e tutti i bloccati): `max(0, min(teorico, teorico − speso collegato + maturato dei suoi rientri))`;
- cassetto con conferme ("Versa nel cassetto"): `max(0, min(teorico, versato − speso collegato))`. Qui il maturato non si aggiunge da solo: la rata entra nella conferma del mese (la cifra proposta da "Versa nel cassetto" è rata del cassetto + rate dei rientri del mese).

`teorico` è quello di oggi (`computeAccantonatoTeorico`). Il tetto `min(teorico, …)` fa sì che il cassetto non salga mai oltre quanto dovrebbe esserci: basta questo, non serve un secondo tetto sullo speso. Se "quanto" è più dello speso, o se il rientro è nato in un ciclo precedente di un cassetto ricorrente (lo speso collegato riparte da zero a ogni ciclo), il di più si ferma al tetto e non ha effetto: va bene così.

Nei cassetti con conferme il maturato non entra mai nel calcolo e non c'è un legame fra versamento e rientro: un versamento è una riga sola, come oggi. "Come si calcola?" mostra il rientro come informazione ("Rientro: 100 € al mese, si conferma con Versa nel cassetto"), senza sommarlo. Se si versa solo la rata del cassetto, il cassetto risale meno: nessun avviso.

**Cambio di regola sui cassetti con conferme (scelta di Claude).** Oggi il riservato è `max(0, min(teorico, versato) − speso)`. La regola nuova `min(teorico, versato − speso)` dà lo stesso numero finché il versato non supera il teorico. Se lo supera, conta i soldi che ci sono davvero (versato meno speso), sempre senza superare il teorico. Senza questo, versare la rata di un rientro in un cassetto con conferme non lo farebbe mai risalire. Il cambio vale per tutti i cassetti con conferme, con o senza rientro.

Il riservato del cassetto va nel disponibile (personale o della casa) come oggi. "Come si calcola?" del cassetto mostra una riga in più per ogni rientro aperto: "Rientro: +… €".

### Verso un conto

Il conto non conta nel disponibile, quindi il cassetto non c'entra. La rata si toglie dal disponibile personale finché non è spostata:

`da spostare = max(0, maturato − spostato verso quel rientro)`

"Spostato verso quel rientro" non ha bisogno di un legame: conta ogni spostamento **verso il conto del rientro** **da un conto che conta nel disponibile**, con data dal giorno di creazione del rientro in poi, comunque sia stato fatto (dalla Home o dal menu). Gli altri spostamenti (da un conto che non conta, o in uscita dal conto del rientro) non contano. Con più rientri aperti sullo stesso conto, gli spostamenti vanno prima al rientro più vecchio. Così il disponibile scende una volta sola: quando si sposta, il saldo del conto di partenza cala di X e il "da spostare" cala di X. (Scelta di Claude.)

e il disponibile personale diventa `… − da spostare` di tutti i rientri aperti, come oggi `riservaPiva`. "Come si calcola?" del disponibile mostra la riga "Da spostare sui conti risparmio".

Quando "spostato" arriva a "quanto", il rientro è **finito**. Se si sposta più del dovuto, il di più vale per le rate dopo (il da spostare resta a 0).

Le rate non spostate si sommano nel "da spostare". La Home non dice "sei indietro": dice solo la cifra di adesso.

### Fermare, annullare

- **Ferma**: sulla card del cassetto o del conto c'è "Ferma" accanto al rientro. Da lì non matura più niente. In un cassetto con conferme i versamenti fatti restano (sono soldi veri). Per un conto, quello che è maturato e non ancora spostato resta da spostare finché non lo sposti o non tocchi "Lascia stare": "Lascia stare" chiude il rientro e il da spostare torna a 0.
- **Cancellare** un rientro appena creato: si fa con l'avviso "Annulla" di 5 secondi, come le altre eliminazioni.
- Cancellare la spesa da cui è nato non cancella il rientro (si possono avere motivi diversi); il rientro resta e si può fermare.

## Sposta tra i tuoi conti

Un movimento con: da (conto personale), a (conto personale diverso), quanto (come sopra), data (non nel futuro, giorno di Roma). Nessun legame salvato con i rientri: vedi la regola sopra.

- Si salva con una sola chiamata al database che scrive il movimento e cambia i due saldi insieme: o tutto o niente.
- Nello Storico è una riga "Spostato da Corrente a Risparmio" con la cifra, nel giorno giusto. Non è una spesa né un'entrata, non entra nei totali per categoria né nell'andamento del mese.
- Si elimina dallo Storico come le altre righe, con "Annulla": l'eliminazione rimette i due saldi com'erano, sempre in una sola chiamata, anche se nel frattempo un conto è stato archiviato o il saldo è stato aggiornato a mano (come fa oggi l'annullamento della quota tasse).
- Effetto sul disponibile: se "da" conta nel disponibile e "a" no, il disponibile scende; al contrario sale; fra due conti che contano, non cambia.
- Solo conti personali di chi scrive, non archiviati.

## Dove si vede

### Nel menu del +

Due voci nuove, dopo "Ci penso su" e prima delle voci che dipendono dai dati (l'ordine della prima spec resta: quelle che dipendono dai dati sono in fondo):

| Voce | Riga sotto |
|---|---|
| **Rimetti a rate** | Riporta un po' al mese soldi presi dai risparmi |
| **Sposta tra i tuoi conti** | Da un conto all'altro, i saldi si aggiornano |

"Sposta tra i tuoi conti" compare solo se ci sono almeno due conti personali. "Rimetti a rate" sempre: se non c'è dove rimettere, il foglio lo dice e propone "Metti da parte".

### Il foglio "Rimetti a rate"

Un passo alla volta, come i fogli della Casa:

1. **Dove li rimetti?** Una scelta con: i conti personali che non contano nel disponibile (escluso il conto tasse), i cassetti personali aperti, i cassetti di casa aperti (con l'etichetta "Casa"). Un cassetto con un rientro già aperto si può scegliere ancora: i rientri si sommano.
2. **Quanto?** Per un cassetto parte da quanto è stato speso dal cassetto e non è ancora rientrato (se è 0, campo vuoto). Per un conto, campo vuoto.
3. **In quanti mesi?** Pillole 2, 3, 4, 6, 12, parte da 3. Sotto, la frase: "100 € al mese, da novembre a gennaio." (mesi scritti per esteso).
4. **Rimetti a rate** (bottone primario). Per un cassetto di casa sotto c'è "Lo vedrà anche Miriam" (la nota che usa già il foglio della spesa).

### La domanda dopo una spesa

Dopo il salvataggio di una spesa personale da un conto che non conta nel disponibile (escluso il conto tasse), compare un foglio:

- titolo: "Vuoi rimetterli un po' al mese?"
- frase: "Hai preso 300 € dal Risparmio. Puoi riportarli lì un po' alla volta."
- le pillole dei mesi con la frase della rata;
- "Sì, rimettili" (primario) e "No, va bene così" (neutro).

"Sì" crea il rientro verso quel conto, per l'importo della spesa. Precedenza fra i fogli dopo il salvataggio: quota P.IVA, poi questa domanda, poi avviso sui fondi, poi lezione (uno solo per volta, gli altri dopo, come oggi).

### Sulle card

- **Cassetto** (Cassetti e Da parte della Casa): sotto il riservato, "Rientro: 100 € al mese fino a gennaio" e "Ferma". Se il cassetto ha speso collegato e nessun rientro aperto, un link "Rimetti a rate" apre il foglio con quel cassetto già scelto.
- **Conto** (Conti): "Rientro: 100 € al mese fino a gennaio", "Da spostare: 200 €", "Ferma".

### Nella Home

Quando un rientro verso un conto ha qualcosa da spostare, la card "Prossimo" (una cosa alla volta, con le regole di priorità che ha già) può mostrare: "Sposta 100 € sul Risparmio." con "Fatto, li ho spostati".

"Fatto, li ho spostati" apre "Sposta tra i tuoi conti" già compilato: da = il conto che conta nel disponibile usato più di recente (come fa `contoDaCuiSpostare` per le tasse), a = il conto del rientro, quanto = da spostare, data = oggi. Si può cambiare la cifra (spostamento parziale).

## Migrazione 0013

Si lancia a mano nel SQL editor, come le altre. Le migrazioni già applicate (fino alla 0012) non si toccano.

Contiene:
- la tabella dei rientri e quella degli spostamenti, con le regole di accesso (RLS): le righe personali solo per chi le ha scritte; le righe di casa (solo rientri verso un cassetto di casa) per i membri attivi della casa. Un rientro personale può puntare solo a un cassetto o a un conto di chi scrive; uno di casa solo a un cassetto di quella casa;
- i controlli nel database: dove va è un cassetto oppure un conto, mai tutti e due; il conto non conta nel disponibile; importo fra 0 e 1 miliardo esclusi; mesi in {2, 3, 4, 6, 12}; data dello spostamento non nel futuro; da ≠ a;
- la funzione che sposta (movimento + due saldi in una sola transazione, solo conti di chi scrive) e quella che annulla uno spostamento;
- le tre difese che la ROADMAP aveva già previsto per la 0013 (scelta di Claude: un solo SQL da lanciare): la `WITH CHECK` di `piva_quote_scartate` verifica che la transazione sia di chi scrive; `adjust_account_balance` tolta ad `authenticated` (nel codice dell'app non ci sono chiamate dirette; chi costruisce controlla che le funzioni SQL che la usano siano `security definer`, altrimenti le sistema nella stessa 0013); lettura di `goal_versamenti` limitata per data;
- un test SQL in `supabase/tests/` come per la 0011.

"Ricomincia da zero" cancella anche rientri personali e spostamenti (non quelli della casa).

## Vincoli

- Next.js 16.3.3: prima di scrivere codice leggere `AGENTS.md` e la guida in `node_modules/next/dist/docs/`.
- Supabase free tier, nessun costo, nessuna dipendenza nuova.
- Mondo "Il Libretto": fogli, pillole per le scelte brevi, cifre serif tabulari, niente colori nuovi.
- Ogni cifra in euro con `formatEuro`, date nelle frasi per esteso.
- Ogni scrittura come le altre: interfaccia subito, errore detto con calma se fallisce.
- Lo spazio personale resta invisibile agli altri membri: rientri e spostamenti personali non compaiono mai in Casa.

## Lasciato a chi costruisce

- I nomi esatti di tabelle, colonne e funzioni SQL, e la forma del test SQL.
- Come il maturato e il "da spostare" arrivano nei punti in cui si calcola il disponibile (Home, Casa, percorso, avviso sui fondi, "Come si calcola?"), purché in un solo calcolo condiviso.
- Come lo Storico legge gli spostamenti insieme alle transazioni.
- I testi definitivi, partendo da quelli qui, con le stesse regole.
- La copertura dei test (calcolo del maturato e dei tetti, RLS, spostamento atomico, fogli, domanda dopo la spesa).
