# Gestione P.IVA (regime forfettario) — design

## 1. Contesto e obiettivo

Entrambi gli account (Fabio e Miriam) hanno partita IVA in **regime forfettario**
(coefficiente di redditività 78% per le rispettive professioni — perito
agrario/agrotecnico con cassa ENPAIA per Fabio, psicologa con cassa ENPAP per
Miriam). Ogni fattura genera due obblighi da accantonare:

- **imposta sostitutiva** (5% nei primi 5 anni di attività, poi 15%) al posto
  dell'IRPEF — il regime forfettario è inoltre esente IVA, quindi non c'è
  reale gestione dell'IVA da fare;
- **contributi previdenziali** alla propria cassa (contributo soggettivo +
  contributo integrativo, con un minimale annuo).

Oggi questo calcolo si fa a mano fuori dall'app. Obiettivo: una scheda P.IVA
che, guardando il fatturato già registrato, stimi quanto accantonare
quest'anno e suggerisca una quota mensile, così da poter "bloccare" quella
cifra in un conto dedicato (separato dal fondo emergenza).

**Fuori scope esplicito:** regime ordinario (IRPEF a scaglioni), invio F24,
promemoria di scadenza, multi-cassa con regole legali hardcoded. Le aliquote
specifiche della propria cassa (integrativo, minimale) sono **configurabili
dall'utente**, non calcolate dall'app in base a regole fiscali — l'app fa solo
aritmetica sui parametri che l'utente inserisce/conferma.

## 2. Modello dati

Nuova tabella `piva_settings`, una riga per account (stesso pattern RLS di
tutte le altre tabelle: `user_id uuid not null default auth.uid()`, policy
`auth.uid() = user_id`):

| campo | tipo | note |
|---|---|---|
| id | uuid | pk |
| attivo | boolean, default false | mostra/nasconde il contenuto della scheda P.IVA |
| data_apertura | date, nullable | usata per calcolare in automatico se si è nei primi 5 anni (aliquota 5%) o oltre (15%) |
| categoria_fatturato_id | uuid, nullable, FK a `categories` | quale categoria di entrata rappresenta il fatturato P.IVA |
| coefficiente_redditivita | numeric, default 78 | % applicata al fatturato per ottenere il reddito imponibile |
| aliquota_sostitutiva_override | numeric, nullable | se impostata, sovrascrive il calcolo automatico 5%/15% da `data_apertura` |
| aliquota_contributo_soggettivo | numeric, default 10 | % applicata sul reddito imponibile |
| aliquota_contributo_integrativo | numeric, default 4 | % applicata sul fatturato lordo (base tipica per casse come ENPAP) |
| minimale_contributivo_annuo | numeric, default 0 | soglia minima annua di contributo soggettivo |
| contributi_versati_anno_precedente | numeric, default 0 | campo manuale opzionale, dedotto dal reddito imponibile (principio di cassa); 0 se non compilato |

Nessuna nuova tabella per il "fondo bloccato": si riusa `accounts` esistente
(l'utente crea un conto tipo "Fondo Tasse" con `conta_in_disponibile = false`,
esattamente come il fondo emergenza).

## 3. Calcolo (funzioni pure in `src/lib/calculations/piva.ts`, testate)

Tutte le funzioni operano sull'anno solare corrente (anno fiscale italiano =
anno solare):

1. `computeFatturatoAnnuo(transactions, categoriaFatturatoId, anno)` — somma
   `importo` delle transazioni con `tipo = 'income'`,
   `categoriaId = categoriaFatturatoId` e anno di `data` uguale ad `anno`.
2. `computeRedditoImponibile(fatturato, coefficiente, contributiVersatiAnnoPrecedente)`
   → `fatturato * coefficiente / 100 - contributiVersatiAnnoPrecedente`
   (mai negativo, floor a 0).
3. `computeAliquotaSostitutiva(dataApertura, oggi, override)` → se `override`
   non nullo lo ritorna; altrimenti se `dataApertura` è nulla o sono passati 5
   anni o più ritorna 15, altrimenti 5.
4. `computeImpostaSostitutiva(redditoImponibile, aliquota)` →
   `redditoImponibile * aliquota / 100`.
5. `computeContributoSoggettivo(redditoImponibile, aliquotaSoggettivo, minimale)`
   → `max(redditoImponibile * aliquotaSoggettivo / 100, minimale)`.
6. `computeContributoIntegrativo(fatturato, aliquotaIntegrativo)` →
   `fatturato * aliquotaIntegrativo / 100`.
7. `computeTotaleDaAccantonare(impostaSostitutiva, contributoSoggettivo, contributoIntegrativo)`
   → somma dei tre.
8. `computeQuotaMensileSuggerita(totale, oggi)` → `totale` diviso i mesi
   rimanenti nell'anno solare corrente (incluso il mese corrente), stesso
   principio già usato per la quota giornaliera in home.

Nessuna di queste funzioni scrive dati: la schermata le chiama con i dati già
caricati (transazioni + impostazioni) e mostra i risultati.

## 4. UI

- **Nuova voce in `NavBar`**: "P.IVA" (icona `Receipt`), sempre presente nel
  menu (evita il problema di dover attivare una funzione che non si vede da
  nessuna parte).
- **Route `/piva`**:
  - se `piva_settings.attivo` è `false` (o non esiste ancora la riga): schermata
    di attivazione con form di configurazione (data apertura, categoria
    fatturato — select tra le categorie `income` esistenti, coefficiente,
    aliquota sostitutiva con opzione "Automatica da data apertura" oppure
    override manuale 5%/15%, aliquote contributive, minimale, contributi
    versati anno precedente) e pulsante "Attiva gestione P.IVA". Il pulsante
    resta disabilitato finché non è selezionata una categoria fatturato
    (obbligatoria per poter calcolare qualunque cosa).
  - se `attivo` è `true`: dashboard con fatturato annuo ad oggi, imposta
    sostitutiva stimata, contributi previdenziali stimati (soggettivo +
    integrativo), totale da accantonare, quota mensile suggerita, e un
    link alla schermata di configurazione per modificare i parametri o
    disattivare la funzione.

## 5. Semplificazioni note (dichiarate esplicitamente in UI, non nascoste)

- Il calcolo usa il fatturato e le impostazioni correnti applicati
  retroattivamente a tutto l'anno solare in corso — non gestisce variazioni
  di aliquota a metà anno.
- `contributi_versati_anno_precedente` è un valore inserito a mano
  dall'utente (principio di cassa), non derivato automaticamente da altre
  transazioni.
- Le aliquote e il minimale sono responsabilità dell'utente: l'app non
  conosce le regole della cassa specifica, fa solo i calcoli sui numeri
  forniti.
