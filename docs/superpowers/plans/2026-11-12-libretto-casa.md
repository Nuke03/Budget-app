# Il Libretto per la Casa: Casa più leggera, vista semplice, Tricount, colori delle categorie (piano B2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** portare la Casa nel mondo "Il Libretto".
- **Chi gestisce** vede una cosa da fare alla volta, con "Dettagli" per il resto.
- **Chi entra ogni tanto** vede solo quota, stato e il pulsante per aggiungere.
- **Il saldo da Tricount** si inserisce da una schermata.
- **I colori delle categorie** tornano visibili nel libretto.

Restano al piano B3: le eliminazioni con annullamento, lo stile delle pagine non di Casa (Storico, obiettivi, conti, P.IVA) e l'icona.

**Architecture:**
- I calcoli nuovi sono puri, in `src/lib/calculations/supporto/casaHome.ts`, sui dati che `loadCasaData` legge già: nessuna lettura nuova.
- Le schermate seguono `DESIGN.md`: `CoverHeader`, card con righe sottili, `.num`, `font-serif` per le cifre grandi.
- La pagina `/casa` decide fra la vista di chi gestisce e quella semplice con `chiGestisce`.

**Tech Stack:** Next.js 16.3.3, React 19, Tailwind 4, Supabase, vitest.

**Spec:**
- `docs/superpowers/specs/2026-11-11-app-di-supporto-design.md`, pezzo 3 e "Precisazioni";
- `DESIGN.md`;
- il contratto di direzione `.impeccable/surfaces/src-app-page-tsx.md`, che vale come mondo di riferimento.

## Global Constraints

- **Mondo visivo:** seguire `DESIGN.md`.
  - Solo token, mai valori esadecimali nei componenti.
  - Niente etichette maiuscole spaziate sopra le card. Le intestazioni delle colonne di una tabella vanno bene.
  - Righe sottili `border-rule`, niente ombre.
  - Il rosso del timbro solo per "REGISTRATO".
  - Bersagli di tocco di almeno 44 px.
  - Contrasto AA in chiaro e in scuro.
- **Testi:** italiano semplice, senza colpa. La guardia sulle parole vietate deve passare.
- **Soldi:** i calcoli esistenti (`computeDisponibileCasa`, `computeReminders`, `debitiMembri`, `creditiPerMembro`, `statoVociDaParte`) non si riscrivono, si usano. Nessuna lettura nuova se `loadCasaData` ha già il dato. Le date in Europe/Rome.
- **Nessuna nuova migrazione:** `record_saldo_iniziale` esiste già nella 0009.
- **Lavoro:** commit e push su master a ogni task. Mai `.impeccable/hook.cache.json`.
- **Agenti:** haiku per le cose piccole, sonnet per soldi e componenti con più file, opus per la revisione finale. Ogni prompt chiede di seguire `/caveman:caveman`.
- **Server di sviluppo per le foto:** la configurazione `dev-webpack`, perché con Turbopack in sviluppo `next/font` non si carica.

## Review Focus

1. **Casa con un solo membro** (la compagna non è ancora entrata): la vista di chi gestisce funziona, la vista semplice non serve, la voce Tricount non compare (Task 2, 4, 5).
2. **Nessun piano della quota:** "Da fare" propone "Calcolate la quota", la vista semplice dice "La quota non è ancora stata calcolata", non mostra 0 € e non va in errore (Task 2, 4).
3. **Spesa di casa in contanti senza conto:** compare fra le ultime spese con "pagata da te", non come spesa del conto comune (Task 3).
4. **Saldo da Tricount già inserito:** la voce sparisce, oppure dice "Già inserito: X € da Lei a Fabio". Un secondo invio è rifiutato dal database (indice unico) e l'app lo spiega (Task 5).
5. **Modalità scura** su tutte le pagine di Casa, con le foto (Task 7).

---

### Task 1: i colori delle categorie nel libretto

**Files:**
- Modify: `src/lib/calculations/supporto/home.ts`: `RigaLibretto` più `colore: string | null`, preso dalla categoria della riga.
- Modify: `src/app/home/Registro.tsx`: un pallino di 10 px del colore della categoria prima del nome del movimento. Per le righe senza categoria, nessun pallino, ma resta lo spazio per allineare.
- Modify: `src/app/add/AddTransactionForm.tsx`: il pezzo "categoria" della riga di riepilogo mostra lo stesso pallino, e la scelta della categoria ha chip colorati con il testo scelto da `testoSu`, come oggi nelle altre liste.
- Test: `tests/calculations/supporto/home.test.ts`, `tests/HomeDashboard.test.tsx`, `tests/AddTransactionForm.test.tsx`

**Interfaces:**
- Produces: `RigaLibretto.colore`; il componente `PallinoCategoria({ colore }: { colore: string | null })` in `src/app/home/PallinoCategoria.tsx`, riusato dal Task 3.

**Scelta di Claude** (Fabio ha chiesto "più colori tra le categorie"): la tavolozza ha già 16 colori, quindi il problema è che il libretto è tutto blu e le categorie non si vedono. Si portano i colori nelle righe e nel foglio. Fabio può correggere questa lettura.

- [ ] **Step 1: test.**
  - `righeLibretto` mette in `colore` il colore della categoria, `null` se la riga non ha categoria;
  - il Registro mostra un pallino con quel colore come `backgroundColor` (attributo `data-colore` per il test);
  - il riepilogo del foglio mostra il pallino della categoria indovinata.
- [ ] **Step 2:** eseguire. Atteso: FAIL.
- [ ] **Steps 3-4:** implementare, poi i test e `tsc`. Atteso: PASS.
- [ ] **Step 5:** commit e push (`feat: i colori delle categorie nel libretto`).

### Task 2: i dati della Casa nuova

**Files:**
- Create: `src/lib/calculations/supporto/casaHome.ts`
- Modify: `src/app/casa/page.tsx` (assemblare con i dati di `loadCasaData`)
- Test: `tests/calculations/supporto/casaHome.test.ts`

**Interfaces:**
- Consumes:
  - `CasaData` (`src/lib/loadCasaData.ts`);
  - `chiGestisce` (`supporto/gestore.ts`);
  - `computeReminders` e `statoPromemoria` (`casa/promemoria.ts`);
  - `statoVociDaParte` (`casa/fondi.ts`);
  - `pianoInVigore` (`casa/versamenti.ts`);
  - `debitiMembri` e `creditiPerMembro`.
- Produces:

```ts
export type DaFareCasa =
  | { tipo: 'promemoria'; testo: string; href: string }
  | { tipo: 'da_parte'; testo: string; importo: number; voci: { nome: string; importo: number }[] }
  | { tipo: 'quota'; testo: string; href: '/casa/quota' };
export interface StatoPari { tipo: 'pari' } | { tipo: 'devi'; importo: number; a: string } | { tipo: 'ti_deve'; importo: number; da: string }
export interface CasaHomeDati {
  gestisce: boolean;
  disponibile: number;
  spesoMese: number; previstoMese: number | null; // spese di casa del mese vs voci mensili del piano in vigore
  daFare: DaFareCasa | null;
  ultime: { id: string; data: string; descrizione: string; importo: number; colore: string | null; chi: string }[]; // 3
  vistaSemplice: { quota: number | null; entroGiorno: number | null; versato: number; stato: StatoPari } ;
}
export function casaHomeDati(dati: CasaData, meUserId: string, oggi: string): CasaHomeDati;
```

**Regole:**
- **`daFare`:** vince il primo promemoria di `computeReminders`. Se non ce ne sono, l'accantonamento del mese, se `statoVociDaParte` ha voci `da_mettere` (testo "Metti da parte {totale} € per {elenco voci}"). Se non c'è un piano in vigore, `{ tipo: 'quota', testo: 'Calcolate la quota: servono 3 minuti.' }`. Altrimenti `null`.
- **`ultime`:** le 3 spese di casa più recenti.
  - `chi` vale "tu" se `pagataDaUserId` sono io, il nome dell'altro se è lui, "conto comune" se `pagataDaUserId` è vuoto e il conto è di casa.
  - `colore` è il colore della categoria di casa.
- **`vistaSemplice.stato`:** si calcola dai debiti tra i membri (`debitiMembri`) e dai crediti per membro, per me rispetto all'altro. `pari` se il netto in valore assoluto è sotto 0,01.
- **`spesoMese` e `previstoMese`:** `spesoMese` sono le spese di casa con data nel mese corrente. `previstoMese` è la somma di `importoMensile` delle voci del piano in vigore, oppure `null`.

- [ ] **Step 1: test.**
  - gestore: il creatore attivo;
  - un promemoria vince sull'accantonamento;
  - senza promemoria vale l'accantonamento con le voci;
  - senza piano vale `quota`;
  - `ultime` con "tu", nome dell'altro e "conto comune";
  - stato `pari`, `devi` e `ti_deve`;
  - casa con un solo membro (Review Focus 1);
  - nessun piano (Review Focus 2).
- [ ] **Steps 2-4:** eseguire, implementare, eseguire. Atteso prima FAIL, poi PASS.
- [ ] **Step 5:** commit e push (`feat: i dati della Casa a libretto`).

### Task 3: la Casa di chi gestisce, nel Libretto

**Files:**
- Modify: `src/app/casa/CasaHome.tsx` (riscrivere la parte visibile), `src/app/casa/page.tsx`
- Create: `src/app/casa/dettagli/page.tsx`, che raccoglie i blocchi che oggi sono impilati sulla pagina Casa: conto comune e `ContoComuneForm`, `PannelliVersamenti`, chi c'è, la quota (link), Da parte (link), impostazioni (link), `CodiceInvito` se serve.
- Test: `tests/CasaHome.test.tsx`, `tests/CasaPage.test.tsx` (aggiornare), `tests/CasaDettagli.test.tsx`

**Interfaces:**
- Consumes: `CasaHomeDati` (Task 2), `PallinoCategoria` (Task 1), `CoverHeader` (`src/app/home/CoverHeader.tsx`), l'evento `libretto:aggiungi` (già gestito da `CasaFab`).

**Composizione**, dall'alto:
1. `CoverHeader` con titolo "La casa" e il mese.
2. **Pagina bianca:**
   - "Disponibile di casa" con la cifra in `font-serif`;
   - la riga "Spese di casa questo mese: X € su Y € previsti" (senza piano: solo X);
   - "Come si calcola?", con la spiegazione che esiste oggi.
3. **"Da fare":** card unica.
   - Se è `da_parte`: le voci e il pulsante "Fatto", che usa la stessa azione di oggi in `DaParte` (estrarla, non duplicarla).
   - Se è `promemoria` o `quota`: tutta la card è un link.
   - Se `null`: niente card.
4. **Ultime spese:** registro a 3 righe in stile `Registro` (data, pallino e nome, chi, importo) e il link "Tutti i movimenti" a `/casa/movimenti`.
5. **"Dettagli ›":** riga-link verso `/casa/dettagli`.

`StrisciaPromemoriaCasa` e i blocchi impilati escono dalla pagina, che resta senza ombre.

- [ ] **Step 1: test.**
  - le 5 parti;
  - "Fatto" sull'accantonamento chiama l'azione esistente;
  - "Dettagli" porta a `/casa/dettagli`;
  - la pagina dettagli mostra conto comune, versamenti, chi c'è e i link;
  - spesa in contanti senza conto con "tu" (Review Focus 3).
- [ ] **Steps 2-4:** eseguire, implementare, poi `npm test`, `tsc`, `npm run build` e il controllo automatico. Atteso: PASS.
- [ ] **Step 5:** commit e push (`feat: la Casa di chi gestisce diventa un libretto`).

### Task 4: la vista semplice

**Files:**
- Create: `src/app/casa/VistaSemplice.tsx`
- Modify: `src/app/casa/page.tsx`. Se non gestisco e non c'è `?vista=completa`, la pagina mostra `VistaSemplice`. Altrimenti `CasaHome`, con il link "Torna alla vista semplice" per chi non gestisce.
- Test: `tests/VistaSemplice.test.tsx`, `tests/CasaPage.test.tsx`

**Composizione:**
- `CoverHeader` "La casa".
- Pagina bianca:
  - "La tua quota di {mese}: **X €** entro il {giorno}", oppure "Hai già versato la quota di {mese}." se è versata;
  - senza piano: "La quota non è ancora stata calcolata.".
- Stato:
  - "Siete in pari";
  - "Devi X € a {nome}", con il link al rimborso esistente (azione `restituisci` di `CasaAzioni`);
  - "{nome} ti deve X €".
- Il pulsante grande "Aggiungi una spesa di casa", che lancia `libretto:aggiungi` già in modalità casa.
- Il link "Vedi tutto" a `/casa?vista=completa`.

- [ ] **Step 1: test.**
  - chi non gestisce vede la vista semplice;
  - chi gestisce vede la Casa piena;
  - con `?vista=completa` anche chi non gestisce vede la Casa piena;
  - le tre varianti di stato;
  - senza piano;
  - quota già versata;
  - il pulsante lancia l'evento in modalità casa.
- [ ] **Steps 2-4:** eseguire, implementare, poi test, `tsc` e il controllo automatico. Atteso: PASS.
- [ ] **Step 5:** commit e push (`feat: la vista semplice della casa`).

### Task 5: il passaggio da Tricount

**Files:**
- Create: `src/app/casa/impostazioni/SaldoTricount.tsx`
- Modify: `src/app/casa/impostazioni/ImpostazioniCasa.tsx` (sezione nuova); `src/app/casa/inizia/InizioCasa.tsx` (un link alla sezione, solo se servono le condizioni)
- Test: `tests/SaldoTricount.test.tsx`

**Interfaces:**
- Consumes: `registraSaldoIniziale(supabase, { householdId, creditoreId, debitoreId, importo })` (`src/lib/data/transfers.ts`); i trasferimenti di casa già letti (causale `saldo_iniziale`).

**Regole:**
- **Quando compare:** solo con 2 o più membri attivi.
- **Testo:** "Venite da Tricount? Scrivi il saldo di oggi e ripartite da qui."
- **Scelte:**
  - "Chi deve dare soldi a chi": due opzioni con i nomi, "{A} deve a {B}" e "{B} deve a {A}". Con più di 2 membri, si scelgono le due persone.
  - L'importo.
  - Il pulsante "Salva il saldo".
- **Se esiste già un `saldo_iniziale`:** "Già inserito: {debitore} doveva {X} € a {creditore}." senza modulo.
- **Errori:** "esiste già" detto in italiano ("Il saldo da Tricount è già stato inserito."); tutti gli altri errori con il messaggio generico.
- **Dopo il salvataggio:** `router.refresh()`. Il debito compare nei pannelli dei debiti con la dicitura "Saldo di partenza da Tricount" (già fatto nel piano A).

- [ ] **Step 1: test.**
  - nascosto con 1 membro;
  - inviando A deve a B 43 €, `registraSaldoIniziale` riceve `{ creditoreId: B, debitoreId: A, importo: 43 }`;
  - già inserito mostra la frase;
  - l'errore "esiste già" è tradotto.
- [ ] **Steps 2-4:** eseguire, implementare, poi i test e `tsc`. Atteso: PASS.
- [ ] **Step 5:** commit e push (`feat: saldo di partenza da Tricount`). Revisione con sonnet, perché tocca i soldi.

### Task 6: le altre pagine di Casa nel Libretto

**Files:**
- Modify: `src/app/casa/controllo/CheckinMensile.tsx`, `src/app/casa/quota/*.tsx`, `src/app/casa/da-parte/*.tsx`, `src/app/casa/movimenti/MovimentiCasa.tsx`, `src/app/casa/impostazioni/*.tsx`, `src/app/casa/inizia/InizioCasa.tsx` e le relative `page.tsx`.

**Regole:**
- Solo l'aspetto e i testi, nessun cambio di calcoli.
- Ogni pagina ha `CoverHeader` con il suo titolo, card `border-rule` senza ombre, niente etichette maiuscole, importi `.num` e cifre principali in `font-serif`.
- Le radio native del check-in diventano scelte in stile pill: `role="radio"` e tastiera come oggi.
- `CheckinMensile`: "Non è colpa di nessuno" va riscritto in modo neutro (ROADMAP).
- `MovimentiCasa`: pallino della categoria (Task 1).
- `QuotaWizard`: verificare passo per passo che ogni campo abbia un valore di partenza sensato (spec, pezzo 3) e aggiungere quelli che mancano, con un test per ogni nuovo valore di partenza.

- [ ] **Step 1:** aggiornare i test che controllano testi o struttura cambiati. Aggiungere un test per ogni nuovo valore di partenza della quota.
- [ ] **Step 2:** implementare, una pagina per commit.
- [ ] **Step 3:** `npm test`, `tsc`, `npm run build` e il controllo automatico su tutti i file cambiati. Atteso: tutto verde, nessun problema dal controllo.
- [ ] **Step 4:** push (`style: le pagine di casa nel libretto`).

### Task 7: anteprima, revisione finale, DESIGN.md

- [ ] **Step 1:** aggiungere a `/anteprima` le viste `casa`, `casa-semplice` e `casa-dettagli`, con dati di prova di una casa di 2 membri: piano, voci da mettere da parte e un debito. Test. Commit.
- [ ] **Step 2:** avviare `dev-webpack` e fotografare a 390×844, in chiaro e in scuro, in `.impeccable/review/`: `casa.jpg`, `casa-semplice.jpg`, `casa-dettagli.jpg`, `checkin.jpg` e `casa-dark.jpg`.
- [ ] **Step 3:** far fare la revisione finale a `impeccable-finish-reviewer`, con il contratto, `DESIGN.md` e le foto. Un solo giro di correzioni, poi il verdetto.
- [ ] **Step 4:** far aggiornare `DESIGN.md` a `impeccable-documenter` con la scelta "merge": aggiungere i componenti della Casa e togliere la Casa dai difetti noti.
- [ ] **Step 5:** revisione opus di tutto il piano, un solo giro di correzioni, poi la ROADMAP con il piano B3 rimasto (annullamento, Storico, obiettivi, conti, P.IVA, icona). Commit e push.
