# Casa comune (pezzo 1 della co-gestione): design

Data: 2026-11-08
Stato: bozza completa con le decisioni di Fabio incorporate. Pronta per il piano di
implementazione: non restano decisioni aperte (sezione 15).

Documenti collegati: `docs/ROADMAP.md` (blocco 1), `PRODUCT.md`,
`docs/research/2026-11-08-economia-domestica.md` (sezioni 2, "Mappatura sull'app attuale",
"Idee didattiche"), `docs/superpowers/specs/2026-08-31-recurring-bills-goals-design.md`
(il motore degli obiettivi ricorrenti che qui si riusa).

Convenzione: **[Scelta del redattore]** segna una decisione presa in questa bozza che non
era nel brief. Sono raccolte alla sezione 16, così Fabio le può approvare o ribaltare.

Convenzione sui membri: una casa ha **N membri** (da 1 in su, nessun tetto). Nei testi e negli
schemi "l'altro", "l'altra persona", "{partner}" e "i due" descrivono il caso più comune di
due persone e si leggono naturalmente così; con più persone la UI usa i nomi, "gli altri" e
"tutti". Le regole, i calcoli e le RLS valgono per N.

## 1. Intento e perché

Fabio e la sua compagna stanno per prendere casa in affitto e apriranno un conto cointestato
su cui ognuno versa ogni mese una cifra fissa (modello "mio, tuo, nostro"). Oggi l'app tiene
i due account completamente isolati. Servono due cose insieme:

1. **Gestire** la parte comune: conto comune, spese di casa, bollette annuali, costi di
   ingresso, versamenti, anticipi pagati con la carta personale.
2. **Far imparare** come si gestiscono i soldi di una casa, perché nessuno dei due parte da
   esperienza. L'app non deve spiegare in astratto: ogni numero ha il suo "come si calcola?",
   ogni scelta ha numeri a fianco, ogni mese c'è un controllo breve.

Due vincoli di carattere guidano tutto: la compagna ha una P.IVA con reddito irregolare e
tende a dimenticare di registrare le spese, e trova poco chiari i concetti "bloccato" e
"dilazionato". Il design quindi evita quelle parole nella parte Casa, accetta che i dati siano
imperfetti (il controllo del saldo recupera le spese non registrate) e non giudica mai.

Il principio 3 di `PRODUCT.md` ("Two private worlds, one app") diventa "Due mondi privati,
uno comune": il personale resta invisibile all'altro, la casa è visibile a entrambi.

## 2. Obiettivi, non obiettivi, anti obiettivi

### Obiettivi
- Una casa condivisa, con conto comune e versamento mensile fisso per ciascuno.
- Calcolo guidato della quota mensile, rivedibile nel tempo.
- Il "disponibile libero" personale resta onesto: scala il versamento dovuto, senza doppio
  conteggio quando il bonifico viene registrato.
- Un "disponibile casa" analogo, per il conto comune.
- Spese comuni anche se pagate con la carta personale, con credito verso la casa e promemoria
  del rimborso.
- Bollette irregolari e costi di ingresso trasformati in "soldi messi da parte" in un tocco.
- Controlli periodici brevi (saldo del conto comune, check-in mensile, stima contro reale).
- Inserimento di una spesa casa in meno di 10 secondi.
- Un calendario privato in sola lettura (abbonamento ICS) con le scadenze della casa, senza
  integrazioni Google (sezione 9).
- Pezzi consegnabili in piccoli passi, il primo utile subito (la quota, prima ancora del conto).

### Non obiettivi (progetti separati o rimandati)
- **Pezzo 2, reddito irregolare**: "pagati uno stipendio" con cuscinetto per la P.IVA, guida
  alla configurazione P.IVA che spiega dove trovare ogni dato. Qui c'è solo il campo "reddito
  prudente" con una riga di spiegazione.
- **Pezzo 3, percorso di apprendimento** per le finanze personali.
- **Blocco 2 della roadmap**: redesign, DESIGN.md, cambio palette. Questo spec riusa la UI
  attuale (stessa hero card, sheet dal basso, nav flottante).
- Integrazione bancaria, modalità offline, **notifiche push** (decisione di Fabio: non ora,
  lavoro futuro, vedi sezione 9) e qualsiasi integrazione con Google (niente OAuth né API
  Google: il calendario è un feed ICS in sola lettura).
- Più case per persona (modello pronto, UI no).
- Divisione spesa per spesa stile Tricount, commenti, allegati di ricevute, esportazioni.
- Consulenza legale o fiscale: gli importi dei costi di ingresso sono indicativi e dichiarati tali.
- Giroconti tra due conti personali: il modello dati li permette, la UI no (non serve ora).

### Anti obiettivi
- **Nessuna fuga di dati personali.** Conti, transazioni, obiettivi, categorie e P.IVA
  personali non sono mai leggibili dall'altro, nemmeno come totali o come identificatori
  utili. Le prove automatiche della sezione 11 esistono per questo.
  Chiarimento: i redditi inseriti nella quota sono condivisi per decisione di Fabio
  (sezione 4). Il campo `reddito_irregolare` si limita a etichettare quella cifra come
  "reddito prudente"; i dati del modulo P.IVA personale (fatturato, imposte, fatture) restano
  illeggibili all'altro e quel campo non li espone.
- **Niente gergo.** Nella parte Casa non compaiono "bloccato", "dilazionato", "sinking fund",
  "giroconto", "imputazione". Ogni parola non quotidiana ("cuscinetto", "quota", "versamento")
  ha una definizione di una riga raggiungibile con un tocco.
- **Niente messaggi che fanno sentire in colpa.** Mai "hai speso troppo", "sei in ritardo",
  "X ti deve" (unica eccezione: l'elenco dei debiti fra membri della 7.5b, con frase neutra e fattuale, senza scadenze né rosso). Si dice cosa succede e cosa si può fare ("a Fabio spettano 45 euro").
- **Niente gamification**: nessun punteggio, streak, badge, classifica, confronto "chi
  contribuisce di più" presentato come merito o colpa.
- **Niente lezioni obbligatorie** e niente regole presentate come verità (il 50/30/20 si può
  mostrare come ordine di grandezza, mai come "devi").
- **Niente rumore**: al massimo due promemoria visibili alla volta, sempre rimandabili.
- **Nessuna modifica ai dati esistenti**: tutte le righe di oggi restano personali.

## 3. Vincoli

- Solo piano gratuito: Supabase (Postgres e Auth) e Vercel Hobby. Costo 0 euro al mese.
- Una sola migrazione SQL, eseguita a mano nel pannello Supabase: un file idempotente,
  senza perdita di dati.
- EUR, formattazione `it-IT` (`formatEuro`, `formatDateIt`), testi tutti in italiano.
- UI ottimistica come oggi: lo stato locale si aggiorna subito, la scrittura va in background,
  l'errore si mostra con il messaggio esistente di salvataggio fallito.
- Nessun offline, nessuna integrazione bancaria: i saldi sono manuali e si aggiornano con le
  transazioni.
- Next.js 16 con API diverse da quelle note (`AGENTS.md`): sessione controllata in
  `src/proxy.ts` (le rotte `/casa/*` sono già coperte dal matcher), errori in `error.tsx` con
  `retry`, pagine client che inoltrano gli errori con `useThrowToBoundary`. Prima di toccare
  API di Next leggere la guida pertinente in `node_modules/next/dist/docs/`.
- Account già esistenti per entrambi, nessun signup: l'ingresso nella casa avviene con un
  codice di invito (sezione 8.2).
- Ogni funzione consegnata si committa e si pusha (regola della roadmap), quindi i passi della
  sezione 12 sono piccoli e ciascuno lascia l'app funzionante.

## 4. Decisioni già prese da Fabio

1. **Modello**: una "casa" condivisa con un conto comune alimentato da un versamento mensile
   fisso di ciascun membro. Le finanze personali restano personali.
2. **Visibilità**: ognuno vede solo la casa dell'altro (versamenti, conti, spese e obiettivi
   della casa). Conti, transazioni, obiettivi, categorie e P.IVA personali restano privati.
3. **Disponibile libero personale**: il versamento mensile è riservato (sottratto) dall'inizio
   del mese, come una riserva immediata, finché il bonifico non viene registrato; a quel punto
   la riserva si chiude senza doppio conteggio.
4. **Spesa di casa pagata con carta personale**: si registra come spesa di casa e chi ha pagato
   matura un credito verso la casa. Il rimborso avviene con un trasferimento dal conto comune
   al conto personale di chi ha anticipato; l'app ricorda i crediti aperti.
5. **Architettura A**: colonna `household_id` nullable sulle tabelle `accounts`, `categories`,
   `budget_goals`, `transactions`. Nullo = personale (come oggi), valorizzato = della casa.
   Nuove tabelle per case, membri e inviti. RLS: personale come oggi, casa leggibile e
   scrivibile dai membri. Ogni lettura personale esistente filtra esplicitamente
   `household_id is null`.
6. **Trasferimento tra conti** come concetto nuovo: né spesa né entrata, aggiorna entrambi i
   saldi, non gonfia le statistiche dello storico.
7. **Direzione UX approvata**: setup "Calcola la nostra quota", "Come si calcola?" su ogni
   numero, check-in mensile, bollette annuali in un tocco, checklist costi di ingresso, check
   del saldo del conto comune, "Stima contro reale", promemoria in app, invito con codice,
   sezione Casa nella navigazione e scelta Personale o Casa nell'aggiunta di una transazione.
8. **Vincoli**: piano gratuito, EUR, it-IT, testi italiani, UI ottimistica, niente offline,
   niente banca, consegna in piccoli passi pushati.
9. **Redditi nella quota**: i redditi inseriti nel piano sono visibili a entrambi i membri.
10. **Notifiche push**: non ora, lavoro futuro (sezione 9).
11. **Calendario**: feed ICS privato in sola lettura per ciascun membro, token segreto
    rigenerabile e revocabile dalle impostazioni della casa; nessuna integrazione Google
    (sezione 9).
12. **Ingresso asincrono**: i due possono entrare in casa in momenti diversi. Per ogni periodo
    la coppia sceglie nel wizard come dividere: 100% a chi abita già, la regola normale o
    percentuali a scelta. Quando l'altra persona entra, il piano passa alla regola normale dal
    mese successivo. Chi non è ancora in casa o ha il 0% in un periodo non ha riserva e non
    blocca il piano dell'altro.
13. **Quote coperte e arretrati**: se un membro versa anche la quota dell'altro, la casa la vede
    come versata e fra i due nasce un debito, riservato nel disponibile del debitore e solo
    informativo per il creditore, restituibile in qualsiasi momento anche a rate. Una quota che
    nessuno copre resta un arretrato visibile a entrambi, mai cancellato.
14. **Nessun limite di due membri**: una casa può avere N membri (per esempio coinquilini a
    lungo termine). Resta una sola casa attiva per persona. Quote, divisioni, debiti, crediti,
    inviti e uscita sono definiti per N.

## 5. Approcci

### A. Colonna `household_id` sulle tabelle esistenti (scelto)
Una casa è un contenitore; conti, categorie, obiettivi e transazioni della casa sono le stesse
tabelle di sempre con `household_id` valorizzato. Il motore degli obiettivi
(`computeAccantonatoFinora`, `computeQuotaMensile`), l'aggiornamento dei saldi e i componenti
di lista si riusano così come sono. Lo scotto è che ogni lettura personale deve filtrare
`household_id is null`: si chiude con un parametro di scope nel data layer (sezione 6.7) e un
test statico che fallisce se una query dimentica il filtro (sezione 11).

### B. Tabelle separate per la casa (scartato)
`house_accounts`, `house_transactions`, `house_goals`, `house_categories`. Isolamento
strutturale molto netto, ma duplica obiettivi (con il loro motore e le sue regole di finestra),
storico, categorie e componenti, e ogni futura evoluzione andrebbe fatta due volte. Il costo
reale è l'obiettivo ricorrente che qui serve per le bollette: duplicarlo significa mantenere
due motori di accantonamento.

### C. Refactor a "spazi" (scartato)
Ogni dato appartiene a uno spazio, anche il personale, e le RLS dipendono solo
dall'appartenenza. È il modello più pulito sul lungo periodo, ma riscrive tutte le policy,
migra a mano tutti i dati esistenti e tocca ogni query, sotto la pressione dell'affitto in
arrivo e con una migrazione eseguita senza rete di sicurezza. Il guadagno rispetto ad A (nessun
`is null` da ricordare) lo si ottiene comunque con il parametro di scope e il test statico.

## 6. Modello dati

Tutti i tipi sono Postgres. Le chiavi esterne verso `auth.users` hanno `on delete cascade` come
nelle tabelle esistenti. Le colonne `user_id` delle tabelle condivise indicano **l'autore**
della riga, non più "l'unico proprietario".

### 6.1 Colonne aggiunte a tabelle esistenti

| Tabella | Colonna | Tipo | Note |
|---|---|---|---|
| accounts, categories, budget_goals, transactions | `household_id` | uuid null, fk `households(id)` on delete restrict | Null = personale. Indice parziale su `(household_id) where household_id is not null`. |
| transactions | `pagata_da_user_id` | uuid null, fk `auth.users` | Valorizzato solo su spese di casa pagate con un conto personale dell'autore: genera il credito. |
| transactions | `origine` | text null, check in (`'riconciliazione'`) | Marca le "spese non registrate" create dal controllo del saldo. |
| budget_goals | `accantona_da` | date null | **[Scelta del redattore]** Se valorizzato, l'accantonamento teorico conta i mesi da `max(inizio finestra, accantona_da)`. Serve a far partire "da ora" una bolletta annuale creata a metà ciclo (sezione 7.7). Null = comportamento di oggi. |

Nessuna colonna viene rimossa o modificata, nessun dato esistente cambia.

### 6.2 Nuove tabelle

**`households`**: `id`, `nome` (default `'La nostra casa'`), `created_by` (default `auth.uid()`),
`created_at`, `archiviata_il` timestamptz null (valorizzato = casa chiusa: di sola lettura e
nascosta dalla navigazione; una casa non si cancella mai, vedi `close_household`).

**`household_members`**: `household_id` (fk, cascade), `user_id` (fk), `display_name` text not
null (serve perché `auth.users` non è leggibile dal client), `joined_at`, `slot` smallint
(da 1 in su, `unique (household_id, slot)`: la posizione della persona nella casa, a cui si
agganciano le quote del piano) e `attivo` boolean default true. Chiave primaria
`(household_id, user_id)`, in più un indice unico parziale su `(user_id) where attivo`:
**[Scelta del redattore]** una persona appartiene al massimo a una casa attiva. Chiudere una
casa mette `attivo = false` sul membro rimasto (la riga resta, così la casa archiviata si può
ancora leggere) e libera la persona per crearne o unirsene un'altra. **Nessun limite al numero di
membri** (decisione di Fabio): resta soltanto una casa attiva per persona.

**`household_invites`**: `id`, `household_id`, `codice` text unique (8 caratteri da un
alfabeto senza simboli ambigui, niente 0/O/1/I/L), `created_by`, `created_at`, `scade_il`
(default `now() + interval '7 days'`, rete di sicurezza rinnovabile rigenerando), `revocato_il`
null. **Riutilizzabile**: più persone possono entrare con lo stesso codice, finché non è
revocato, rigenerato o scaduto.

**`household_plans`**: il piano della quota, **versionato** (così lo storico di "quanto era
atteso nel mese M" non cambia quando si rivede la quota). Colonne: `id`, `household_id`,
`valido_dal` date (sempre primo del mese, check; al salvataggio mai prima del mese corrente,
vedi sotto), `giorno_versamento` smallint (1 a 28),
`regola` text check in (`'parti_uguali'`, `'proporzionale'`, `'pari_residuo'`, `'personalizzata'`),
`cuscinetto_obiettivo` numeric, `cuscinetto_quota_mensile` numeric, `arrotondamento` numeric
(default 10), `totale_mensile` numeric, `created_by`, `created_at`.
`unique (household_id, valido_dal)`: rivedere il piano nello stesso mese lo sostituisce.
Il piano valido per il mese M è quello con `valido_dal` massimo `<= M`.
**[Scelta del redattore]** `valido_dal` può essere solo il mese corrente o uno successivo: lo
verifica `save_household_plan`, non un `check`, perché "corrente" cambia nel tempo. Così non
nascono arretrati all'indietro. Stato derivato, senza colonna: il piano è **bozza** finché una
posizione con quota maggiore di zero non è legata a un membro (`user_id` valorizzato e `esce_dal` nullo), **attivo** quando lo sono
tutte. Una posizione con quota 0%, o di chi non è ancora in casa in quel periodo, non blocca
l'attivazione del piano dell'altro.

**`household_plan_items`**: le voci di spesa del piano. `id`, `plan_id` (cascade), `nome`,
`categoria_id` (categoria di casa collegata), `frequenza_mesi` smallint >= 1 (1 = arriva ogni
mese, 2 = bimestrale, 12 = annuale), `importo_ricorrenza` numeric (quanto costa ogni volta che
arriva), `importo_mensile` numeric **generated always as `importo_ricorrenza / frequenza_mesi`
stored**, `origine_stima` text check in (`'suggerita'`, `'utente'`, `'reale'`), `goal_id` null
(fk `budget_goals`, on delete set null: l'obiettivo "da parte" creato per le voci con
frequenza maggiore di 1), `stima_ignorata_con_n` smallint null (per non riproporre la stima
reale a ogni apertura), `ordine`.

**`household_plan_shares`**: la quota di ciascuna posizione. `plan_id`, `slot` (da 1 a N),
`user_id` null (null finché la posizione è un segnaposto), `display_name` (nome del
segnaposto, sostituito dal nome del membro dopo l'ingresso), `reddito_netto_mensile` numeric,
`reddito_irregolare` boolean (solo per cambiare il testo dell'etichetta in "reddito prudente";
il pezzo 2 lo userà), `percentuale` numeric null (solo con la regola `personalizzata`: le
percentuali di tutte le posizioni sommano a 100 e ciascuna può essere 0, per esempio 100 e 0 per "tutto a chi abita già"),
`in_casa_dal` date null (primo mese in cui quella persona abita in casa; per un membro già
legato il wizard lo propone da `joined_at`, per il segnaposto è il trasloco previsto; null =
già in casa), `esce_dal` date null (primo mese senza quella persona: lo valorizza
`leave_household` sulle righe delle versioni valide da quel mese in poi; le versioni più
vecchie conservano `user_id` per lo storico), `quota_mensile` numeric. Chiave primaria
`(plan_id, slot)`.
**[Scelta del redattore]** Il piano si può costruire prima che gli altri entrino: le posizioni
di chi non è ancora entrato sono segnaposto, ciascuno con un nome e un reddito inseriti da chi
crea il piano. Una posizione è **legata** quando ha `user_id` valorizzato e `esce_dal` nullo.
**[Scelta del redattore]** Chi esce non lascia una quota attesa: da `esce_dal` (il mese dopo
l'uscita) la sua quota attesa e la sua riserva sono 0, la posizione è sciolta ed esclusa dalla
regola di attivazione, quindi il piano resta attivo per chi resta. Gli arretrati fino
all'uscita sono un registro aperto, perciò l'uscita è bloccata finché non sono versati o
coperti (7.3). Ai membri rimasti compare il promemoria "Rivedi la quota" che apre il wizard per
creare una nuova versione dal mese successivo.
**[Scelta del redattore]** Un nuovo membro **non riusa mai** la posizione di un ex membro in una
versione esistente: `join_household` lo lega solo a un segnaposto con `user_id` null e, se non
ce n'è, gli assegna una posizione nuova (mai usata prima nella casa), che il wizard aggiunge
nella nuova versione del piano. Le versioni vecchie conservano il `user_id` di chi è uscito.
Quando la persona entra, `join_household` la lega al segnaposto (valorizza `user_id` in
tutte le righe di quella posizione) e da lì può correggere il proprio reddito; chi crea un
nuovo piano non può cambiare il reddito di una posizione già legata a un altro membro
(controllo in `save_household_plan`).
Decisione di Fabio: i redditi inseriti qui li vede anche l'altro (con la regola proporzionale
sono comunque deducibili dalle quote).

**`transfers`** (il concetto nuovo, decisione 6): `id`, `household_id` null (null = fra due
conti personali, non esposto in UI), `user_id` (autore, cioè chi registra), `da_account_id` e
`a_account_id` (fk `accounts`, on delete restrict, check `da <> a` quando sono entrambi
presenti; possono mancare solo in una rinuncia a un credito o a un debito), `importo` numeric check > 0,
`data` date, `causale` text check in (`'versamento'`, `'rimborso'`, `'restituzione'`, `'altro'`),
`beneficiario_user_id` uuid null (per `rimborso`: chi riceve il rimborso, cioè chi aveva
anticipato, mentre l'autore è un altro membro, che rimborsa; per `restituzione` e per un
versamento "di restituzione": il creditore del debito fra membri, mentre l'autore è il
debitore), `per_conto_di_user_id` uuid null (solo per `versamento`: un altro membro della casa, il debitore, la cui quota
del `mese_competenza` viene versata dall'autore; incompatibile con `beneficiario_user_id`), `mese_competenza` date null (primo del
mese a cui si riferisce, solo per `versamento`), `solo_registrazione` boolean default false
(vero = il bonifico è già stato riflesso a mano nei saldi: non si toccano), `nota`,
`created_at`.
Non è una `transactions` e per costruzione non entra in nessuna statistica dello storico.

**`balance_checks`**: `id`, `household_id`, `account_id`, `user_id`, `data`,
`saldo_registrato` (cosa risultava nell'app), `saldo_dichiarato` (cosa c'è davvero),
`differenza`, `transaction_id` null (fk, la riga "spese non registrate" eventualmente
creata), `created_at`.

**`household_checkins`**: il check-in mensile. `id`, `household_id`, `mese` date (primo del
mese controllato), `user_id`, `created_at`, snapshot numerici (`atteso_totale`,
`versato_totale`, `previsto_mensili`, `speso_mensili`, `non_registrate`, `avanzo`), `esito`
text check in (`'in_pari'`, `'avanzo'`, `'ammanco'`), `destinazione_avanzo` text null check in
(`'cuscinetto'`, `'da_parte'`), `goal_id` null. `unique (household_id, mese)`.

**`calendar_feeds`**: il feed ICS privato (sezione 9). `id`, `household_id`, `user_id`,
`token` text unique (casuale, almeno 32 byte in esadecimale o base64url), `created_at`,
`revocato_il` null. Al massimo un feed non revocato per membro. Il token è conservato in chiaro
perché le impostazioni devono poterlo rimostrare; la riga la legge solo il proprietario.

### 6.3 Funzioni SQL

Tutte con `set search_path = public`, `revoke execute ... from public`, `grant execute ...
to authenticated` (unica eccezione `get_calendar_feed`, che va anche ad `anon`). Le funzioni
`security definer` scavalcano le RLS, quindi **iniziano con una verifica esplicita** su
`auth.uid()` (chiamante membro attivo della casa e casa non archiviata, tranne dove la tabella
dice altro) e non si fidano mai di un id passato come parametro. Le funzioni `security invoker`
non hanno bisogno di controlli propri: decidono le policy della 6.4.

| Funzione | Tipo | Cosa fa |
|---|---|---|
| `is_household_member(h uuid)` | `security definer`, `stable` | `exists` su `household_members` con `user_id = (select auth.uid())`. Usata dalle policy; essendo definer evita la ricorsione RLS su `household_members`. |
| `is_household_writer(h uuid)` | `security definer`, `stable` | Come sopra, ma vera solo se la casa non è archiviata. Usata dalle policy di scrittura: una casa chiusa è di sola lettura. |
| `create_household(nome, display_name)` | definer | Crea la casa e la riga di membro in un colpo solo (il creatore non è ancora membro, quindi una insert diretta sarebbe bloccata dalla RLS). Ritorna l'id. Fallisce se l'utente ha già una casa attiva. Il creatore occupa la posizione 1. |
| `create_invite(household)` | definer | Verifica che il chiamante sia membro attivo di una casa non archiviata; genera il codice; ritorna il codice. Un nuovo invito (rigenerazione) revoca i precedenti; esiste anche la revoca senza sostituzione. |
| `join_household(codice, display_name)` | definer | Verifica: codice esistente, non scaduto, non revocato; chiamante senza casa attiva; casa non archiviata. Assegna una posizione libera (un segnaposto del piano se ce n'è uno, altrimenti la prima libera), la lega alle quote dei piani esistenti solo se è un segnaposto (`household_plan_shares.user_id` nullo); non riusa mai la posizione di un ex membro, ne crea una nuova, inserisce il membro, marca l'invito. Errori con messaggi generici (nessuna differenza osservabile fra "non esiste" e "scaduto"). |
| `leave_household()` | definer | Esce dalla casa del chiamante (cancella la riga di membro e valorizza `esce_dal`, il mese successivo, sulle sue quote dei piani; la posizione non si riassegna). Qualsiasi membro può uscire, purché non abbia registri aperti. **Rifiuta** se il chiamante ha crediti verso la casa (7.5) o debiti fra membri aperti, come debitore o creditore (7.5b), e **rifiuta** se ha arretrati di versamento non versati né coperti, e **rifiuta** se è l'ultimo membro attivo: in quel caso serve `close_household`. Non cancella nulla: le righe scritte dal membro restano alla casa. |
| `close_household()` | definer | Solo per l'ultimo membro attivo, e solo senza crediti o debiti aperti. Valorizza `households.archiviata_il` e mette `attivo = false` sul membro. Non cancella niente, quindi `on delete restrict` e `household_id` immutabile restano validi. Revoca anche i feed calendario della casa. |
| `record_transfer(...)` | definer, con controlli espliciti su `auth.uid()` | Valida la coerenza (versamento: da conto personale dell'autore a conto di casa; rimborso: registrato da un membro diverso dal beneficiario, da conto di casa a un conto personale del beneficiario, che il chiamante non può leggere e che la funzione sceglie lei fra quelli usati nelle spese anticipate; rinuncia a un credito o a un debito: registrata dal creditore, `solo_registrazione`, senza conti; versamento per conto di: da conto personale dell'autore a conto di casa, con `per_conto_di_user_id` uguale a un altro membro attivo della stessa casa; restituzione: registrata dal debitore, da un suo conto personale a un conto personale del creditore scelto dalla funzione come per i rimborsi, oppure `solo_registrazione`; versamento di restituzione: versamento con `beneficiario_user_id` uguale al creditore; importo > 0; casa non archiviata), inserisce in `transfers` e, se non `solo_registrazione`, aggiorna i due saldi **nella stessa transazione**. È definer proprio perché deve scrivere sul conto personale di un'altra persona. |
| `delete_transfer(id)` | definer | Solo l'autore; ripristina i saldi (se non `solo_registrazione`) e cancella. Una modifica è cancella e ricrea. |
| `adjust_account_balance(account, delta)` | `security invoker` | `saldo_attuale = saldo_attuale + delta` in una sola istruzione. Per i conti di casa evita che due membri che scrivono insieme si sovrascrivano (oggi il saldo si calcola nel client e si scrive assoluto). Resta invoker: funziona anche per il membro che non ha creato il conto, perché la policy di `update` sui conti di casa è per ogni membro (6.4), e per un conto personale vale solo per il proprietario. Se l'`update` non tocca nessuna riga (conto inesistente o RLS) lancia un errore invece di fallire in silenzio. |
| `record_balance_check(account, saldo_dichiarato, data)` | invoker | Crea, in atomico, la riga `balance_checks`, l'eventuale transazione "Spese non registrate" (categoria di casa creata se manca) e imposta il saldo al dichiarato. |
| `save_household_plan(household, payload jsonb)` | invoker | Crea o sostituisce il piano di un mese con voci e quote, e crea le categorie di casa mancanti, in atomico. La forma del JSON è lasciata al builder. Rifiuta un `valido_dal` precedente al mese corrente e un reddito diverso per una posizione già legata a un altro membro. Accetta più versioni (una per `valido_dal`) in una sola chiamata, per la transizione dell'ingresso asincrono. |
| `rotate_calendar_feed()` | definer | Revoca il feed attivo del chiamante e ne crea uno nuovo con token casuale; ritorna il token. Verifica membro attivo. |
| `revoke_calendar_feed()` | definer | Revoca il feed attivo del chiamante senza crearne uno nuovo. |
| `get_calendar_feed(token text)` | definer, `grant` anche ad `anon` | Unica via di lettura del feed: nessuna sessione, solo il token. Se il token esiste, non è revocato e la casa non è archiviata, ritorna un unico `jsonb` con i soli dati di casa necessari agli eventi (giorno di versamento e quota del membro proprietario del token, scadenze e importi degli obiettivi di casa aperti, credito aperto aggregato, date dell'ultimo controllo e check-in); altrimenti ritorna nulla, senza distinguere i casi. Non legge mai tabelle personali. |

### 6.4 RLS

Le quattro tabelle esistenti perdono la policy `owner_full_access` e ricevono quattro policy
(select, insert, update, delete) basate su due condizioni:

```
L =  (household_id is null     and user_id = (select auth.uid()))
  or (household_id is not null and public.is_household_member(household_id))

S =  (household_id is null     and user_id = (select auth.uid()))
  or (household_id is not null and public.is_household_writer(household_id))
```

- `select`: `L`.
- `insert`: `with check S`; per le righe di casa in più `user_id = (select auth.uid())`.
  Ognuno scrive solo a proprio nome, e solo se è membro di una casa non archiviata.
- `update`: `using S` e `with check S`. **[Scelta del redattore]** Per le righe di casa vale
  per **qualsiasi membro**, non solo per l'autore: una spesa o un obiettivo di casa si corregge
  in due. L'autore (`user_id`) non cambia mai (trigger, 6.5), quindi il `with check` non
  blocca il membro che non ha creato la riga.
- `delete`: `using S`. Stessa apertura a entrambi i membri.
- **Eccezione per le spese con credito.** Su `transactions`, se `pagata_da_user_id is not null`
  (spesa di casa pagata con una carta personale) `update` e `delete` richiedono anche
  `pagata_da_user_id = (select auth.uid())`: solo chi ha pagato la modifica o la elimina.
  Motivo: la spesa ha un riflesso sul saldo personale e sul credito di quella persona, che
  l'altro non può né vedere né aggiornare.
- `accounts` di casa: nessuna policy di `delete` per le righe di casa (oggi non esiste nemmeno
  un `deleteAccount` nel data layer, e un conto di casa referenziato da movimenti non si
  cancella). È l'unica riga di casa che i membri non possono eliminare.
- Per le righe personali la condizione è logicamente identica a quella di oggi.

**Funzioni atomiche e RLS.** `adjust_account_balance`, `record_balance_check` e
`save_household_plan` sono `security invoker`: usano le policy sopra, quindi funzionano per il
membro che non ha creato il conto o la riga e non possono fare più di quanto farebbe una query
diretta. Le funzioni `security definer` (6.3) sono le uniche a scavalcare le RLS e per questo
controllano da sole membro, casa non archiviata e coerenza dei parametri, con `search_path`
fissato.

Nuove tabelle:
- `households`: `select` ai membri (anche a casa archiviata); `update` ai membri writer (il
  nome). Nessuna insert diretta (passa da `create_household`).
- `household_members`: `select` ai membri della stessa casa. Nessuna scrittura diretta
  (passa dalle funzioni).
- `household_invites`: `select` ai membri. Nessuna scrittura diretta.
- `household_plans`, `_items`, `_shares`, `balance_checks`, `household_checkins`: `select` ai
  membri, scritture ai membri writer (`is_household_writer`; per le figlie tramite il piano).
- `calendar_feeds`: `select` solo del proprietario (`user_id = auth.uid()`), nessuna scrittura
  diretta, nessun accesso per `anon` (la lettura del feed passa solo da `get_calendar_feed`).
- `transfers`: `select` con `(household_id is null and user_id = (select auth.uid())) or
  (household_id is not null and is_household_member(household_id))`. Quindi i trasferimenti
  personali (`household_id` nullo) li legge solo l'autore, quelli di casa i membri. Nessuna
  insert, update o delete diretta per nessuno: scrivono solo `record_transfer` e
  `delete_transfer`, che per un trasferimento personale richiedono `user_id = auth.uid()` e
  due conti personali dell'autore.

Chi esce da una casa perde l'accesso nello stesso istante, perché `is_household_member`
diventa falsa. Chi chiude la casa continua a leggerla, in sola lettura.

### 6.5 Trigger

- `forbid_household_change` (before update su le quattro tabelle): `household_id` e `user_id`
  non cambiano mai dopo la creazione, e su `transactions` nemmeno `pagata_da_user_id`.
  Impedisce di "spostare" una riga fra personale e casa, e quindi di esporre per sbaglio dati
  personali, e impedisce che un membro trasformi una spesa di casa nel credito di qualcuno.
- `check_household_refs` (before insert/update su `transactions` e `budget_goals`): la
  categoria, l'obiettivo e il conto referenziati devono avere lo stesso `household_id` della
  riga. **Eccezione unica**: una transazione di casa con `pagata_da_user_id = user_id` può
  riferire un conto personale dell'autore. Il trigger gira da invoker, quindi un riferimento a
  una riga dell'altro (invisibile per RLS) risulta non trovato e viene rifiutato.
- Nessun trigger sul numero di membri: nessun limite. Resta solo l'indice unico parziale su `(user_id) where attivo` (una casa attiva per persona).
- `pagata_da_user_id` richiede `household_id` non nullo e, all'inserimento, uguale a `user_id`.

### 6.6 La migrazione

File: `supabase/migrations/0004_casa_comune.sql`, **uno solo**, eseguito a mano nel SQL editor
di Supabase. Requisiti:

- Dentro `begin; ... commit;`.
- Idempotente: `create table if not exists`, `alter table ... add column if not exists`,
  `create or replace function`, `drop policy if exists` seguito da `create policy`,
  `drop trigger if exists` seguito da `create trigger`, `create index if not exists`.
  Rieseguirla deve essere innocuo.
- Ordine: funzioni helper e tabelle nuove, poi colonne sulle tabelle esistenti, poi sostituzione
  delle policy (nello stesso blocco, per non lasciare mai le tabelle senza policy), poi
  trigger.
- Nessun `update` o `delete` su righe esistenti. Tutte le righe di oggi restano con
  `household_id` nullo.
- Un blocco di **rollback commentato** in fondo (drop delle nuove tabelle, delle colonne e
  ripristino di `owner_full_access`).
- `0001_init.sql` ha ancora `frequenza_anni` e `0002` la converte: la 0004 non deve assumere
  altro che lo stato dopo `0003`.
- Prestazioni delle policy: usare `(select auth.uid())` e chiamare la funzione membro una sola
  volta per riga. Le tabelle dei membri hanno al massimo qualche riga.

Subito dopo l'esecuzione Fabio lancia lo script di prova RLS (sezione 11) e verifica che l'app
attuale funzioni identica.

### 6.7 Tipi TypeScript e data layer

Nuovi tipi in `src/lib/types.ts`, in camelCase come gli esistenti: `Household`,
`HouseholdMember`, `HouseholdInvite`, `HouseholdPlan`, `PlanItem`, `PlanShare`, `Transfer`,
`BalanceCheck`, `Checkin`, `CalendarFeed`. `Transaction` guadagna `pagataDaUserId` e `origine` (opzionali, per
non rompere i test che fanno `toEqual` su oggetti vecchi, oppure si aggiornano quei test, scelta
del builder). `BudgetGoal` guadagna `accantonaDa` opzionale.

**Parametro di scope.** Ogni funzione di lettura di `accounts`, `categories`, `goals`,
`transactions` riceve un secondo parametro:

```
type Scope = { kind: 'personale' } | { kind: 'casa'; householdId: string };
const PERSONALE: Scope = { kind: 'personale' };
getAccounts(supabase, scope = PERSONALE)
```

con `personale` che aggiunge `.is('household_id', null)` e `casa` che aggiunge
`.eq('household_id', id)`. Il default personale rende **sicuri per costruzione tutti i chiamanti
esistenti** (home, conti, obiettivi, storico, P.IVA, categorie, `getLastIncomeDate`,
`getRecentTransactionAmounts`). Le funzioni che lavorano per id (`updateAccountBalance`,
`closeGoal`, `getTransactionAmountsForGoal`) non filtrano per scope e sono protette dalle RLS
e dai trigger; nel codice portano un commento marcatore `// household: per id` che il test
statico della sezione 11 riconosce.

**Eccezione esplicita.** `src/lib/data/keepAlive.ts` (`pingDatabase` legge `accounts` con
`select('id').limit(1)` solo per tenere sveglio il progetto Supabase) non è una lettura di
dominio e non restituisce dati a nessuno. Il test statico lo esenta con una voce in una
**allowlist** di nomi di file (`FILE_ESENTI = ['keepAlive.ts']`) con il motivo in un commento,
non con il marcatore: il marcatore resta riservato alle funzioni che lavorano per id.

Le funzioni di creazione ricevono lo scope e scrivono `household_id` di conseguenza.

Nuovi file in `src/lib/data/`: `households.ts`, `householdPlans.ts`, `transfers.ts`,
`balanceChecks.ts`, `checkins.ts`, `calendarFeeds.ts`.

## 7. Calcoli

Tutte funzioni pure in `src/lib/calculations/casa/`, testate con TDD come le esistenti. Gli
importi si trattano in **centesimi interi** dentro le funzioni di divisione, per non perdere un
euro negli arrotondamenti. Il "mese" per tutta la parte Casa si calcola in fuso
`Europe/Rome`, non in UTC (vedi rischi, sezione 13).

### 7.1 Voci tipiche e mensilizzazione (`vociTipiche.ts`, `mensilizza.ts`)

Costante `VOCI_CASA_TIPICHE`, tutte con stima iniziale modificabile e una riga didattica. Le
cifre sono ordini di grandezza dal documento di ricerca, **non** fonti:

| Voce | Frequenza (mesi) | Stima per ricorrenza | Equivale a al mese | Riga didattica |
|---|---|---|---|---|
| Affitto | 1 | da inserire | uguale | "Il canone del contratto." |
| Condominio (spese accessorie) | 1 | 50 | 50 | "Di solito paga l'inquilino una parte; guardate il contratto." |
| Luce | 2 | 110 | 55 | "La bolletta arriva ogni due mesi: mettiamo da parte metà al mese." |
| Gas | 2 | 110 | 55 | idem |
| Acqua | 3 | 60 | 20 | "Spesso arriva a trimestri o a conguaglio." |
| Internet | 1 | 28 | 28 | |
| TARI (rifiuti) | 12 | 300 | 25 | "Il comune la chiede in 2 o 3 rate: qui la dividiamo per 12." |
| Assicurazione casa | 12 | 100 | 8,33 | "Non è obbligatoria, ma copre incendio e danni a terzi." |
| Spesa alimentare | 1 | 300 | 300 | "È la voce che più varia: la rivedrete dopo 3 mesi." |
| Manutenzione e piccole cose | 1 | 30 | 30 | |

`importoMensile = importoRicorrenza / frequenzaMesi`. Voci con frequenza 1 sono **voci del
mese**; voci con frequenza maggiore di 1 sono **voci da mettere da parte** (diventano un
obiettivo di casa, sezione 8.7).

### 7.2 Calcolo della quota (`quota.ts`)

Input: redditi netti mensili `r1`, `r2`; voci; cuscinetto; regola; arrotondamento `s`.

```
sottotot  = somma(importoMensile voci)
cuscQuota = cuscinetto_quota_mensile
T         = ceil((sottotot + cuscQuota) / s) * s       // totale da versare, arrotondato per eccesso
```

Default del cuscinetto **[Scelta del redattore]**: obiettivo = 1 mensilità di `sottotot`
(modificabile a 2), quota mensile = 5% di `sottotot` arrotondato all'euro (con l'esempio della
ricerca: 59 su 1.321). Il tempo per riempirlo si mostra ("pieno tra circa 22 mesi") così non
sembra un'imposizione.

Regole, per ogni membro `i` tra gli N della casa nel periodo (con N = 2 sono i due membri);
`S = r_1 + ... + r_N`:
- `parti_uguali`: `q_i = T / N`.
- `proporzionale`: `q_i = T * r_i / S`.
- `pari_residuo`: `R = (S - T) / N` e `q_i = r_i - R`, così a tutti restano gli stessi soldi. Se
  per qualcuno `q_i` verrebbe negativo (reddito minore di R), la sua quota è 0, lo si toglie dal
  gruppo e si ricalcola R sui restanti (`R' = (S' - T) / N'`, con S' e N' sui soli restanti),
  ripetendo finché nessuno è negativo. Chi è a 0 non versa e non ha riserva.
- `personalizzata`: `q_i = T * p_i / 100` con `p_1 + ... + p_N = 100`, anche 100 e 0 su una
  posizione ("tutto a chi abita già"). Non richiede i redditi.

Arrotondamento: ogni quota si arrotonda per difetto all'euro e gli euro che avanzano vanno al
membro con reddito maggiore (alla percentuale maggiore per la `personalizzata`), in modo che
`somma(q_i) = T` esattamente. Output per ogni regola: `quota_i`, `resta_i = r_i - q_i`,
`peso_i = q_i / r_i`, più avvisi: `quota > reddito` ("con questa regola la quota supera il
reddito di {nome}"), `T > S` ("le spese comuni superano i redditi inseriti"), redditi mancanti
(le regole proporzionale e pari residuo restano disabilitate). Con l'esempio della ricerca
(Fabio 1.800, partner 1.400, T = 1.380): parti uguali = 690 e 690; proporzionale = 776 e 604;
pari residuo = 890 e 490, che sono i numeri su cui scrivere i test. Esempio a tre (redditi
1.800, 1.400 e 600, T = 1.380): parti uguali 460 a testa; proporzionale 653,68, 508,42 e 217,89,
quindi 653, 508 e 217 più i 2 euro che avanzano al primo, cioè 655, 508 e 217; pari residuo con
R = (3.800 - 1.380) / 3 = 806,67 darebbe 993,33, 593,33 e meno 206,67: il terzo va a 0 e si
ricalcola sui due restanti con R' = (3.200 - 1.380) / 2 = 910, cioè 890, 490 e 0.

### 7.3 Versamento atteso e versato (`versamenti.ts`)

```
atteso(u, M)  = quota_mensile di u nel piano valido per M          (0 se non c'è un piano attivo)
versato(u, M) = somma importo dei transfers con causale 'versamento' e mese_competenza = M
                che coprono la quota di u: quelli di autore u senza per_conto_di_user_id
                né beneficiario_user_id, più quelli con per_conto_di_user_id = u
```

`mese_competenza` di default è il mese di `data` (modificabile: "questo versamento è per
ottobre").

Un versamento che copre la quota dell'altro si registra come **"versamento per conto di"**: per
la casa la quota di quel mese dell'altro risulta versata (quindi arretrati e check-in mensile
tornano) e fra i due nasce un debito (7.5b). Un versamento "di restituzione" è un extra e non
conta come quota del mese. Una quota che **nessuno** copre resta un **arretrato**, cioè
`atteso(u, M) - versato(u, M)` per mese: visibile a entrambi in `/casa` e nel check-in, mai
cancellato e mai trasformato in debito. Si chiude solo con un versamento (proprio o per conto di)
o con "solo registrazione".

### 7.4 Riserva del versamento nel disponibile personale (`riservoVersamento.ts`)

```
riserva(u, oggi) = 0 se il piano non è attivo (atteso è 0 per una posizione a 0%); altrimenti somma, per ogni mese M da
                   inizio(u) fino al mese di oggi, di max(0, atteso(u, M) - versato(u, M))

inizio(u)        = max(valido_dal, mese di ingresso di u, in_casa_dal di u, mese in cui
                       il piano è diventato attivo, cioè l'ingresso dell'ultima persona con
                       quota maggiore di zero)
```

La riserva scatta dal primo giorno del mese (decisione 3) e include gli **arretrati**
**[Scelta del redattore]**: un mese passato non versato resta riservato finché non lo si
registra, perché il debito verso la casa esiste davvero e il numero deve restare onesto. Via
d'uscita per chi ha già versato ma non registrato: registrare il bonifico con "solo
registrazione" (il saldo del conto è già stato aggiornato a mano), che chiude la riserva senza
toccare i saldi. Una riserva oltre i 2 mesi mostra un avviso con quella stessa soluzione.
**[Scelta del redattore]** Prima che il piano sia attivo (manca una persona con quota maggiore di zero) la riserva è zero e nel disponibile personale non cambia nulla: il piano si vede come
bozza. Gli arretrati contano solo da `inizio(u)`: `valido_dal` non può stare nel passato e
nessuno parte con mesi arretrati già maturati. Chi non è ancora in casa o ha il 0% in un periodo non ha riserva in quel periodo, e questo non impedisce al piano degli altri di essere attivo: chi ha il 0% non vede mai nulla di riservato.

Nessun doppio conteggio: registrare il versamento diminuisce il saldo del conto personale di
`x` (via `record_transfer`) e nello stesso istante la riserva diminuisce di `x`, quindi il
disponibile libero non cambia. Test dedicato.

### 7.5 Crediti verso la casa (`crediti.ts`)

Registro, non abbinamento spesa per spesa:

```
anticipato(u)  = somma importo delle spese di casa con pagata_da_user_id = u
               + somma dei versamenti "di restituzione" con beneficiario u (soldi che la casa ha
                 incassato a favore di u, vedi 7.5b)
rimborsato(u)  = somma importo dei transfers con causale 'rimborso' e beneficiario u
credito(u)     = max(0, anticipato(u) - rimborsato(u))
```

Una rinuncia (rimborso `solo_registrazione` senza conti, registrato dal creditore stesso)
azzera il credito senza muovere soldi. Un rimborso `solo_registrazione` registrato da chi
rimborsa vuol dire che il conto comune è già aggiornato a mano: il saldo del conto personale di chi
riceve non viene toccato e lo aggiorna lui, aiutato dalla riga neutra "Rimborso dalla casa". `leave_household`
rifiuta l'uscita finché `credito(u) > 0` o finché c'è un debito fra membri aperto (7.5b). Il credito **non** si somma al disponibile
personale **[Scelta del redattore]**: il disponibile racconta quello che c'è sul conto; il
credito appare come riga informativa nel dettaglio ("Dalla casa ti spettano 45 euro") e
rientra nel disponibile solo quando il rimborso viene registrato.

### 7.5b Debiti fra membri (`debitiMembri.ts`)

Registro **distinto** dal credito verso la casa. Si guarda così:

| | Credito verso la casa (7.5) | Debito fra membri (7.5b) |
|---|---|---|
| Chi deve a chi | la casa al membro che ha anticipato | un membro direttamente a un altro, coppia per coppia |
| Nasce da | spesa di casa pagata con la carta personale, versamento di restituzione | "versamento per conto di" |
| Si chiude con | rimborso dal conto comune (lo registra chi rimborsa) | restituzione diretta o versamento di restituzione |
| Tocca il conto comune | sì, il rimborso | no (la casa ha già incassato la quota) |

```
prestato(c, d)   = somma importo dei versamenti con autore c e per_conto_di_user_id = d
restituito(d, c) = somma importo delle restituzioni (autore d, beneficiario c)
                 + somma importo dei versamenti di restituzione (autore d, beneficiario c)
                 + rinunce di c
debito(d, c)     = max(0, prestato(c, d) - restituito(d, c))
```

Le restituzioni possono essere parziali, a rate, in qualsiasi momento; per mostrare "di quale
mese" si applicano al mese più vecchio per primo (solo per la visualizzazione). **Collegamento
fra i due registri:** quando il debitore restituisce versando di più sul conto comune, il debito
diminuisce e a favore del creditore nasce un credito verso la casa (entra in `anticipato`), che
si chiude con il rimborso dal conto comune come ogni altro credito. Il disponibile casa non
cambia per i debiti fra membri.

**Disponibile personale.** Il debitore ha i debiti **riservati** (sottratti, sommati su tutti i
creditori) finché non sono restituiti, come la riserva del versamento; il creditore lo vede solo come riga informativa
("{partner} deve a Fabio 604 euro, quota di novembre"), che **non** aumenta il suo disponibile
(coerente con la scelta 4). Nessun doppio conteggio: restituire `x` riduce il conto personale di
`x` e il debito riservato di `x`, quindi il disponibile del debitore non cambia. Il debito fra
membri è visibile a entrambi in `/casa` con il mese a cui si riferisce. `leave_household` e
`close_household` rifiutano finché c'è un debito aperto, come debitore o creditore. Con N
membri i debiti sono coppie (debitore, creditore): `debito(d, c)` per ogni coppia e
`debitoVersoMembri(d)` è la somma su tutti i creditori c. Il credito verso la casa (7.5) è
anch'esso per membro, e il disponibile casa somma i crediti di tutti.

### 7.6 Disponibile libero personale (modifica a `disponibile.ts`)

```
disponibileLibero =
    somma(saldi dei conti personali con contaInDisponibile)
  - somma(accantonato degli obiettivi personali aperti)
  - riserva(u, oggi)                      // NUOVO, 0 se non si è in una casa
  - debitoVersoMembri(u)                  // NUOVO, 7.5b, 0 se non si è in una casa
```

Cambio compatibile: `computeDisponibileLibero(accounts, goals, today, riservaVersamento = 0, riservaDebiti = 0)`.
Tutti gli input arrivano da letture con scope personale: nessun conto, obiettivo o transazione
di casa può entrare. Nel dettaglio della home compare la riga "Versamento alla casa, novembre"
con importo negativo, la riga "Da restituire a Fabio" (solo per il debitore, importo negativo) e sotto le righe informative del credito verso la casa e, per il creditore, del debito dell'altro.

### 7.7 Disponibile casa (`disponibileCasa.ts`)

Cascata esplicita, ogni passo visibile in "Come si calcola?":

```
A = somma saldi dei conti di casa con contaInDisponibile
B = somma accantonato degli obiettivi di casa aperti          (stesso motore dei personali)
C = somma dei crediti aperti di tutti i membri
D = somma, sulle voci del mese (frequenza 1) del piano, di max(0, importoMensile - speso nel mese corrente in quella categoria)
E = A - B - C - D                                              "quello che resta, cuscinetto compreso"
cuscinetto = clamp(E, 0, cuscinetto_obiettivo)
disponibileCasa = E - cuscinetto
```

(in modo equivalente: `max(E - obiettivo, 0) + min(E, 0)`: se E è negativo il numero è
negativo e il testo spiega che si sta attingendo oltre il cuscinetto.) Le voci con frequenza
maggiore di 1 non entrano in D perché sono già coperte da B: sono obiettivi da parte.

`accantona_da` **[Scelta del redattore]**: il motore attuale, per un obiettivo ricorrente
creato a metà ciclo, considera già maturati i mesi trascorsi nella finestra
(`computeFinestraGoal`). Per una bolletta di casa significherebbe riservare soldi che il conto
comune non ha mai ricevuto. Con `accantona_da = data di creazione` i mesi si contano da lì: la
frase "25 euro al mese da ora" è vera e la prima scadenza risulta coperta solo in parte. L'app
lo dice in chiaro ("per la prima scadenza avrete messo da parte 100 di 300 euro, il resto
verrà dal cuscinetto") e le scadenze successive sono complete. Modifica minima a
`computeAccantonatoTeorico`: `elapsed` calcolato da `max(windowStart, accantonaDa)`; se
`accantonaDa` è nullo non cambia niente (i test esistenti restano verdi).

### 7.8 Check-in mensile (`checkin.ts`)

Per il mese chiuso `M`:

```
atteso   = somma atteso(u, M) sui membri
versato  = somma versato(u, M)
previsto = somma importoMensile delle voci con frequenza 1 nel piano di M
speso    = spese di casa nel mese M, escluse quelle collegate a un obiettivo da parte
           (frequenza > 1) e quelle con origine 'riconciliazione'
nonReg   = somma delle spese con origine 'riconciliazione' nel mese M
avanzo   = (versato - atteso) + (previsto - speso - nonReg)
esito    = 'in_pari' se |avanzo| < 1; 'avanzo' se > 0; 'ammanco' se < 0
```

Se `esito = 'ammanco'` e anche il check-in del mese precedente era `'ammanco'`, si propone di
rivedere la quota ("È il secondo mese: probabilmente la quota è un po' bassa, non è colpa di
nessuno"), aprendo il piano con le stime reali già suggerite (7.9). L'avanzo si destina al
cuscinetto (non si muove niente: il cuscinetto è derivato, vedi 7.7) oppure a un fondo comune,
**[Scelta del redattore]** aumentando di quell'importo l'`importo_target` di un obiettivo di
casa "da spendere una volta" (il motore riserva per intero il target, quindi l'avanzo esce dal
disponibile casa). Non si introduce una tabella di versamenti sugli obiettivi: sarebbe la
"conferma versamento" del backlog, fuori scope.

### 7.9 Stima contro reale (`stimaVsReale.ts`)

Per ogni voce con categoria collegata, prendere le ultime spese di casa in quella categoria
(dopo l'inizio del piano). Se sono almeno 3:

```
mediaReale     = media(importi)
nuovoMensile   = mediaReale / frequenza_mesi
differenza     = nuovoMensile - importoMensile
```

Si propone di aggiornare la voce solo se `|differenza| >= max(2 euro, 5% dell'importo)`. Si
mostra l'effetto sulla quota di ciascuno (ricalcolo con 7.2). Rifiutare memorizza
`stima_ignorata_con_n`; si ripropone quando le spese disponibili sono `n + 3`. Accettare crea un
nuovo piano dal mese successivo con `origine_stima = 'reale'`.

### 7.10 Spiegazioni (`spiegazioni.ts`)

Ogni numero della casa è prodotto da una funzione che restituisce **valore e spiegazione
insieme**:

```
interface Spiegazione { valore: number; formula: string; ingredienti: { etichetta: string; valore: number }[] }
```

La UI mostra il valore da `valore` e il pannello "Come si calcola?" dalla stessa struttura, così
spiegazione e numero non possono divergere. Numeri coperti: disponibile casa, quota mensile di
ciascuno, atteso contro versato, cuscinetto, "da parte" di ogni bolletta, credito, riserva del
versamento nel disponibile personale, avanzo o ammanco, importo di ogni costo d'ingresso.

## 8. Flussi UX

Rotte nuove (tutte coperte da `proxy.ts`): `/casa`, `/casa/inizia`, `/casa/quota`,
`/casa/movimenti`, `/casa/da-parte`, `/casa/controllo`, `/casa/impostazioni`. Le pagine che
leggono molto sono Server Component come la home (letture in parallelo, `router.refresh()`
dopo le scritture ottimistiche); le altre seguono il modello client delle pagine obiettivi e
conti con `useThrowToBoundary`.

### 8.1 Navigazione e ingresso

La barra ha già sei voci. **[Scelta del redattore]** Si aggiunge "Casa" (icona `Home` o
`House`) e si toglie "Categorie", raggiungibile da un link in fondo alla pagina Conti e
dall'aggiunta di transazione. La barra resta a sei. Il blocco 2 della roadmap rivedrà comunque
la navigazione. Su "Casa" compare un puntino quando c'è un promemoria.

Senza casa, `/casa` mostra due strade:

```
+--------------------------------------+
|  Casa                                |
|  Qui mettete insieme le spese di     |
|  casa. Il resto resta solo vostro.   |
|                                      |
|  [ Creo la casa ]                    |
|  [ Ho un codice di invito ]          |
+--------------------------------------+
```

Sotto una riga: "Cosa vede l'altro? Solo conti, spese e obiettivi della casa. Le tue cose
personali no, mai."

### 8.2 Invito, ingresso e uscita

Creare: nome casa (opzionale) e "Come ti chiami per l'altro?" (`display_name`, prefilled dalla
parte locale dell'email). Dopo la creazione:

```
  Codice di invito:   K7M2-QX9P        (vale finché non lo revochi o ne generi un altro,
                                     al massimo 7 giorni; lo possono usare più persone)
  [ Copia il codice ]  [ Condividi ]
  Scrivilo alla persona con cui vivi: dovrà aprire Casa e scegliere "Ho un codice".
```

Il codice si mostra con un trattino per leggibilità ma si accetta senza. Chi entra: campo codice,
nome visualizzato, "Entra". Errore unico generico: "Codice non valido o scaduto. Chiedine
uno nuovo." Rigenerare il codice invalida quello vecchio; si può anche solo revocarlo. Dopo l'ingresso
l'invitante vede subito il membro nuovo (`router.refresh()` alla riapertura; non serve
realtime).

Uscire (`/casa/impostazioni`, in fondo, in grigio): "Esci dalla casa". Se `credito > 0`: "Prima
di uscire serve chiudere i 45 euro che hai anticipato: fatti rimborsare dal conto comune o
scegli di rinunciarvi." Stessa regola per un debito fra membri: "Prima di uscire serve chiudere la quota di novembre versata da Fabio per te (o da te per {partner}): restituitela, anche a rate, oppure rinunciate." **[Scelta del redattore]** L'ultimo membro rimasto non può "uscire":
al suo posto compare "Chiudi la casa". La casa viene archiviata (sola lettura, nascosta dalla
navigazione, nessun dato cancellato), con la stessa regola dei crediti aperti, e la persona può
poi crearne o unirsi a un'altra. Conferma con testo chiaro: "Non vedrai più i dati della casa. I soldi
sul conto comune non si muovono da soli: mettetevi d'accordo prima su come dividerli." **[Scelta
del redattore]** Qualsiasi membro può uscire se non ha registri aperti; si esce solo da sé,
rimuovere un altro non è previsto (un potere che membri alla pari non dovrebbero avere via
app). Chi resta continua e vede il suggerimento "Ora siete in {n}: rivedi la quota".

### 8.3 Calcola la nostra quota (`/casa/quota`)

Cinque schermate, una domanda per schermata, risultato in fondo. Si può uscire e riprendere
(bozza nello stato locale, nessuna scrittura finché non si conferma). Rivedibile in seguito con
lo stesso percorso, che parte dal piano attuale.

```
1 di 5    Quanto entra ogni mese
 +---------------------------------------+
 | Fabio                                 |
 |   Reddito netto al mese     [ 1.800 ] |
 | {partner}                             |
 |   Reddito netto al mese     [ 1.400 ] |
 |   [ ] Il mio reddito cambia da mese   |
 |       a mese (partita IVA)            |
 +---------------------------------------+
 Con la spunta: l'etichetta diventa "Reddito prudente" e sotto appare
 "Scrivi una cifra che incassi anche nei mesi magri. La quota si calcola su
  questa, il resto lo gestirete a parte." (il calcolo completo è un progetto
  successivo)
 Nota: "Il reddito che scrivi qui lo vede anche l'altro."
 [ + Aggiungi una persona ] per ogni altro membro. Per chi non è ancora entrato il nome e il
 reddito del suo segnaposto li scrivi tu per ora; quando entra e si lega alla posizione, il reddito lo può correggere lei.
 Per ciascuno: "In casa dal [ mese v ]" (di default il mese corrente; per chi non è ancora
 in casa, il mese previsto del trasloco).
```

```
2 di 5    Le spese di casa
 Affitto                     [ 750 ]   ogni [1] mese
 Condominio                  [  50 ]   ogni [1] mese
 Luce            ogni [2] mesi  [ 110 ]  = 55 al mese
 Gas             ogni [2] mesi  [ 110 ]  = 55 al mese
 TARI            ogni [12] mesi [ 300 ]  = 25 al mese
 ...
 [ + Aggiungi una voce ]        Totale al mese: 1.321 €
 Ogni voce ha "i" con la riga didattica (7.1). Le cifre sono stime: si cambiano.
```

```
3 di 5    Il cuscinetto
 "Il cuscinetto sono soldi della casa per gli imprevisti: una caldaia, una
  bolletta più alta del solito."
 Obiettivo:  (o) 1 mese di spese   ( ) 2 mesi di spese    = 1.321 €
 Ogni mese:  [ 59 ] €             Sarà pieno tra circa 22 mesi.
```

```
4 di 5    Come dividere
 Totale da versare ogni mese: 1.380 €            (Come si calcola?)
 +------------+------------+------------+
 |  Parti     | Secondo il | Stesso     |
 |  uguali    | reddito    | residuo    |
 | Fabio  690 | Fabio  776 | Fabio  890 |
 | {p.}   690 | {p.}   604 | {p.}   490 |
 | Resta:     | Resta:     | Resta:     |
 | F 1.110    | F 1.024    | F 910      |
 | P   710    | P   796    | P 910      |
 | Peso sul   | Peso sul   | Peso sul   |
 | reddito:   | reddito:   | reddito:   |
 | 38% / 49%  | 43% / 43%  | 49% / 35%  |
 +------------+------------+------------+
 Con più di due persone ogni colonna ha una riga per persona. Sotto ogni colonna una frase: "Ognuno versa la stessa cifra." / "Ognuno versa
 la stessa percentuale del proprio reddito." / "A fine mese restano a
 tutti gli stessi soldi personali."
 Selezionata di default: "Secondo il reddito" (scelta del redattore, perché è la
 raccomandazione della ricerca; la scelta resta di chi usa l'app, nessuna colonna
 è presentata come "giusta").

 Se i membri non abitano tutti in casa nello stesso periodo, sopra le colonne compare "Per questo
 periodo":  ( ) Tutto a chi abita già in casa (100%)   ( ) La regola normale   ( ) Percentuali
 a scelta [ 70 ] / [ 30 ].  Il 100% e le percentuali sono la regola `personalizzata`; si mostra
 sempre "cosa resta a ciascuno" come nelle altre colonne.
```

```
5 di 5    Quando e da quando
 Versamento entro il giorno [ 5 ] di ogni mese
 Partite dal mese di  [ dicembre 2026 v ]   (dal mese corrente in poi, mai nel passato)
 Se qualcuno entra in casa più tardi, il wizard propone da solo **due versioni del
 piano**: dal mese di partenza con la scelta "Per questo periodo" (per esempio 100% a chi
 abita già) e, dal mese **successivo** a quello di "In casa dal" di chi entra, con la regola
 normale scelta al passo 4. Si possono modificare entrambe prima di confermare, e aggiungere
 altre versioni (per esempio una percentuale intermedia).
 Riepilogo (una frase): "Fabio versa 776 euro e {partner} 604 euro, entro il 5 di
  ogni mese, da dicembre."
 Se le quote sono uguali: "Ognuno versa 690 euro entro il 5 di ogni mese."
 [ Confermiamo ]
```

Il piano si calcola e si mostra subito anche se qualcuno non è ancora entrato, come
**bozza** ("Diventa attivo quando entra anche {partner}"); il versamento mensile entra nel
disponibile personale solo quando il piano è attivo, cioè quando tutte le posizioni con quota maggiore di zero sono legate a un membro: chi non è ancora in casa, o ha il 0% in quel periodo, non blocca il piano dell'altro, non ha alcuna riserva e vede "Nessun versamento in questo periodo". Alla conferma: `save_household_plan`, poi una schermata "Prossimi passi" con tre carte
facoltative: "Aprite il conto comune qui" (crea il conto di casa con il saldo attuale),
"Mettete da parte le bollette" (8.7), "Costi per entrare in casa" (8.8).

### 8.4 Home della casa (`/casa`)

```
+--------------------------------------+
| Disponibile casa              ( ? )  |   ( ? ) = Come si calcola?
|        312,00 €                      |
| Cuscinetto  59 di 1.321 €            |
+--------------------------------------+
 Promemoria (max 2)
 > Il tuo versamento di 776 € è da fare entro il 5.    [ Registra ]  [ Più tardi ]
 > (a chi rimborsa) A Fabio spettano 45 € per spese anticipate.   [ Rimborsa ]
 > (a Fabio, che ha anticipato) In attesa del rimborso: 45 €.      (nessun pulsante)
 Versamenti di novembre
   Fabio      776 di 776 €     fatto
   {partner}  300 di 604 €     mancano 304 €
 Arretrati e quote coperte
   Ottobre: {partner} 604 €, ancora da versare (nessuno l'ha coperto)
   Settembre: Fabio ha versato 604 € per {partner}. {partner} deve a Fabio 604 € (quota
   di settembre).                              [ Restituisci ]  (solo per chi restituisce)
 Da parte per le bollette
   TARI   100 di 300 €    (25 al mese)
   Luce    55 di 110 €
 Ultime spese di casa
   Spesa Coop       -64,20  (Fabio)
   Affitto         -750,00  (conto comune)
   [ Vedi tutte ]
 [ + ] aggiunge una spesa di casa
```

I nomi accanto alle spese informano ("chi ha pagato"), non giudicano. Nessun confronto fra
membri.

### 8.5 Aggiungere una transazione: Personale o Casa (meno di 10 secondi)

L'attuale sheet "Nuova transazione" (`HomeDashboard`, `AddTransactionForm`) guadagna in cima un
selettore a due posizioni, **Personale | Casa**, visibile solo a chi ha una casa. **[Scelta del
redattore]** L'ultima scelta si ricorda per dispositivo in `localStorage` (con try/catch), ma
dalle pagine `/casa/*` il bottone `+` apre sempre in modalità Casa. In modalità Casa:

```
 [ Personale | *Casa* ]                    (Lo vedrà anche {partner})
 [ Spesa | Entrata ]
            12,50 €
 Descrizione   [ Pane e latte        ]
 Categoria     ( Spesa alimentare )( Luce )( Affitto )( Altro ) ...  (categorie di casa)
 Chi ha pagato ( Conto comune )( Io, con Carta Fabio )     <- sostituisce "Conto"
 Da parte      (se la categoria ha un fondo, scelto già: "Luce")
 [ Salva ]
```

- Default di "Chi ha pagato": conto comune se esiste. Se si sceglie "Io, con…" si elencano i
  conti personali e la spesa nasce con `pagata_da_user_id`. Il saldo del conto personale
  scende (come oggi); la spesa non compare nello storico personale come spesa, ma come riga
  neutra (sezione 8.6). Nasce un credito.
- Per un conto di casa il saldo si aggiorna con `adjust_account_balance` (delta), non con il
  saldo assoluto calcolato nel client.
- L'obiettivo si preseleziona: se esiste un obiettivo di casa aperto con quella `categoria_id`,
  è già scelto, così la bolletta riduce il "da parte" senza un tocco in più.
- La modalità Casa nasconde il selettore Obiettivo quando non serve e non mostra mai
  "bloccato/dilazionato". Il pulsante "Nuovo obiettivo" qui si chiama "Nuova cosa da mettere
  da parte" ed è sempre una spesa singola.
- Entrata di casa: serve poco (rimborsi dal proprietario, interessi sul deposito). Ammessa.

### 8.6 Versamenti, rimborsi e storico

Registrare un versamento (da banner o da `/casa`):

```
 Versamento alla casa
  Da         ( Conto Fabio v )          A  ( Conto comune )
  Importo    [ 776 ]  €     Data [ oggi ]    Per il mese di [ novembre v ]
  [ ] Il bonifico l'ho già riflesso nei saldi a mano
  [ Registra ]
```

Registrare un rimborso: dal banner "A Fabio spettano 45 €" **lo registra uno qualsiasi dei membri diversi dal creditore**
(pulsante "Rimborsa", importo preimpostato al credito, da conto comune al conto personale di
chi aveva anticipato; quest'ultimo non lo può scegliere né vedere, lo risolve `record_transfer`,
che essendo definer può aggiornarne il saldo). Chi aveva anticipato vede solo "In attesa del
rimborso" con l'importo, senza azioni. Dopo la registrazione il credito si azzera. Chi ha
anticipato può anche rinunciare al credito dal dettaglio del credito, non dal banner. Errore su
doppia registrazione: chi ha registrato può annullare un movimento (`delete_transfer`) dalla
lista.

**Versare per conto di un altro membro.** Nel modulo del versamento, per chi ha altre persone in
casa, compare la scelta "Per me / Per conto di" con l'elenco dei membri (il debitore è sempre
esplicito) e "Per il mese di". Un versamento
"per conto di" va dal conto personale dell'autore al conto comune con `per_conto_di_user_id`: la
quota di quel mese del debitore risulta versata e nasce un debito fra membri (7.5b), visibile a
entrambi in `/casa`. Versare la propria quota e quella di un altro (o di due altri) sono movimenti separati, uno per debitore.

**Restituire.** Dal debito aperto, "Restituisci" (solo al debitore) offre due modi, per
qualsiasi importo e quante volte si vuole: "Restituisco direttamente" (causale `restituzione`,
da un conto personale al conto personale del creditore, scelto da `record_transfer` come per i
rimborsi, oppure con la spunta "già riflesso nei saldi") oppure "Verso di più sul conto comune"
(un versamento con `beneficiario_user_id` uguale al creditore, che non conta come quota del
mese). Nel secondo caso il debito diminuisce e a favore del creditore nasce un credito verso la
casa (7.5), che si chiude con "Rimborsa" come ogni altro. Il creditore può rinunciare, in tutto o
in parte. Nello storico personale compaiono righe neutre come "Restituzione a Fabio".

`/casa/movimenti`: elenco unico di spese di casa, entrate di casa e movimenti fra conti
("Versamento di Fabio", "Rimborso a Fabio"), con filtro per mese. I movimenti fra conti hanno
stile neutro e non entrano in nessun totale di spesa.

**Storico personale** (`/history`): resta limitato alle transazioni personali. In più compaiono
righe neutre, escluse dai grafici e dai totali: "Versamento alla casa, novembre" (da
`transfers` dove un conto personale è dell'autore), "Rimborso dalla casa" e "Spesa di casa
pagata da te" (da `transactions` con `pagata_da_user_id = io`). Servono a spiegare perché il
saldo del conto è sceso, senza gonfiare statistiche né mostrare nulla dell'altro.

### 8.7 Bollette e cose da mettere da parte (`/casa/da-parte`)

Due sezioni, senza i termini del motore:

- **Da parte, mese per mese**: voci con frequenza maggiore di 1 (TARI, assicurazione, luce,
  gas, acqua, bollo auto di casa, abbonamenti).
- **Da pagare una volta**: costi di ingresso (accantonati gradualmente fino alla data di
  ingresso), un arredo, una vacanza comune.

Un tocco per voce:

```
 TARI, circa 300 euro l'anno: 25 euro al mese da ora.
 Quando arriva la prossima rata?  [ marzo 2027 v ]
 Per questa prima volta avrete messo da parte 125 di 300 euro; il resto verrà dal
 cuscinetto. Dalla seconda, 300 su 300.
 [ Metti da parte ]
```

Tecnica: crea un `budget_goals` di casa, modalità interna dilazionato, ricorrente,
`frequenza_mesi` della voce, `scadenza` = prossima scadenza, `categoria_id` della voce,
`accantona_da` = oggi, e collega `plan_items.goal_id`. La lista usa `GoalsList` con una prop che
sostituisce l'etichetta Bloccato/Dilazionato con "Da parte" e nasconde il selettore tecnico. Il
suggerimento da storico (`SuggestAmountPanel`) funziona con scope casa. Le voci del piano senza
fondo mostrano un invito discreto in home: "3 bollette non sono ancora messe da parte".

### 8.8 Costi per entrare in casa (`/casa/da-parte`, funzione a tempo)

Checklist con importi indicativi calcolati dal canone e interruttori. Ogni riga ha "cosa dice la
legge" in una riga e l'etichetta "importo indicativo, controllate il contratto":

| Voce | Importo suggerito | Nota |
|---|---|---|
| Deposito cauzionale | canone x mesi (1 a 3, default 2) | "Per legge al massimo 3 mensilità. Ve lo restituiscono a fine contratto, con gli interessi." |
| Imposta di registro, quota inquilino | 2% del canone annuo, diviso 2 | "Di solito si divide a metà con il proprietario. Se sceglie la cedolare secca non si paga." Interruttore "Cedolare secca" azzera registro e bollo. |
| Bollo del contratto | circa 16 euro per copia | "Cambia con la lunghezza del contratto." |
| Agenzia | 0 o circa 1 mensilità + IVA | "Non sempre c'è." |
| Allacci e attivazioni utenze | circa 100 euro per utenza | "Subentro, attivazione, eventuale deposito." |
| Arredo ed elettrodomestici | da inserire | "Qui la variabilità è enorme." |

Si chiede una "Data di ingresso" (la data prevista del trasloco). "Metti da parte tutto" crea
un obiettivo di casa "da pagare una volta" per ogni voce selezionata, in modalità interna
**dilazionato** (il motore graduale) con `scadenza` = data di ingresso, non come riserva
immediata: così il disponibile casa non va in profondo negativo il primo giorno e l'importo si
costruisce mese per mese. **[Scelta del redattore]** Se le spese vengono anticipate con la
carta personale prima che il conto comune abbia i soldi, vale il meccanismo del credito. Non va in nessun modo confusa con consulenza: in
testa "Cifre indicative per orientarvi, non consulenza legale o fiscale".

### 8.9 Controllo del saldo del conto comune

Raggiungibile da `/casa` ("Controlla il conto") e da banner:

```
 Quanto c'è davvero sul conto comune?
  Per l'app c'è:  1.020,00 €
  In banca c'è:   [ 940 ] €
 -----------------------------------------
 Mancano 80 €. Succede: nessuno ricorda ogni spesa.
 [ Segna come spese non registrate ]   vi dà: una spesa da 80 € con questo nome,
                                       visibile a entrambi, e il saldo allineato.
 [ Ho dimenticato di registrare qualcosa ]  -> torna indietro ad aggiungere
```

- Differenza in meno: crea una spesa "Spese non registrate" (categoria di casa dedicata,
  `origine = 'riconciliazione'`) e allinea il saldo. Differenza in più: propone di
  registrare un versamento dimenticato oppure di segnare "entrata non registrata".
- Sotto il euro di differenza: "Torna tutto." e si registra comunque il controllo (ferma il
  promemoria).
- In `/casa` una riga neutra "Spese non registrate questo mese: 80 €" la vedono entrambi, senza
  nomi.
- Frequenza del promemoria **[Scelta del redattore]**: se l'ultimo controllo ha più di 14
  giorni, e comunque all'inizio del check-in mensile.

### 8.10 Check-in mensile (`/casa/controllo`)

Dal giorno 1 di ogni mese fino a quando non viene fatto (o oltre, come promemoria discreto).
Chiunque dei due lo fa; l'altro vede "Fatto da Fabio il 2 dicembre" e può riguardarlo. Passo 0:
il controllo del saldo (8.9), saltabile. Poi una schermata:

```
 Novembre in casa
 Versamenti       Fabio 776 di 776     {partner} 604 di 604
 Spese del mese   previste 1.288 €    registrate 1.241 €    non registrate 80 €
 Cuscinetto       59 di 1.321 €                                   ( ? )
 ----------------------------------------------------
 In avanzo di 47 €. Cosa ne facciamo?
   (o) Lasciamoli al cuscinetto
   ( ) Mettiamoli da parte per [ Vacanza v ]   o   [ + una cosa nuova ]
 [ Fatto, a dicembre ]
```

Caso ammanco: "Sono usciti 62 euro più del previsto. Li prendiamo dal cuscinetto." (nessuna
mossa di soldi: è la conseguenza del conto). Se è il secondo mese: "È il secondo mese: forse la
quota è un po' bassa. [Guarda le stime reali]". Ogni numero ha "Come si calcola?". Il
salvataggio scrive `household_checkins` con lo snapshot.

### 8.11 Stima contro reale

Appare nel check-in mensile e nella pagina quota, mai come interruzione:

```
 Luce: avete previsto 55 € al mese, le ultime 3 bollette fanno in media 71 € al mese.
 Con 71 €:  Fabio 776 -> 788 €    {partner} 604 -> 612 €
 [ Aggiorna la stima ]   [ Non ora ]
```

"Aggiorna" ripercorre il salvataggio del piano dal mese successivo con la voce a
`origine_stima = 'reale'`. Se l'obiettivo "da parte" della voce esiste, la sua quota si
aggiorna con `updateGoal` e il cambio vale dal ciclo seguente.

### 8.12 Promemoria in app

Funzione pura `computeReminders(stato, utente, oggi)` che restituisce al massimo 2 elementi in
questo ordine:

1. **Versamento da fare**: da 3 giorni prima di `giorno_versamento` finché `versato < atteso`
   (solo per chi lo deve); da scaduto, tono neutro ("Il versamento di novembre è ancora da
   registrare. Già fatto? Registralo con la spunta 'già riflesso'").
2. **Crediti aperti**: a chi ha anticipato (il creditore) "In attesa del rimborso: 45 €", con
   l'importo e senza alcun pulsante; agli altri membri (tutti tranne il creditore), che possono rimborsare, "A {partner} spettano
   45 € per spese anticipate" con il pulsante "Rimborsa"; la prima registrazione chiude il
   credito per tutti.
3. **Debiti fra membri aperti**: al debitore "Resta da restituire a Fabio: 604 € (quota di
   novembre). Anche a rate, quando puoi." con il pulsante "Restituisci"; al creditore solo
   l'informazione "{partner} deve ancora 604 € a Fabio", senza pulsanti. Tono neutro, nessuna
   scadenza.
4. **Rivedi la quota**: ai membri rimasti dopo un'uscita, finché non esiste una versione del
   piano valida dal mese successivo; apre il wizard sul piano attuale. Tono neutro.
5. **Check-in mensile**: dal giorno 1 se manca quello del mese scorso.
6. **Controllo del saldo**: se l'ultimo è più vecchio di 14 giorni.

Dove: striscia in cima a `/casa` e una riga compatta in cima alla home personale. "Più tardi"
nasconde per quella giornata (`localStorage`, try/catch); niente tabelle. Nessun conteggio di
ritardi, nessun contatore.

### 8.13 Chi esce o cambia

Coperto in 8.2. Se un utente senza casa apre `/casa/quota` viene rimandato a `/casa/inizia`.

## 9. Notifiche e calendario

### 9.1 Notifiche push: non ora (decisione di Fabio)

Le push sono rimandate come lavoro futuro, da riprendere solo se promemoria in app e calendario
non bastano. Per memoria, cosa servirebbe (verificato in
`node_modules/next/dist/docs/01-app/02-guides/progressive-web-apps.md` che le Web Push
funzionano su iOS 16.4 o successivo per le app installate nella Home): un service worker (oggi
non esiste; c'è solo `manifest.json` con `display: standalone`), chiavi VAPID, la libreria
`web-push`, una tabella `push_subscriptions`, un consenso richiesto con un gesto dentro l'app
installata e un cron che invia. Il cron di Vercel Hobby parte al massimo una volta al giorno
(già usato per `/api/keep-alive` alle 06:00 UTC; precisione oraria da verificare nella
documentazione Vercel) e per decidere chi avvisare deve leggere i dati di tutti, quindi
servirebbe la chiave `service_role` o la logica dei promemoria duplicata in SQL. Stima: circa
6 task medi, circa 2 giorni di agenti più un collaudo a mano su due iPhone (comportamenti che
conosco in generale ma **non ho verificato** qui). Nessun lavoro in questo spec dipende da esse.

### 9.2 Calendario: feed ICS privato in sola lettura

**Cosa.** Ogni membro ha un indirizzo privato che serve un calendario in formato ICS. Lo
aggiunge a Google Calendar con "Aggiungi calendario da URL" oppure su iPhone come calendario in
abbonamento (Impostazioni, Calendario, Account, Aggiungi account, Altro, Aggiungi calendario con
abbonamento). Resta in sola lettura: il calendario non scrive mai sull'app. **Nessuna
integrazione Google**: niente OAuth e niente API Google (l'account Google di Fabio ha un avviso
di sicurezza aperto); il feed è un normale file servito via HTTP che qualunque app calendario sa
leggere.

**Tempi di aggiornamento.** I calendari in abbonamento si aggiornano secondo i tempi del
provider, non dell'app. Google Calendar può impiegare diverse ore (stima, non verificata qui).
La UI lo dice ("Può volerci qualche ora perché il calendario si aggiorni"): il feed è un
promemoria, non uno strumento in tempo reale, e per questo non sostituisce i promemoria in app.

**Eventi** (solo dati di casa, sul periodo dei prossimi 12 mesi, eventi di giornata intera):
- le scadenze del versamento del membro (giorno `giorno_versamento`, con la sua quota);
- il check-in mensile (primo giorno di ogni mese);
- il controllo del saldo del conto comune (a cadenza di 14 giorni dall'ultimo controllo,
  per le prossime occorrenze);
- le bollette e le scadenze degli obiettivi di casa aperti (data di scadenza e importo);
- il promemoria di un credito aperto: "In attesa del rimborso" per chi ha anticipato,
  "Rimborso da fare" per l'altro (data a scelta del builder, di default il prossimo check-in).

**Come funziona.**
- Un route handler (`src/app/api/calendario/[token]/route.ts`, nome a scelta del builder)
  risponde con `Content-Type: text/calendar; charset=utf-8` e `Cache-Control: no-store`. Prima
  di scriverlo si legge la guida dei route handler in `node_modules/next/dist/docs/` (AGENTS.md).
- La rotta **non ha sessione**: come `/api/keep-alive`, va esclusa dal redirect al login in
  `src/proxy.ts`. Non può quindi leggere dalle tabelle con le RLS. Legge solo tramite
  `get_calendar_feed(token)` (6.3), funzione `security definer` che accetta il solo token e
  restituisce i soli dati di casa del membro proprietario: mai conti, transazioni, obiettivi,
  categorie o P.IVA personali, perché la funzione non legge quelle tabelle.
- Un token sconosciuto, revocato, di un membro uscito o di una casa archiviata dà la stessa
  risposta 404, senza distinguere i casi.
- Il token è lungo e casuale (almeno 32 byte). Nelle impostazioni della casa ciascun membro
  vede il proprio link con "Copia", **"Rigenera"** (il vecchio smette di funzionare) e
  **"Revoca"**, con l'avviso "Chiunque abbia questo link vede le scadenze della casa: non
  condividerlo".
- La logica degli eventi è una funzione pura (`calendario.ts`, testata) che, dagli stessi dati,
  costruisce eventi e testo ICS.
- **Ripiego.** Lo scarico una tantum di un file `.ics` dal browser costa quasi niente, perché
  usa la stessa funzione pura: si offre come pulsante secondario "Scarica una volta" accanto al
  link.

**Rischi.** Il token sta nel percorso e quindi può comparire nei log di Vercel e nella
cronologia delle app calendario: è accettabile perché espone solo dati di casa e si rigenera in
un tocco. Nessun limite sui tentativi (192 bit di entropia lo rendono non indovinabile).

## 10. Principi di scrittura didattica

1. **Prima il numero, poi il perché, a richiesta.** Nessun testo lungo sulla schermata: "Come
   si calcola?" apre due righe (formula in parole, ingredienti con i valori).
2. **Un esempio vale una definizione.** "TARI, circa 300 euro l'anno: 25 euro al mese da ora."
3. **Cifre mostrate a fianco, mai raccomandazioni dall'alto.** Tre regole di divisione con "cosa
   resta a ciascuno", nessuna etichettata come giusta.
4. **Parole di casa, non da banca.** "Da parte", "versamento", "quota", "cuscinetto" (con
   definizione). Mai "bloccato", "dilazionato", "giroconto", "sinking fund", "riconciliazione".
5. **Descrivere senza accusare.** "Sono usciti 62 euro più del previsto", non "avete speso
   troppo". "A Fabio spettano 45 euro", non "{partner} deve 45 euro" per un credito verso la casa (per i debiti fra membri vale la frase neutra della 7.5b).
6. **Gli errori sono dei numeri, non delle persone.** "È il secondo mese: forse la quota è un po'
   bassa."
7. **Le stime si dichiarano stime**, e dopo tre mesi si confrontano con la realtà.
8. **Le regole (50/30/20 e simili) sono ordini di grandezza.** Se mai compaiono: "Come
   riferimento, molte famiglie destinano alla casa fra un quarto e un terzo del reddito."
9. **Nessun obbligo, nessun punteggio.** Ogni percorso guidato si può saltare e riprendere.
10. **Una volta al mese e una cosa per volta.** Il check-in è uno, è breve, ha un fine.

Esempi:

| Dove | Testo |
|---|---|
| Quota, risultato | "Fabio versa 776 euro e {partner} 604 euro, entro il 5 di ogni mese." |
| Come si calcola, quota | "Spese comuni 1.321 euro + cuscinetto 59 euro = 1.380 euro, divisi secondo il reddito." / "Fabio: 1.800 su 3.200 di reddito, cioè 56%." |
| Cuscinetto | "Soldi della casa per gli imprevisti, per esempio una caldaia da riparare." |
| Bolletta annuale | "Luce, circa 110 euro ogni due mesi: 55 euro al mese da ora." |
| Credito, per chi ha anticipato | "In attesa del rimborso: 45 euro." |
| Credito, per chi rimborsa | "A Fabio spettano 45 euro per spese anticipate. Rimborsa dal conto comune." |
| Saldo, differenza | "Mancano 80 euro. Succede: nessuno ricorda ogni spesa. Li segniamo come 'spese non registrate'." |
| Ammanco | "Sono usciti 62 euro più del previsto: li prendiamo dal cuscinetto." |
| Avanzo | "Questo mese sono avanzati 47 euro. Li lasciamo al cuscinetto o li mettiamo da parte per qualcosa?" |
| Stima contro reale | "Per la luce avevate previsto 55 euro al mese; le ultime tre bollette fanno 71. Aggiorniamo la stima?" |
| Costi d'ingresso | "Il deposito può essere al massimo di tre mensilità. Ve lo restituiscono a fine contratto." |
| Reddito prudente | "Scrivi una cifra che incassi anche nei mesi magri. Il resto, nei mesi buoni, finisce nel cuscinetto." |
| Stato vuoto | "Ancora nessuna spesa di casa. Appena ne aggiungete una, la vedete qui entrambi." |

## 11. Strategia di test

Stack: Vitest, Testing Library, jsdom, come oggi. TDD sulle funzioni pure.

### 11.1 Isolamento (priorità massima)

1. **Test statico del data layer** (`tests/data/scopeGuard.test.ts`): legge i file in
   `src/lib/data/*.ts` e verifica che ogni `from('accounts' | 'categories' | 'budget_goals' |
   'transactions')` appartenga a una funzione che applica lo scope (`.is('household_id', null)`
   o `.eq('household_id', ...)`) oppure porta il marcatore `// household: per id`. Una query
   nuova senza filtro fa fallire la build. Esenzione unica: `keepAlive.ts`, tramite la
   allowlist `FILE_ESENTI` (6.7), con il motivo nel commento.
2. **Client "registratore"** (`tests/helpers/recordingSupabase.ts`): nuovo helper accanto a
   `fakeSupabase.ts` (che oggi ignora i filtri: `eq`, `gte` restituiscono solo il builder).
   `fakeSupabase.ts` va inoltre esteso con `.is()` (oggi non esiste, e senza di esso ogni test
   di lettura personale si romperebbe appena il data layer aggiunge `.is('household_id',
   null)`) e con ogni altro filtro che le nuove letture useranno: è il primo passo di T2,
   prima di aggiungere i filtri di scope.
   Registra tabella e catena di chiamate. Test per ogni lettura personale: `getAccounts`,
   `getCategories`, `getOpenGoals`, `getTransactions`, `getLastIncomeDate`,
   `getRecentTransactionAmounts` chiamate senza scope **devono** includere
   `is('household_id', null)`; con scope casa devono includere `eq('household_id', id)`.
3. **Database finto con filtri veri** (`tests/helpers/fakeDb.ts`): memoria in-process che
   applica `eq`, `is`, `gte`, `lte`, `ilike`, `order`, `limit`, `insert`, `update`, `delete`,
   `rpc` registrabile. Test di integrazione `tests/HomeIsolation.test.ts`: si carica il
   calcolo della home (estratto in una funzione `loadHomeData(supabase)` testabile, invece di
   restare dentro il Server Component) con righe personali e righe di casa mescolate, e si
   verifica che `disponibileLibero`, il dettaglio, `margineGiornaliero` e `dataTarget` siano
   **identici** a quelli calcolati con le sole righe personali (la casa non cambia nemmeno
   `getLastIncomeDate`). Analoghi test per storico (totali e grafici invariati con
   trasferimenti e spese di casa presenti) e per P.IVA (fatturato invariato). I test usano almeno tre utenti (due membri della casa e uno fuori) più un caso a tre membri.
4. **Script SQL di prova RLS** (`supabase/tests/rls_casa.sql`, eseguito a mano da Fabio nel SQL
   editor, tutto in una transazione che termina con `rollback`): prende almeno tre utenti reali per
   email (A e B nella casa, C fuori; poi C entra e si prova il caso a tre membri), simula `set local role authenticated` con `request.jwt.claims`, e stampa OK o FAIL
   per ciascun caso: A non legge i conti personali di B; A non legge categorie, obiettivi,
   transazioni di B; un membro legge e scrive righe di casa; un non membro no; un membro non
   può cambiare `household_id`; non può riferire una categoria personale in una riga di casa;
   non può modificare o cancellare una spesa di casa pagata con la carta dell'altro, ma può
   modificare e cancellare una spesa di casa normale scritta dall'altro; un insert di casa con
   `user_id` altrui fallisce; `adjust_account_balance` funziona su un conto di casa creato
   dall'altro; un trasferimento personale (`household_id` nullo) non è leggibile dall'altro;
   non può
   scrivere in `transfers` direttamente; `join_household` con codice scaduto, revocato o rigenerato fallisce, mentre un codice valido consente più ingressi; con tre membri le regole sopra valgono per ogni coppia (A modifica una spesa scritta da C, un per conto di fra A e B non coinvolge C) e un quarto utente D fuori non vede nulla; un membro esce se non ha registri aperti;
   dopo `leave_household` l'accesso sparisce; `leave_household` e `close_household` falliscono con un debito fra membri aperto (come debitore o creditore); `record_transfer` rifiuta un `per_conto_di_user_id` diverso dall'altro membro attivo; l'ultimo membro non può uscire ma può
   `close_household`, dopo cui la casa è in sola lettura; `get_calendar_feed` con token errato,
   revocato o di casa archiviata non restituisce nulla, con token valido restituisce solo dati
   di casa; `calendar_feeds` non è leggibile dall'altro né da `anon`; la migrazione eseguita
   due volte non cambia nulla.
   Questo è l'unico test contro le policy reali: Vitest non parla con un database vero.

### 11.2 Calcoli (TDD)
- `quota.test.ts` (inclusa la quota con posizione segnaposto e la regola `personalizzata`, 100 e 0, 70 e 30, somma = totale; parti uguali, proporzionale e pari residuo con N = 3, pari residuo con un membro azzerato e i restanti ricalcolati, resto dell'arrotondamento al reddito maggiore): i tre scenari della ricerca (690/690, 776/604, 890/490), somma = totale
  per proprietà su casi casuali, arrotondamento con resto, avvisi (quota maggiore del
  reddito, spese oltre i redditi), redditi mancanti, un solo reddito a zero.
- `mensilizza.test.ts`: TARI 300 su 12 = 25; luce 110 su 2 = 55; equivalenza.
- `riservoVersamento.test.ts`: riserva dal primo del mese; si chiude registrando; **nessun
  doppio conteggio** (disponibile invariato prima e dopo la registrazione); arretrati; piano
  cambiato a metà storia; solo registrazione; nessun piano = 0; piano in bozza = 0; inizio da
  `max(valido_dal, ingresso, in_casa_dal, attivazione)`; nessun arretrato prima di quella data;
  posizione a 0% o non ancora in casa senza riserva e senza bloccare l'attivazione dell'altra;
  transizione fra due versioni del piano; versamento per conto di che chiude l'arretrato.
- `crediti.test.ts`: anticipato meno rimborsato (per beneficiario); mai negativo; rinuncia; blocco uscita; blocco chiusura casa con crediti.
- `debitiMembri.test.ts`: prestato meno restituito, mai negativo, rate parziali, applicazione al mese più vecchio, rinuncia parziale, versamento di restituzione che crea un credito verso la casa, distinzione fra i due registri, riserva del debito e nessun doppio conteggio alla restituzione, con tre membri debiti per coppia e somma sul debitore, blocco di uscita e chiusura con debito aperto.
- `disponibileCasa.test.ts`: la cascata A-B-C-D-E, cuscinetto che si riempie e supera, E
  negativo, voci con frequenza > 1 non contate in D.
- `accantonato.test.ts` (esteso): con `accantonaDa` nullo i risultati sono quelli di oggi; con
  `accantonaDa` valorizzato i mesi si contano da lì.
- `checkin.test.ts`: avanzo come somma dei due termini, esiti, ammanco consecutivo.
- `stimaVsReale.test.ts`: soglia di tre spese, soglia di differenza, riproposta dopo `n + 3`.
- `spiegazioni.test.ts`: per ogni numero, `valore` coincide con il calcolo diretto e gli
  ingredienti sommano al valore.
- `reminders.test.ts`: ordine, massimo 2, silenzio quando tutto è a posto, tono neutro; il creditore vede "In attesa del rimborso" senza azione, gli altri membri "Rimborsa" (con tre membri, tutti tranne il creditore). Debito fra membri: il debitore vede "Restituisci", il creditore solo l'informazione.
- `calendario.test.ts`: eventi calcolati dai dati (versamento, check-in, controllo del saldo,
  bollette e scadenze, credito aperto), UID stabili, formato ICS valido (fine riga CRLF,
  escape, date di giornata intera), nessun campo personale nei dati accettati in ingresso.

### 11.3 Data layer e componenti
- Test dei nuovi file in `src/lib/data` con `fakeSelectClient`/`fakeMutationClient` e un
  `fakeRpcClient` (nuovo): mappatura snake_case, parametri passati alle RPC, errori.
- Componenti (Testing Library): selettore Personale|Casa nell'aggiunta (default, memoria,
  testo "Lo vedrà anche", categorie e conti cambiano, "Chi ha pagato"), wizard della quota
  (avanzamento, risultati a fianco, frase finale, avvisi), `ComeSiCalcola`, `GoalsList` in
  variante casa (nessuna parola vietata nel DOM: test che cerca "bloccato" e "dilazionato" e
  fallisce se ci sono), invito e ingresso, check del saldo, check-in mensile, banner.
- Rotta del feed (con `rpc` simulato): token sconosciuto o revocato risponde 404 con lo stesso
  corpo, token valido risponde 200 con `text/calendar` e `no-store`, nessuna sessione richiesta,
  la rotta non è bloccata da `proxy.ts`.
- Test che gli aggiornamenti ottimistici mostrano lo stato nuovo prima della fine della
  scrittura e il messaggio di errore se fallisce.
- I test esistenti non cambiano di significato; quelli che fanno `toEqual` su tipi estesi
  vanno aggiornati con i campi opzionali.

## 12. Ordine di consegna

Ogni consegna lascia l'app funzionante, passa `npm test`, `npm run lint` e `next build`, si
committa e si pusha su master. Ogni task è assegnabile a un subagent con un contesto limitato:
indica i file, le dipendenze e quando è finito. Il task T1 è l'unica cosa che richiede un gesto
di Fabio (eseguire lo SQL).

### Consegna 1: Fondamenta (invisibile all'utente)

- **T1. Migrazione e script di prova.** Dipende da: nulla. Scrive `0004_casa_comune.sql`
  (sezione 6, comprese le tabelle e le funzioni del feed calendario) e `supabase/tests/rls_casa.sql` (11.1.4). Finito quando Fabio ha eseguito la
  migrazione, lo script di prova stampa solo OK e l'app attuale funziona uguale.
- **T2. Scope nel data layer, tipi, helper di test.** Dipende da: T1 per l'esecuzione reale,
  non per scrivere il codice. Come primissimo passo estende `tests/helpers/fakeSupabase.ts` con
  `.is()` (e con gli altri filtri che le nuove letture usano), altrimenti i test esistenti si
  romperebbero appena si aggiunge lo scope. Poi introduce `Scope`, il filtro `is null` di
  default in tutte le letture, i nuovi tipi, `recordingSupabase`, `fakeDb`, `fakeRpcClient`, il
  test statico (con la allowlist per `keepAlive.ts`), e l'estrazione di `loadHomeData`. Finito quando i test di isolamento 1, 2 e 3 passano e
  nessuna schermata è cambiata.

### Consegna 2: La casa esiste

- **T3. Casa, invito, ingresso, uscita, scheletro `/casa`, navigazione.** Dipende da: T2.
  `households.ts`, `/casa`, `/casa/inizia`, `/casa/impostazioni`, voce Casa in `NavBar` (e
  Categorie spostata in Conti), aggiornamento di `PRODUCT.md` (principio 3 e sezione
  "Capabilities") e di `ROADMAP.md`. Finito quando due o più account reali si collegano con lo
  stesso codice, l'uscita funziona e l'ultimo rimasto può chiudere la casa.

### Consegna 3: La quota (utile subito, per decidere prima dell'affitto)

- **T4. Calcoli della quota.** Dipende da: T2. In parallelo con T3. `vociTipiche`,
  `mensilizza`, `quota` (anche la regola `personalizzata`), `spiegazioni` (quota), con tutti i test 11.2. Nessuna UI.
- **T5. Wizard "Calcola la nostra quota", salvataggio del piano, `ComeSiCalcola`.** Dipende
  da: T3, T4. `save_household_plan`, `householdPlans.ts`, `/casa/quota` in 5 schermate, la
  pagina del piano attuale, il componente `ComeSiCalcola` riutilizzabile. Il piano si può
  salvare come bozza con la posizione segnaposto. Il wizard chiede "In casa dal", offre "Per
  questo periodo" (100% a chi abita già, regola normale, percentuali) e propone la versione di
  transizione; `save_household_plan` accetta più versioni. Finito quando chi crea la casa conferma un
  piano in bozza, e a ingresso avvenuto chi entra lo vede e il piano risulta attivo.

### Consegna 4: Le spese comuni

- **T6. Conto comune, spese di casa, selettore Personale|Casa, disponibile casa v1.**
  Dipende da: T3. Creazione del conto di casa (anche dai "Prossimi passi" del wizard),
  `adjust_account_balance`, scope casa in transazioni, categorie di casa di base, estensione di
  `AddTransactionForm` e `HomeDashboard`, `/casa/movimenti`, hero "Disponibile casa" con
  A meno B (C e D a zero finché non esistono piano e crediti). Finito quando entrambi
  registrano una spesa di casa e la vedono sul telefono dell'altro.

### Consegna 5: Versamenti, rimborsi e disponibile onesto

- **T7. Trasferimenti, crediti, righe neutre nello storico.** Dipende da: T6.
  `record_transfer`, `delete_transfer`, `transfers.ts`, registrazione di versamento (anche "per conto di"), restituzione e rimborso, registro dei
  debiti fra membri `debitiMembri.ts` con il loro elenco in `/casa` (il rimborso lo registra
  chi rimborsa; chi ha anticipato vede "In attesa del rimborso" senza azione),
  "Chi ha pagato: io", credito, righe neutre in `/history`, lista con annulla. Finito quando i
  saldi e il credito tornano e gli stati dello storico non cambiano.
- **T8. Riserva del versamento e promemoria.** Dipende da: T5, T7. `riservoVersamento`,
  modifica compatibile di `computeDisponibileLibero`, riga nel dettaglio della home, riga del
  credito e del debito fra membri, riserva del debito, `computeReminders` con i primi tre tipi, striscia promemoria in home e in `/casa`.
  Finito quando il test "nessun doppio conteggio" passa e il disponibile personale scala il
  versamento.
- **T8b. Feed calendario privato.** Dipende da: T8 (la migrazione di T1 contiene già tabella e
  funzioni). Scrive `calendarFeeds.ts`, la funzione pura `calendario.ts` con i test, il route
  handler, l'eccezione in `src/proxy.ts`, la sezione "Calendario" in `/casa/impostazioni`
  (copia, rigenera, revoca, scarico una tantum) e le istruzioni per Google Calendar e iPhone.
  Gli eventi di bollette e scadenze compaiono man mano che T9 e T12 portano i dati. Finito
  quando un link valido si aggiunge a un calendario reale, un link rigenerato o revocato
  smette di funzionare e nessun dato personale compare nel feed.

### Consegna 6: Da parte

- **T9. Motore `accantona_da`, bollette in un tocco, preselezione per categoria.** Dipende da:
  T5, T6. Modifica a `accantonato.ts` con test, `/casa/da-parte`, variante casa di
  `GoalsList`, collegamento voce-obiettivo, preselezione dell'obiettivo nell'aggiunta, disponibile
  casa completo (B, C, D).
- **T10. Costi per entrare in casa.** Dipende da: T9. In parallelo con T11. Checklist,
  interruttore cedolare secca, data di ingresso, creazione degli obiettivi "da pagare una volta"
  in modalità graduale con scadenza alla data di ingresso (non una riserva immediata).

### Consegna 7: I controlli

- **T11. Controllo del saldo del conto comune.** Dipende da: T6. `record_balance_check`,
  `balanceChecks.ts`, schermata, riga "spese non registrate", promemoria dedicato.
- **T12. Check-in mensile.** Dipende da: T8, T9, T11. `checkin.ts`, `checkins.ts`,
  `/casa/controllo`, destinazione dell'avanzo, avviso del secondo ammanco.
- **T13. Stima contro reale.** Dipende da: T5, T12. `stimaVsReale.ts`, card nel check-in e
  nella pagina quota, aggiornamento del piano e dell'obiettivo.

### Consegna 8: Rifiniture

- **T14. Stati vuoti e di errore, testi, documenti.** Dipende da:
  tutte. Stati vuoti e di errore della parte Casa, verifica "nessuna parola
  vietata", passata di coerenza dei testi, aggiornamento di `ROADMAP.md`.

Parallelismo possibile: T3 con T4, T10 con T11. Il minimo che serve per l'affitto:
Consegne 1, 2, 3, 4, 5 (T8b si può rimandare).

## 13. Rischi e punti delicati

- **Fuso orario.** `page.tsx` calcola `new Date()` sul server Vercel in UTC. Per riserva,
  scadenze e check-in il confine di mese a mezzanotte italiana può sbagliare di un mese. Tutta
  la parte Casa deve prendere "oggi" e "mese corrente" da una funzione unica in fuso
  `Europe/Rome`.
- **Letture personali che si dimenticano il filtro.** Mitigata da default di scope e test
  statico. Punti noti da coprire: `getLastIncomeDate` (altrimenti una "entrata" di casa sposta
  la data target del margine giornaliero), `getRecentTransactionAmounts`, storico, P.IVA.
- **Scritture concorrenti sul conto comune.** Due persone che aggiornano lo stesso saldo
  assoluto si sovrascrivono: per i conti di casa si usano solo delta atomici
  (`adjust_account_balance`, `record_transfer`).
- **Aggiornamento dei saldi non atomico oggi** (creazione transazione e poi saldo, due
  chiamate): resta così per il personale; per la casa i trasferimenti sono atomici, mentre una
  spesa di casa può restare con il saldo non aggiornato se la seconda chiamata fallisce. Il
  controllo del saldo (8.9) è proprio la rete di sicurezza.
- **Reddito dell'altro.** I redditi del piano sono visibili ai membri, per decisione di Fabio.
- **Codice di invito.** 8 caratteri su un alfabeto di 32 simboli, riutilizzabile finché non è revocato o rigenerato (al massimo 7 giorni),
  errore generico: sufficiente per poche persone che si conoscono; chi ha il codice può entrare, quindi conviene rigenerarlo dopo l'ultimo ingresso. Nessun limite sui tentativi
  nella prima versione.
- **Utente eliminato.** `user_id` ha `on delete cascade`: cancellare un account cancellerebbe
  anche le righe di casa che ha scritto. Non esiste un flusso di cancellazione account, quindi
  è un rischio solo manuale; da non fare con una casa attiva.
- **Quote dopo l'uscita.** La quota di chi esce non è più attesa dal mese successivo e il
  piano resta attivo per gli altri, ma le quote dei rimasti restano quelle vecchie finché non
  si crea una nuova versione: per questo il promemoria "Rivedi la quota".
- **Feed calendario.** Chi ha il link legge le scadenze della casa senza login. Mitigato da
  token lungo, rigenerazione e revoca, funzione di lettura che vede solo dati di casa. Gli
  aggiornamenti dipendono dal provider (ore, non verificato).
- **Casa archiviata.** Chiudere la casa non libera i dati: restano in sola lettura e
  `on delete restrict` e `household_id` immutabile restano validi.
- **Costi di ingresso e interessi sul deposito** sono contenuti indicativi non verificati con
  fonti ufficiali complete (vedi il documento di ricerca): mai presentarli come regola.
- **Il motore degli obiettivi ricorrenti ha un caso limite noto** (transazione sul confine del
  ciclo, nel backlog): vale anche per la casa.

## 14. Lasciato al builder

- Forma esatta del JSON di `save_household_plan` e dei payload delle altre RPC.
- Nomi interni di file, componenti, hook e query; suddivisione fra Server e Client Component
  per ogni pagina; se la home casa supera una decina di query, valutare una vista o RPC unica.
- Layout visivo di dettaglio, spaziature, icone, animazioni: si usa il linguaggio attuale
  (hero card, sheet dal basso, nav flottante); il blocco 2 rifarà il design.
- Testo definitivo di tutti i messaggi non elencati, nel rispetto dei principi della sezione
  10 e dell'elenco delle parole vietate.
- Se aggiornare i test esistenti per i campi nuovi o tenere i campi opzionali.
- Generazione del codice di invito (alfabeto e gruppi) e suo formato di visualizzazione.
- Schema esatto degli indici, tipi di `numeric` (precisione e scala), nomi di vincoli e policy.
- Se il calcolo del fuso `Europe/Rome` usa `Intl` o una piccola utility; la libreria `date-fns-tz`
  non è nelle dipendenze e non va aggiunta senza motivo.
- Come mostrare più di un conto di casa (il modello lo permette; la prima versione assume un
  conto comune principale).
- Visualizzazione dei nomi nelle liste (iniziali, nome intero).
- Eventuale cache di sessione per le letture della casa nella barra di navigazione (puntino dei
  promemoria) senza aggiungere richieste a ogni pagina.
- Generazione del token del feed (per esempio `gen_random_bytes` di pgcrypto o due
  `gen_random_uuid()`), percorso esatto della rotta, forma del `jsonb` di
  `get_calendar_feed`, data dell'evento del credito, UID e orizzonte degli eventi.
- Come `record_transfer` sceglie il conto personale di chi riceve il rimborso quando le spese
  anticipate sono su più conti (il minimo è il conto della spesa aperta più vecchia).

## 15. Decisioni aperte per Fabio

Nessuna.

## 16. Elenco delle scelte del redattore

1. Una persona appartiene al massimo a una casa, nessun tetto ai membri (indice unico parziale su `user_id` dove `attivo`).
2. Colonna `budget_goals.accantona_da` per far partire "da ora" le bollette create a metà ciclo.
3. Gli arretrati dei versamenti restano riservati nel disponibile personale; via d'uscita con
   "solo registrazione".
4. Il credito non si somma al disponibile personale: riga informativa.
5. Registro dei crediti (anticipato meno rimborsato) invece dell'abbinamento spesa per spesa.
6. Il rimborso lo registra chi rimborsa (il beneficiario vede "In attesa del rimborso" senza
   azione; `record_transfer` è definer perché scrive sul conto personale del beneficiario);
   solo chi ha anticipato modifica o cancella una spesa pagata con la sua carta (vedi 26).
7. Trasferimenti e saldi di casa tramite funzioni SQL atomiche (`record_transfer`,
   `adjust_account_balance`, `record_balance_check`, `save_household_plan`).
8. Piano della quota versionato per mese (`valido_dal`), con voci e quote in tabelle figlie.
9. Cuscinetto derivato (E ristretto fra 0 e l'obiettivo), con default 1 mensilità e quota del
   5%; l'avanzo "da parte" aumenta il target di un obiettivo di casa da pagare una volta.
10. Formula del disponibile casa come cascata A, B, C, D, E, con le voci del mese (frequenza 1)
    come "ancora da pagare".
11. Voci con frequenza maggiore di 1 diventano obiettivi "da parte"; luce, gas e acqua trattati
    così (frequenza 2, 2, 3 per default).
12. Regola proporzionale preselezionata nel wizard, senza presentarla come giusta.
13. Resto dell'arrotondamento delle quote al membro con reddito maggiore.
14. Nome mostrato degli altri membri (`display_name`) scelto all'ingresso.
15. Si può solo uscire da sé; nessuna rimozione dell'altro nella prima versione; uscita
    bloccata con crediti aperti; l'ultimo rimasto non esce ma chiude la casa (vedi 35).
16. Barra di navigazione: Casa entra, Categorie passa sotto Conti.
17. Il selettore Personale|Casa ricorda l'ultima scelta per dispositivo; dalle pagine `/casa/*`
    parte sempre su Casa.
18. Preselezione dell'obiettivo di casa dalla categoria nell'aggiunta di una spesa.
19. Controllo del saldo ogni 14 giorni e all'inizio del check-in; tolleranza di 1 euro.
20. Promemoria massimo 2 alla volta, "più tardi" in `localStorage`, nessuna tabella.
21. Calendario come feed ICS per membro: tabella `calendar_feeds`, lettura solo tramite
    `get_calendar_feed(token)` definer, rotta fuori dal controllo di sessione di `proxy.ts`,
    scarico una tantum come ripiego perché usa la stessa funzione pura. Le push sono rimandate
    per decisione di Fabio.
22. Test statico sul data layer e `fakeDb`/`recordingSupabase` come helper di test; script SQL
    manuale per le RLS.
23. Righe neutre nello storico personale per versamenti, rimborsi e spese anticipate.
24. Tutta la parte Casa calcola "oggi" in fuso `Europe/Rome`.
25. Il trigger `forbid_household_change` rende `household_id` immutabile.
26. RLS delle righe di casa: insert solo con `user_id = auth.uid()` e membro; update e delete a
    qualsiasi membro, tranne le spese pagate con carta personale (solo chi ha pagato) e i conti
    di casa (nessun delete). `user_id` e `pagata_da_user_id` immutabili per trigger, così
    l'apertura dell'update non fa passare nessuno per autore o creditore. Le funzioni
    `adjust_account_balance`, `record_balance_check` e `save_household_plan` restano invoker e
    quindi valgono per il membro che non ha creato la riga; le definer verificano da sole
    membro e casa e fissano `search_path`.
27. `household_plan_shares.reddito_irregolare` resta: i redditi sono condivisi per decisione,
    il campo etichetta solo la cifra come "reddito prudente"; il modulo P.IVA personale resta
    illeggibile (chiarito negli anti obiettivi).
28. Piano prima che l'altra entri: quote legate a una posizione (slot da 1 a N) con `user_id` null
    e nome del segnaposto; il piano è una bozza calcolabile subito; la riserva nel disponibile
    personale parte solo a piano attivo, cioè con legate a membri tutte le posizioni con quota maggiore di zero
    (una posizione a 0% o non ancora in casa non blocca l'altra).
29. `valido_dal` solo dal mese corrente in poi; la riserva di ciascuno conta da
    `max(valido_dal, ingresso del membro, in_casa_dal, attivazione del piano)`, senza arretrati
    all'indietro.
30. La checklist dei costi di ingresso usa il motore graduale (dilazionato) con la data di
    ingresso come scadenza, non una riserva immediata; se i costi si anticipano con carta
    personale prima che il conto comune abbia i soldi, vale il credito.
31. `tests/helpers/fakeSupabase.ts` si estende con `.is()` (e gli altri filtri necessari) come
    primo passo di T2, prima di aggiungere i filtri di scope.
32. `src/lib/data/keepAlive.ts` è esente dal test statico con una voce in una allowlist di file
    (`FILE_ESENTI`), non con il marcatore `// household: per id`.
33. `transfers`: i trasferimenti personali (`household_id` nullo) li legge e li scrive solo
    l'autore; quelli di casa li leggono i membri; nessuna scrittura diretta, solo le funzioni.
34. Promemoria del credito asimmetrico: chi ha anticipato vede "In attesa del rimborso" con
    l'importo e nessun pulsante; l'altro membro vede "Rimborsa". Il registro `transfers` guadagna
    `beneficiario_user_id`, e la rinuncia è un rimborso `solo_registrazione` senza conti.
35. L'ultimo membro non può uscire: può "Chiudere la casa" (`close_household`), che archivia
    (`archiviata_il`, sola lettura, nascosta dalla navigazione) senza cancellare, e mette
    `attivo = false` sul membro per liberarlo. L'uscita resta bloccata con crediti aperti.
36. Ingresso asincrono: regola `personalizzata` con `percentuale` per posizione (100 e 0 è il caso
    "tutto a chi abita già"); `in_casa_dal` sta sulle quote del piano, non su `household_members`,
    perché il segnaposto non ha riga di membro; il wizard propone la versione di transizione dal
    mese successivo all'ingresso dell'altro; `save_household_plan` accetta più versioni.
37. Quote coperte: "versamento per conto di" (`per_conto_di_user_id`) conta come quota versata
    per la casa; il debito fra membri è un registro distinto dal credito verso la casa
    (`debitiMembri.ts`), riservato nel disponibile del debitore e solo informativo per il
    creditore; restituzione diretta (`restituzione`) oppure versamento di restituzione, che
    converte il debito in credito verso la casa; frase neutra "deve a" ammessa solo per questi debiti.
38. Gli arretrati non coperti restano visibili a entrambi e mai cancellati; uscita e chiusura
    della casa sono bloccate sia da crediti verso la casa sia da debiti fra membri.
39. Nessun limite di membri (decisione di Fabio): slot da 1 a N, invito riutilizzabile finché non
    è revocato o rigenerato (con scadenza di sicurezza di 7 giorni, **[Scelta del redattore]**),
    regola `parti_uguali` al posto di 50/50, `pari_residuo` su N con azzeramento iterato di chi
    avrebbe una quota negativa, resto dell'arrotondamento al reddito maggiore, debiti per coppia
    con debitore e creditore espliciti, "Rimborsa" a tutti tranne il creditore (la prima
    registrazione chiude il credito), uscita libera senza registri aperti.
40. Uscita: la quota attesa e la riserva di chi esce finiscono dal mese successivo (`esce_dal`); gli
    arretrati fino ad allora bloccano l'uscita finché non sono versati o coperti; la sua posizione
    è sciolta ed esclusa dall'attivazione, il piano resta attivo; i rimasti ricevono il
    promemoria "Rivedi la quota" che crea una nuova versione dal mese successivo.
41. Un nuovo membro non riusa mai la posizione di un ex membro in una versione esistente: si lega
    solo a un segnaposto o riceve una posizione nuova aggiunta dal wizard nella nuova versione;
    le versioni vecchie conservano il `user_id` di chi è uscito.
