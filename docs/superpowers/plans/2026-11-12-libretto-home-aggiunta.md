# Il Libretto: colori, Home, aggiunta veloce, riepilogo e notifiche (piano B1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** dare all'app il nuovo mondo visivo "Il Libretto". La prima superficie nel nuovo mondo è la Home con l'aggiunta veloce, il riepilogo "Rimettiamoci in pari" e l'iscrizione alle notifiche. È il primo pezzo del piano B.

**Architecture:**
- **Token:** nuovi valori in `src/app/globals.css`. Le classi esistenti (`brand`, `brand-dark`, `brand-tint`, `brand-foreground`) cambiano valore, così tutta l'app passa al blu senza toccare ogni file.
- **Calcoli e letture:** la Home usa i calcoli puri del piano A (`src/lib/calculations/supporto/`) e un nuovo assemblatore puro `src/lib/calculations/supporto/home.ts`.
- **Codice:** i componenti restano in `src/app/`. La costruzione è guidata dal codice (operate), senza immagini di riferimento.

**Tech Stack:** Next.js 16.3.3, React 19, Tailwind 4, `next/font/google`, vitest + Testing Library.

**Spec:**
- `docs/superpowers/specs/2026-11-11-app-di-supporto-design.md`, pezzi 1, 2 e 4, compresa la sezione "Precisazioni".
- Contratto di direzione: `.impeccable/surfaces/src-app-page-tsx.md`.
- Schizzo scelto: `.impeccable/mocks/decision/model-pick.html`.

## Global Constraints

- Prima di usare `next/font`, Server Actions o service worker, leggere `node_modules/next/dist/docs/`.
- **Mondo "Il Libretto":**
  - copertina blu `#14306b`, pagina `#ffffff`, fondo `#eef2f8`, righe sottili `#e3e8f1`, inchiostro `#14213d`;
  - testo secondario `#4d5a73`, almeno 4,5:1 sul bianco;
  - rosso timbro `#c8102e` riservato **solo** al timbro "REGISTRATO";
  - colore piatto: niente gradienti, niente ombre colorate o luminose, solo l'ombra neutra delle card;
  - cifre grandi in Source Serif 4 (600/700), tutto il resto in Work Sans (400/500/600);
  - importi sempre `tabular-nums lining-nums`, allineati a destra in colonna.
- **Contrasto AA:** 4,5:1 per il testo normale, 3:1 per il testo grande. Il test del Task 1 lo controlla sulle coppie di token.
- **Mai il contratto di direzione nel codice:** né commenti, né JSX, né metadati. Va tolto anche quello vecchio da `layout.tsx`.
- **Testi:** italiano semplice, nessuna colpa. La guardia sulle parole vietate (`tests/helpers/paroleVietate.ts`, `tests/casaTesti.test.ts`) deve passare; aggiungere `src/app/altro` e `src/app/in-pari` alle sue cartelle.
- **Bersagli di tocco:** almeno 44×44 px per pulsanti e icone toccabili.
- **File:** UTF-8 con fine riga LF. Controllare con `file` prima di ogni commit.
- **Commit e push:** diretti su master a ogni task. Mai committare `.impeccable/hook.cache.json`.
- **Agenti:** haiku per i task piccoli, sonnet per soldi, sicurezza e i task con più file, opus solo per la revisione finale. Ogni prompt chiede di seguire `/caveman:caveman`.

## Review Focus

1. **Utente nuovo senza movimenti:** la Home mostra il disponibile, una frase per il registro vuoto ("Il libretto è vuoto: la prima spesa che segni compare qui."), nessun andamento (`solito` null) e il consiglio di benvenuto (Task 3, Task 4).
2. **Aggiunta con il solo importo:** si salva senza descrizione e senza conto (contanti, nessun conto). Il disponibile resta invariato e la riga compare nel registro con il timbro (Task 5).
3. **iPhone in Safari, app non installata:** la scheda delle notifiche spiega come aggiungerla alla schermata Home e non chiede il permesso (Task 6).
4. **Riepilogo con zero giorni da recuperare** (`periodoDaRecuperare` null): la pagina `/in-pari` dice "Sei in pari" e torna alla Home, senza moduli (Task 7).
5. **Modalità scura:** il fondo resta leggibile e i token scuri rispettano AA. Le coppie scure sono nel test del Task 1.

---

### Task 1: token, caratteri e metadati

**Files:**
- Modify: `src/app/globals.css`: valori di `:root` e del blocco scuro; nuovi token `--page`, `--rule`, `--ink-2`, `--stamp`; `--shadow-hero` e `--shadow-fab` neutre; `tabular-nums` solo su `.num`, non più su `body`.
- Modify: `src/app/layout.tsx`: `next/font/google` con `Source_Serif_4` (variabile `--font-serif`) e `Work_Sans` (`--font-sans`); `themeColor: '#14306b'`; via il commento con il vecchio contratto.
- Modify: `public/manifest.json` (`theme_color` `#14306b`, `background_color` `#eef2f8`).
- Create: `tests/tokens.test.ts`.

**Interfaces:**
- Produces:
  - le classi Tailwind `bg-page`, `border-rule`, `text-ink-2`, `text-stamp` e `font-serif`;
  - la classe `num`, che applica `font-variant-numeric: tabular-nums lining-nums`.

**Valori:**
- Chiaro: `--background #eef2f8`, `--foreground #14213d`, `--surface #ffffff`, `--surface-muted #e4eaf5`, `--muted #4d5a73`, `--brand #14306b`, `--brand-dark #0e2350`, `--brand-tint #e4eaf5`, `--brand-foreground #ffffff`, `--rule #e3e8f1`, `--stamp #c8102e`.
- Scuro: `--background #0c1424`, `--surface #131d33`, `--surface-muted #1a2640`, `--foreground #e8edf6`, `--muted #a3b0c6`, `--brand-tint #1a2a4d`, `--rule #24314d`.
- In scuro `--brand` resta `#14306b` per le fasce e i pulsanti. Per il testo su fondo scuro si usa `--brand-dark` scuro `#9fb6e6`: è il "link" leggibile.

- [ ] **Step 1: test che fallisce.** `tests/tokens.test.ts` legge `globals.css`, estrae i valori esadecimali di `:root` e del blocco scuro, e calcola il contrasto con la formula WCAG. Coppie che devono passare (4,5 se non diversamente indicato):

```ts
const CHIARO = [['foreground','background'],['foreground','surface'],['muted','surface'],['muted','background'],['brand-foreground','brand'],['brand','surface'],['stamp','surface',3]];
const SCURO = [['foreground','background'],['foreground','surface'],['muted','surface'],['brand-dark','surface']];
```

  Aggiungere anche un test: `body` non contiene `tabular-nums`, che deve stare solo su `.num`.
- [ ] **Step 2:** `npx vitest run tests/tokens.test.ts`. Atteso: FAIL.
- [ ] **Step 3:** implementare come da Files e Valori. Controllare con una ricerca che il resto dell'app usi solo i nomi dei token e non esadecimali del verde (`0f9d6b`, `0b7a53`): sostituirli con i token.
- [ ] **Step 4:** `npm test`, `npx tsc --noEmit`, `npm run build`. Atteso: tutto verde.
- [ ] **Step 5:** commit e push (`feat: i colori e i caratteri del Libretto`).

### Task 2: barra in basso con 4 schede e pagina Altro

**Files:**
- Modify: `src/app/NavBar.tsx`. Schede: Home `/`, Storico `/history`, Casa `/casa`, Altro `/altro`. Barra piatta a tutta larghezza su `bg-surface` con bordo superiore `border-rule`. Etichette da 12px. Ogni voce alta almeno 44px. Scheda attiva in `text-brand`, in grassetto. "Altro" è attiva anche su `/goals`, `/accounts`, `/categories` e `/piva`.
- Create: `src/app/altro/page.tsx`: elenco a righe (come le righe del libretto) verso Obiettivi, Conti, Categorie, P.IVA e "Notifiche", che porta alla sezione notifiche del Task 6 (`/altro#notifiche`).
- Test: `tests/NavBar.test.tsx` (aggiornare), `tests/AltroPage.test.tsx`.

- [ ] **Step 1: test.**
  - le 4 etichette;
  - `aria-current="page"` sulla scheda giusta per `/goals` (Altro) e per `/casa/quota` (Casa);
  - la pagina Altro ha 5 link con gli `href` indicati.
- [ ] **Step 2:** eseguire. Atteso: FAIL.
- [ ] **Step 3:** implementare.
- [ ] **Step 4:** test e `tsc`. Atteso: PASS.
- [ ] **Step 5:** commit e push (`feat: quattro schede e la pagina Altro`).

### Task 3: dati della Home

**Files:**
- Create: `src/lib/calculations/supporto/home.ts`
- Modify: `src/lib/loadHomeData.ts`
- Test: `tests/calculations/supporto/home.test.ts`, `tests/loadHomeData.test.ts` (aggiungere casi)

**Interfaces:**
- Consumes:
  - `calcolaAndamento` (`andamento.ts`);
  - `scegliConsiglio` e `obiettiviCorti` (`consiglio.ts`);
  - `periodoDaRecuperare` (`notifiche.ts`);
  - `computeReminders` e `statoPromemoria` (`casa/promemoria.ts`);
  - `getTransactions(supabase, PERSONALE, { da })` (`data/transactions.ts`).
- Produces:

```ts
export interface RigaLibretto { id: string; data: string; descrizione: string; importo: number; tipo: 'expense'|'income'; stima: boolean; nelMese: number }
export interface Prossimo { testo: string; href: string; tipo: 'in_pari'|'casa' }
export function righeLibretto(transazioni: Transaction[], oggi: string, quante?: number): RigaLibretto[]; // default 4
export function prossimaCosa(input: { inPari: { dal: string; al: string } | null; promemoriaCasa: { testo: string; href?: string }[] }): Prossimo | null;
// HomeData aggiunge: righe: RigaLibretto[]; andamento: Andamento; consiglio: Consiglio; prossimo: Prossimo | null; notificheAttive: boolean | null
```

**Regole:**
- **`nelMese`:** è lo speso cumulato del mese **dopo** quella riga, contando solo le spese (`expense`) con data nel mese di oggi. Per le righe di mesi passati vale lo speso cumulato del loro mese. Le entrate mostrano lo stesso valore della riga precedente. La colonna si chiama "Nel mese" e **non** è un saldo: un saldo all'indietro inventerebbe numeri, perché i conti si correggono a mano.
- **Ordine delle righe:** `data` decrescente, poi `createdAt` decrescente.
- **Lettura:** una sola, `getTransactions(supabase, PERSONALE, { da: primo giorno del mese di 3 mesi fa })`, che alimenta righe, andamento e `spesoStime`. Le date sono in Europe/Rome.
- **`prossimaCosa`:** vince "in pari" ("Rimettiti in pari: dal {giorno} non hai segnato spese", href `/in-pari`). Altrimenti il primo promemoria di casa, con il suo href o `/casa`. Altrimenti `null`.
- **"In pari":** si calcola da `periodoDaRecuperare(ultimaCreazione, nessunaSpesaFinoAl, oggi)`. `ultimaCreazione` è il giorno Europe/Rome del `createdAt` più recente. `nessunaSpesaFinoAl` e `notificheAttive` si leggono da `promemoria_utente` con una nuova `leggiPromemoriaUtente(supabase): Promise<{ notificheAttive: boolean|null; nessunaSpesaFinoAl: string|null }>` in `src/lib/data/notifiche.ts`. Se non c'è nessuna riga: `{ notificheAttive: null, nessunaSpesaFinoAl: null }`.

- [ ] **Step 1: test.**
  - `righeLibretto`: 4 righe più recenti; `nelMese` cumulato giusto con due spese e un'entrata nello stesso giorno; riga del mese scorso con il cumulato del suo mese.
  - `prossimaCosa`: precedenza di "in pari"; ripiego sulla casa; `null`.
  - `loadHomeData`: una sola lettura delle transazioni; utente senza movimenti → `righe` vuote, `andamento.solito` null.
- [ ] **Step 2:** eseguire. Atteso: FAIL.
- [ ] **Steps 3-4:** implementare, poi `npm test` e `tsc`. Atteso: PASS.
- [ ] **Step 5:** commit e push (`feat: i dati del libretto per la Home`).

### Task 4: la Home nel Libretto

**Files:**
- Modify: `src/app/HomeDashboard.tsx` (ed eventuali sotto-componenti nuovi in `src/app/home/`), `src/app/page.tsx`
- Test: `tests/HomeDashboard.test.tsx` (aggiornare)

**Interfaces:**
- Consumes: `HomeData` (Task 3); i token del Task 1.

**Composizione**, dall'alto, fedele allo schizzo `model-pick.html`:
1. **Fascia copertina** `bg-brand`, alta circa 96px dentro la safe-area: a sinistra "Il mio libretto" in `font-serif`, a destra il mese ("novembre 2026").
2. **Pagina bianca:**
   - etichetta "Disponibile libero";
   - la cifra in `font-serif` 56-60px con i centesimi più piccoli;
   - la riga "Puoi spendere **X € al giorno** fino al {data}";
   - sotto, la frase che spiega (problema P1 della critica): "Hai {saldo conti} € sui conti, {riservato} € sono già messi da parte".
   - Il pulsante testuale "Come si calcola?" (almeno 44px) apre la lista esistente, raggruppata in tre gruppi con intestazione: "Soldi tuoi" (conti), "Già messi da parte" (obiettivi), "Casa" (quota, debiti e crediti), ciascuno col suo subtotale.
3. **Andamento:**
   - con `solito` presente: "Questo mese hai speso X €, di solito a quest'ora Y €", più una piccola linea a 2 tracce dalla `curva` (SVG semplice, niente librerie);
   - con `solito` null: "Dal prossimo mese ti mostro come stai andando rispetto al solito."
4. **Registro** (card `bg-surface`):
   - intestazione a colonne Data / Movimento / Importo / Nel mese, con riga spessa `border-brand` sotto;
   - 4 righe; importi in `num` a destra; le spese con "−", le entrate con "+" in `text-foreground` (niente verde);
   - le righe stimate mostrano "stima" in piccolo;
   - link "Tutti i movimenti" a `/history`;
   - registro vuoto: la frase del Review Focus 1.
5. **Prossimo:** card `bg-surface-muted` con l'etichetta "Prossimo" e `prossimo.testo`, tutta toccabile verso `href`. Se `null` la card non c'è.
6. **Consiglio:** card con l'etichetta "Un consiglio" e `consiglio.testo`. Il pulsante "Perché?" apre `consiglio.perche` sul posto.
7. **Pulsante +:** 60px, `bg-brand`, in basso a destra sopra la barra. Ombra neutra.

**Timbro** (il momento caratteristico):
- Dopo un salvataggio, il foglio scrive in `sessionStorage` la chiave `libretto:registrato`, con valore l'id della transazione appena creata.
- La Home, al montaggio, se trova quell'id fra le righe:
  - fa entrare la riga dall'alto (translateY da -8px a 0, 220ms);
  - preme sopra la riga un timbro tondo `text-stamp` con bordo, scritto "REGISTRATO" più la data (scala da 1,15 a 1, opacità da 0 a 0,9, 260ms, rotazione -10°);
  - legge `aria-live="polite"`: "Registrato. Disponibile ora X €";
  - cancella la chiave.
- Con `prefers-reduced-motion` niente movimento: timbro e annuncio compaiono subito.

- [ ] **Step 1: test.**
  - le 7 parti con dati pieni;
  - il registro vuoto;
  - `solito` null;
  - "Come si calcola?" mostra i 3 gruppi con i subtotali;
  - con `sessionStorage['libretto:registrato']` uguale all'id di una riga, il timbro e l'annuncio compaiono e la chiave viene cancellata;
  - nessun colore verde nei className.
- [ ] **Step 2:** eseguire. Atteso: FAIL.
- [ ] **Steps 3-4:** implementare, poi `npm test`, `tsc` e `npm run build`. Atteso: PASS.
- [ ] **Step 5:** commit e push (`feat: la Home diventa il libretto`).

### Task 5: aggiunta veloce

**Files:**
- Modify: `src/app/add/AddTransactionForm.tsx`, `src/app/add/AddTransactionSheet.tsx`
- Modify: `src/lib/data/transactions.ts`: `createTransaction` restituisce già la `Transaction`. Il foglio passa l'id a `onSaved(id)`.
- Test: `tests/AddTransactionForm.test.tsx`, `tests/AddTransactionSheet.test.tsx` (aggiornare)

**Interfaces:**
- Consumes: `indovinaCategoria(descrizione, storico, oggi)` (piano A). Lo storico è l'elenco di transazioni già letto per la Home (Task 3), passato come prop `storico`.
- Produces: `onSaved(idCreato: string)`.

**Regole:**
- **Importo:** il campo ha `autoFocus` e `inputMode="decimal"`, in `font-serif` grande. È **l'unico obbligatorio**: con un importo valido "Salva" è attivo.
- **Riga di riepilogo** sotto l'importo, un bottone per pezzo, ognuno almeno 44px: `Spesa · Personale · {conto o "Contanti"} · {categoria o "Senza categoria"}`. Toccare un pezzo apre solo la scelta di quel pezzo.
- **Valori di partenza:**
  - spazio: ultimo usato (`aggiungiModo`, già esistente);
  - conto: ultimo usato per quello spazio (`localStorage['aggiungi:conto:{personale|casa}']`); se non esiste più, nessun conto;
  - categoria: `indovinaCategoria`, aggiornata quando cambia la descrizione e finché l'utente non la sceglie a mano;
  - in Casa: "pagata da te".
- **Descrizione e obiettivo:** facoltativi, dietro "Aggiungi una nota". La descrizione vuota si salva come `''`.
- **Dopo Salva:** `sessionStorage['libretto:registrato'] = id`, `onSaved(id)`, chiusura. Niente più "Salvata ✓" dentro il foglio: la conferma è il timbro in Home.
- **Errore:** il modulo **non si svuota** e mostra il messaggio.

- [ ] **Step 1: test.**
  - il fuoco parte sull'importo;
  - si salva con il solo importo (descrizione `''`, categoria indovinata);
  - riapro il foglio e il conto è l'ultimo usato;
  - il riepilogo cambia toccando un pezzo;
  - dopo un errore i campi restano;
  - `sessionStorage` riceve l'id.
- [ ] **Step 2:** eseguire. Atteso: FAIL.
- [ ] **Steps 3-4:** implementare, poi `npm test` e `tsc`. Atteso: PASS.
- [ ] **Step 5:** commit e push (`feat: aggiunta veloce col solo importo`).

### Task 6: iscrizione alle notifiche

**Files:**
- Create: `src/app/home/SchedaNotifiche.tsx` (in Home) e `src/app/altro/Notifiche.tsx` (in Altro, `id="notifiche"`)
- Create: `src/lib/iscriviNotifiche.ts` (lato client)
- Test: `tests/SchedaNotifiche.test.tsx`, `tests/iscriviNotifiche.test.ts`

**Interfaces:**
- Consumes:
  - `salvaIscrizione` e `rispondiNotifiche` (`data/notifiche.ts`);
  - la chiave pubblica, passata dal server come prop (`chiaviVapid()?.pubblica`);
  - `public/sw.js`.
- Produces: `iscriviNotifiche(chiavePubblica: string): Promise<'attive'|'negate'|'non_supportate'>`. Registra `/sw.js`, chiama `Notification.requestPermission()` **dentro il gestore del tocco**, crea l'iscrizione con `pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })`, chiama `salvaIscrizione` e poi `rispondiNotifiche(true)`. Su rifiuto chiama `rispondiNotifiche(false)`.

**Quando compare la scheda in Home:** solo se `notificheAttive === null`.
- Con `matchMedia('(display-mode: standalone)')` vero, o `navigator.standalone`: "Vuoi che ti avvisi se resti indietro con le spese? Al massimo una volta ogni tre giorni, mai di notte." con i pulsanti "Sì, avvisami" e "No, grazie".
- Su iPhone in Safari, app non installata: "Per ricevere i promemoria aggiungi l'app alla schermata Home: tocca Condividi, poi 'Aggiungi alla schermata Home'." Nessuna richiesta di permesso.
- In Altro la stessa logica, sempre visibile, con lo stato attuale e la possibilità di riattivare.

- [ ] **Step 1: test.**
  - la scheda è nascosta con `notificheAttive` true o false;
  - testo con l'app installata e testo in Safari;
  - "Sì" chiama nell'ordine permesso, iscrizione, `salvaIscrizione`, `rispondiNotifiche(true)`;
  - un rifiuto chiama `rispondiNotifiche(false)`.
- [ ] **Step 2:** eseguire. Atteso: FAIL.
- [ ] **Steps 3-4:** implementare, poi i test e `tsc`. Atteso: PASS.
- [ ] **Step 5:** commit e push (`feat: iscrizione ai promemoria`). Revisione con sonnet.

### Task 7: "Rimettiamoci in pari"

**Files:**
- Create: `src/app/in-pari/page.tsx` (server: login, dati) e `src/app/in-pari/InPari.tsx` (client)
- Create: `src/lib/calculations/supporto/inPari.ts`
- Test: `tests/calculations/supporto/inPari.test.ts`, `tests/InPari.test.tsx`

**Interfaces:**
- Consumes:
  - `periodoDaRecuperare`;
  - `createTransaction(..., { stima: true })`;
  - `adjustAccountBalance`;
  - `segnaNessunaSpesa`;
  - `calcolaAndamento` e `scegliConsiglio`;
  - per il ramo Casa, gli stessi dati di `AddTransactionSheet`.
- Produces:

```ts
export interface RigaStima { importo: number; accountId: string | null; casa: boolean }
export function righeDaRiepilogo(input: { carta: number | null; contanti: number | null; spazio: 'personale'|'casa'; contoCarta: string | null; contoContanti: string | null }): RigaStima[];
```

  Restituisce al massimo 2 righe; un importo nullo o ≤ 0 non produce la riga.

**Pagina:**
- **Titolo:** "Rimettiamoci in pari". Sotto: "Dal {dal} al {al} non hai segnato niente." Se il periodo è `null`: "Sei in pari." con un link alla Home.
- **"Con la carta":** campo per il totale.
- **"In contanti, a occhio":** le scelte 20 €, 50 € e "altro", che apre un campo.
- **Spazio:** "Tue" o "Di casa", da `aggiungiModo`.
- **Pulsanti:** "Fatto" e "Non ho speso niente".
- **Conti:**
  - per la carta, l'ultimo conto usato che non abbia "contanti" nel nome;
  - per i contanti, un conto con "contanti" nel nome, se c'è, altrimenti nessuno;
  - in Casa, la spesa è "pagata da te" con lo stesso conto personale, come le spese anticipate di oggi in `AddTransactionSheet.salvaCasa`. Riusare quella funzione, estratta in un modulo comune: niente logica duplicata.
- **Salvataggio:** ogni riga è una spesa di oggi, `stima: true`, senza categoria, descrizione `''`. Il saldo del conto si aggiorna come per ogni spesa.
- **"Non ho speso niente":** `segnaNessunaSpesa(oggi)`.
- **Dopo il salvataggio:** "Fatto: sei in pari." poi l'andamento aggiornato e il consiglio (gli stessi componenti del Task 4), e un link alla Home.

- [ ] **Step 1: test.**
  - `righeDaRiepilogo`: solo carta; solo contanti; tutti e due; zero o nullo; scelta dei conti;
  - la pagina con periodo `null`;
  - "Fatto" con carta 80 e contanti 20 crea 2 transazioni stimate e aggiorna 1 conto;
  - "Non ho speso niente" chiama `segnaNessunaSpesa`;
  - in Casa la spesa è anticipata da te.
- [ ] **Step 2:** eseguire. Atteso: FAIL.
- [ ] **Steps 3-4:** implementare, poi `npm test`, `tsc` e `npm run build`. Atteso: PASS.
- [ ] **Step 5:** commit e push (`feat: rimettiamoci in pari`). Revisione con sonnet, perché tocca i soldi.

### Task 8: anteprima per le foto, revisione finale e DESIGN.md

**Files:**
- Create: `src/app/anteprima/page.tsx`, disponibile **solo in sviluppo**: con `process.env.NODE_ENV !== 'development'` chiama `notFound()`. Mostra la Home e la pagina `/in-pari` con dati di prova etichettati "dati di prova", senza login né Supabase. Il proxy la esclude dal login solo in sviluppo, con un test.
- Create: `.claude/launch.json` (`npm run dev`, porta 3000), se manca.

- [ ] **Step 1:**
  - test: in produzione `/anteprima` restituisce 404;
  - test del proxy;
  - commit.
- [ ] **Step 2:** avviare l'anteprima e fotografare Home, foglio aperto e `/in-pari` a 390 px, in chiaro e in scuro, nella cartella `.impeccable/review/`: `mobile.png`, `mobile-dark.png`, `foglio.png`, `in-pari.png`.
- [ ] **Step 3:** lanciare il controllo automatico di impeccable sui file cambiati e correggere i problemi meccanici.
- [ ] **Step 4:** far fare la revisione finale a `impeccable-finish-reviewer`, con il contratto, lo schizzo scelto come riferimento e le foto. Poi un giro di correzioni, se servono.
- [ ] **Step 5:** far scrivere `DESIGN.md` e `.impeccable/design.json` a `impeccable-documenter`, a partire da quello che è stato costruito.
- [ ] **Step 6:** revisione opus di tutto il piano, poi commit e push, e aggiornare la ROADMAP.
