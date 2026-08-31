# Obiettivi ricorrenti generalizzati (abbonamenti e bollette variabili) — Design

Data: 2026-08-31
Stato: approvato in brainstorming, pronto per il piano di implementazione

## 1. Obiettivo e contesto

Il sistema di `budget_goals` (Task 6/11/15 del piano MVP) supporta già obiettivi ricorrenti,
ma solo con frequenza annuale (`frequenza_anni`) — pensato per casi come bollo auto o
revisione. Non copre due casi reali dell'uso quotidiano:

1. **Abbonamenti fissi ricorrenti** (es. Tidal, mensile, importo fisso) — la frequenza serve
   più fine del solo "anni" (mensile, trimestrale, ecc.).
2. **Bollette a importo variabile** (es. bolletta luce) — l'utente vuole un suggerimento di
   quanto accantonare basato sulla media delle bollette passate registrate in quella
   categoria, più un margine di sicurezza configurabile (es. +10%), invece di dover indovinare
   un importo fisso.

Questo spec generalizza il modello esistente per coprire entrambi i casi, senza introdurre un
nuovo tipo di entità: restano `budget_goals`, solo con più opzioni alla creazione.

**Fuori scope per questo spec:**
- La gestione P.IVA (fatturato, proiezione tasse, ENPAP, fondi bloccati per le tasse) è un
  sottosistema indipendente, brainstormato separatamente.
- Il ricalcolo automatico dell'importo suggerito ad ogni ciclo di rinnovo — l'importo, una
  volta suggerito e confermato, resta fisso come un obiettivo normale. Per aggiornarlo a un
  nuovo ciclo, l'utente chiude l'obiettivo e ne crea uno nuovo (nessuna funzione di modifica
  di un obiettivo esistente è prevista qui — è un gap noto e già segnalato, non risolto ora).

## 2. Modello dati

### Modifica a `budget_goals`

`frequenza_anni` (numeric) viene sostituita da **`frequenza_mesi`** (numeric): 1 = mensile,
3 = trimestrale, 6 = semestrale, 12 = annuale, o un valore libero per casi particolari (es. 2).
Dato che l'app non ha ancora obiettivi ricorrenti reali salvati in produzione, la migrazione
sostituisce direttamente la colonna (drop + add), senza bisogno di convertire dati esistenti.

```sql
alter table public.budget_goals drop column frequenza_anni;
alter table public.budget_goals add column frequenza_mesi numeric;
```

`categoria_id` (uuid, nullable, già esistente nello schema) viene finalmente collegato dal
form di creazione — non richiede modifiche allo schema, solo alla UI e alla query di
inserimento (che oggi passa sempre `categoriaId: null`).

Nessun nuovo campo persistente per "margine %" o "numero di bollette considerate": sono
input usati solo al momento del calcolo del suggerimento, mai salvati sull'obiettivo.
L'unico output persistito è l'`importo_target` risultante, identico a qualsiasi altro
obiettivo.

## 3. Logica di calcolo

### `nextOccurrence` e `computeAccantonatoFinora` (src/lib/calculations/accantonato.ts)

Stessa logica esistente (finestra di accantonamento, clamp a `[0, totalMonths]`), cambia solo
l'unità: `addYears(data, frequenzaAnni)` diventa `addMonths(data, frequenzaMesi)`. Il tipo
`GoalForCalc.frequenzaAnni` diventa `frequenzaMesi`. La guardia esistente contro
`frequenzaAnni <= 0` (che preveniva un loop infinito in `nextOccurrence`) si applica
identica a `frequenzaMesi <= 0`.

### Nuova funzione: `suggestImportoFromHistory`

Funzione pura, nessuna dipendenza da Supabase:

```ts
export function suggestImportoFromHistory(importiPassati: number[], marginePercent: number): number {
  if (importiPassati.length === 0) {
    throw new Error('Nessun importo storico su cui calcolare una media');
  }
  const media = importiPassati.reduce((sum, v) => sum + v, 0) / importiPassati.length;
  return media * (1 + marginePercent / 100);
}
```

Gli `importiPassati` vengono recuperati con una nuova funzione nel layer dati
(`src/lib/data/transactions.ts`): `getRecentTransactionAmounts(supabase, categoriaId, limite)`
— ritorna gli importi (numeri) delle ultime `limite` transazioni di tipo `expense` in quella
categoria, ordinate per data decrescente.

## 4. Interfaccia

### Form creazione obiettivo (`CreateGoalForm.tsx`)

- Nuovo select "Categoria" (opzionale, come per le transazioni: solo categorie di tipo
  `expense` non archiviate).
- Il campo "Ogni quanti anni" (visibile solo se "Ricorrente" è spuntato) diventa un select
  "Frequenza": Mensile / Trimestrale / Semestrale / Annuale / Personalizzato — l'opzione
  "Personalizzato" apre un campo numerico libero per il numero di mesi.
- Se è selezionata una categoria, appare un pulsante **"Suggerisci importo dallo storico"**.
  Al click, apre un pannello inline con:
  - un campo numerico "Quante spese passate considerare" (default 3)
  - un campo numerico "Margine di sicurezza %" (default 10)
  - la lista delle transazioni trovate in quella categoria (le più recenti, fino al numero
    scelto) con i loro importi
  - la media calcolata e l'importo finale suggerito (media × margine)
  - un pulsante "Usa questo importo" che compila il campo "Importo target" col valore
    suggerito (l'utente può poi modificarlo manualmente come qualsiasi altro campo)
- Se la categoria selezionata non ha abbastanza transazioni storiche (zero spese trovate),
  il pannello mostra "Non ci sono ancora abbastanza spese in questa categoria per calcolare
  una media" invece di un suggerimento vuoto o fuorviante.

## 5. Migrazione della logica esistente

Le voci ricorrenti già pensate come annuali (bollo, revisione) continuano a funzionare
identiche: si crea l'obiettivo scegliendo "Annuale" invece di "ogni 1 anno" — stesso
risultato, unità diversa nel form.

## 6. Test

- TDD su `suggestImportoFromHistory` (media semplice, margine applicato, errore su lista
  vuota).
- Aggiornamento dei test esistenti di `accantonato.ts`: ogni riferimento a `frequenzaAnni`/
  `addYears` diventa `frequenzaMesi`/`addMonths` con valori equivalenti (es. il test che oggi
  usa `frequenzaAnni: 1` diventa `frequenzaMesi: 12` per lo stesso comportamento annuale).
- Test per `getRecentTransactionAmounts` (mock Supabase, come gli altri test del data layer).
- Test del form aggiornato: selezione categoria, cambio frequenza tramite preset, comparsa e
  funzionamento del pannello di suggerimento, messaggio corretto quando non ci sono
  abbastanza dati storici.

## 7. Domande aperte

Nessuna: tutte le decisioni sono state confermate in brainstorming. Eventuali estensioni
future (ricalcolo automatico dell'importo ad ogni ciclo, modifica di un obiettivo esistente)
restano segnalate come gap noti, non in scope qui.
