# App di finanza personale — Design

Data: 2026-08-29
Stato: approvato in brainstorming, pronto per il piano di implementazione

## 1. Obiettivo e contesto

Sostituire il foglio "Weekly Expense + Income Tracker" (Google Sheets + Google Forms) con
una web app personale, utilizzabile comodamente da iPhone (PWA) e da desktop, che risponda
a una domanda concreta: **"quanto posso spendere adesso senza mettermi nei guai prima della
prossima entrata?"**.

**Fuori scope per questo progetto:** divisione spese con altre persone (tipo Tricount). Oggi
per quello si continua a usare l'app Tricount esistente. Può diventare un progetto separato
in futuro, con la sua spec.

**Utenti:** singolo utente (Fabio). Nessuna gestione multi-utente/condivisione.

**Pain point del foglio attuale che questa app deve risolvere:**
- inserimento spese scomodo/lento da telefono (oggi via Google Form)
- non è immediato vedere "quanto posso spendere davvero ora"
- categorie e voci pianificate (Long-term Planning) rigide, difficili da modificare
- UX del foglio Excel/Sheets inutilizzabile da cellulare

## 2. Architettura

- **Frontend:** web app React (Next.js), responsive, installabile come PWA su iPhone
  (Home Screen) e utilizzabile identica da browser desktop — stesso URL, stessi dati.
- **Backend/dati:** Supabase (Postgres + Auth), piano gratuito.
- **Hosting:** Vercel o Netlify, piano gratuito, deploy automatico da git.
- **Autenticazione:** singolo utente, email+password via Supabase Auth.
- **Saldo conti:** inserimento manuale (nessuna integrazione Open Banking/PSD2 — in Italia
  richiederebbe provider a pagamento sopra soglie base, incompatibile con l'obiettivo
  "100% gratis").
- **Costo:** €0/mese nei limiti dei piani free.
- **Reattività UI:** ogni azione (aggiungere/modificare/cancellare una transazione o un
  obiettivo) usa **optimistic UI update** — l'interfaccia si aggiorna subito come se
  l'operazione fosse già confermata, mentre la scrittura reale su Supabase avviene in
  background senza bloccare l'utente, che può continuare a usare l'app nel frattempo. Se la
  scrittura fallisce (es. connessione assente), l'azione viene segnalata come non riuscita
  e va ripetuta — niente coda offline persistente: non serve, dato che l'app richiede
  comunque una connessione minima per funzionare (vedi decisione sotto).
- **Offline:** non supportato in questa fase. Scelta deliberata per tenere semplice
  l'implementazione (niente service worker con coda di sincronizzazione né gestione di
  conflitti); l'unico requisito è avere una connessione al momento dell'azione, non durante
  tutta la sessione.

## 3. Modello dati (Postgres)

### `accounts`
Conti che l'utente aggiorna manualmente. Non fissi a un numero: tabella generica.

| campo | tipo | note |
|---|---|---|
| id | uuid | |
| nome | text | es. "Conto corrente", "Fondo emergenza" |
| saldo_attuale | numeric | aggiornato manualmente dall'utente |
| conta_in_disponibile | boolean | true = il saldo alimenta il calcolo di "disponibile libero" (es. conto corrente); false = tracciato solo come informazione/progresso (es. fondo emergenza) |
| target_saldo | numeric, nullable | opzionale, per conti tipo fondo emergenza dove ha senso vedere una barra di progresso verso un obiettivo |

### `categories`
| campo | tipo | note |
|---|---|---|
| id | uuid | |
| nome | text | libera, modificabile dall'utente |
| tipo | enum(`expense`,`income`) | |
| colore/icona | text | per la UI |
| archiviata | boolean | le categorie non si cancellano se già usate, si archiviano |

### `transactions`
Sostituisce i tab Expenses + Income (uniti in uno).

| campo | tipo | note |
|---|---|---|
| id | uuid | |
| tipo | enum(`expense`,`income`) | |
| importo | numeric | |
| data | date | |
| categoria_id | uuid, nullable | FK a `categories` |
| account_id | uuid, nullable | da quale conto è uscita/entrata (opzionale, per chi vuole tracciarlo) |
| goal_id | uuid, nullable | FK a `budget_goals`, se la transazione va imputata a un obiettivo aperto |
| descrizione | text | |
| nota | text, nullable | |
| created_at | timestamptz | |

### `budget_goals`
Unifica il vecchio "Long-term Planning" (voci ricorrenti come bollo/revisione) e i nuovi
obiettivi ad-hoc (viaggio, regalo, Telepass). Una sola tabella, un solo concetto, due modalità.

| campo | tipo | note |
|---|---|---|
| id | uuid | |
| nome | text | es. "Viaggio Sile", "Telepass", "Regalo anniversario", "Bollo moto" |
| importo_target | numeric | |
| modalita | enum(`bloccato`,`dilazionato`) | vedi logica di calcolo sotto |
| scadenza | date, nullable | data entro cui serve il denaro; obbligatoria se `dilazionato` |
| categoria_id | uuid, nullable | FK a `categories`, opzionale |
| ricorrente | boolean | true per voci come bollo/revisione che si ripetono |
| frequenza_anni | numeric, nullable | usata se `ricorrente = true` |
| stato | enum(`aperto`,`chiuso`,`scaduto`) | |
| speso_finora | numeric, derivato | somma delle `transactions` collegate via `goal_id` |

### `settings`
Riga singola con parametri globali (es. eventuali preferenze di visualizzazione). Il target
del fondo emergenza vive già in `accounts.target_saldo`, quindi questa tabella resta minima.

Nota di progettazione: niente tabelle per le viste aggregate (Weekly/Monthly/Income
Dashboard del foglio attuale). Sono tutte **query calcolate al volo** sul database, mai
salvate — così restano sempre corrette senza rischio di disallineamento come con le formule
Excel.

## 4. Logica di calcolo

### Disponibile libero
```
disponibile_libero =
    somma(saldo_attuale di accounts dove conta_in_disponibile = true)
    − somma(importo_target di budget_goals aperti con modalita = 'bloccato')
    − somma(quota_accantonata_finora di budget_goals aperti con modalita = 'dilazionato')
```

### Modalità di un obiettivo (`budget_goals.modalita`)

- **Bloccato**: l'intero `importo_target` viene sottratto dal disponibile libero non appena
  l'obiettivo viene creato (stato `aperto`). Esempi: Telepass 130€, Viaggio 400€. Se
  `speso_finora < importo_target` quando l'obiettivo viene chiuso, la differenza torna
  disponibile.
- **Dilazionato**: l'importo si accumula gradualmente fino alla `scadenza`. Quota periodica:
  ```
  quota_periodo = importo_target / periodi_rimanenti_fino_a_scadenza
  ```
  dove `periodi_rimanenti` è calcolato in mesi (o settimane, coerente con l'orizzonte di
  visualizzazione) dalla data odierna alla `scadenza`. La `quota_accantonata_finora` cresce
  nel tempo (ricalcolata ad ogni apertura dell'app in base alla data corrente), non tutta
  subito. Per le voci `ricorrente = true` (bollo, revisione), dopo ogni scadenza si
  ricalcola automaticamente la prossima usando `frequenza_anni` — stessa logica che oggi è
  in "Long-term Planning", generalizzata a qualunque scadenza (non solo fine mese/anno).

### Margine di spesa sicuro (il numero chiave in home)

Non è legato a un singolo obiettivo: guarda **all'insieme** di tutto ciò che è aperto.

```
margine_giornaliero_sicuro = disponibile_libero / giorni_rimanenti_fino_alla_data_target
```

- **Data target**: stimata automaticamente dalla cadenza delle entrate passate registrate
  in `transactions` (tipo `income`) — es. se lo stipendio arriva sempre verso una certa data
  del mese, si proietta la prossima. L'utente può sempre sovrascriverla a mano per un
  controllo puntuale (es. "voglio arrivare al 7").
- Il calcolo usa già `disponibile_libero`, quindi tiene conto automaticamente di *tutti* gli
  obiettivi bloccati e dilazionati aperti insieme, non uno alla volta.

## 5. Schermate

1. **Home** — numero principale: disponibile libero. Sotto: margine di spesa sicuro al
   giorno fino alla data target (stimata o impostata a mano). Dettaglio pieghevole con il
   breakdown (saldo conti, obiettivi bloccati, quote dilazionate). Pulsante "+" prominente
   per aggiungere una transazione.
2. **Aggiungi transazione** — importo (tastierino numerico), spesa/entrata, categoria a
   icone (un tap), conto (opzionale), obiettivo collegato (opzionale), data (default oggi),
   nota. Obiettivo: inserimento in meno di 10 secondi.
3. **Obiettivi di budget** — lista obiettivi aperti con barra speso/target, filtro
   aperti/chiusi/scaduti, creazione nuovo obiettivo (nome, importo, modalità
   bloccato/dilazionato, scadenza opzionale, ricorrenza opzionale, categoria opzionale).
4. **Storico/Report** — equivalente di Weekly/Monthly Overview: totali per categoria,
   andamento nel tempo, lista transazioni filtrabile, modificabile e cancellabile.
5. **Conti** (sezione di Impostazioni o schermata propria) — lista conti con saldo
   aggiornabile manualmente; per i conti con `target_saldo` impostato (es. fondo emergenza)
   mostra barra di avanzamento.
6. **Impostazioni** — gestione categorie (crea/rinomina/archivia), gestione conti,
   preferenze data target.

## 6. Migrazione dati esistenti

Import una tantum dai dati storici del foglio (Expenses, Income) verso `transactions`,
mappando le categorie esistenti su `categories`. Le voci storiche di "Long-term Planning"
vengono ricreate come `budget_goals` con `ricorrente = true` dove applicabile. Dettagli
implementativi (script una tantum vs UI di import) da definire in fase di piano.

## 7. Domande aperte da chiarire in fase di piano/implementazione

- Formato preciso di import dei dati storici (quante righe, range di date da portare).
- Se la stima automatica della "data target" debba guardare solo l'ultima entrata o una
  media delle ultime N entrate.
- Notifiche (es. avviso quando il margine giornaliero scende sotto una soglia) — non
  richieste esplicitamente finora, da confermare se rientrano nell'MVP o in una fase 2.
