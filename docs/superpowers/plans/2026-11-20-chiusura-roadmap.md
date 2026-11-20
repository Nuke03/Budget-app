# Chiusura della ROADMAP (20 novembre 2026)

Fabio: "chiudi tutte le ultime cose". Questo piano chiude le piccole note rimandate dei piani `2026-11-20-orientarsi.md` e `2026-11-20-autorata-sposta.md` e i "Rinviati piccoli" della ROADMAP. Niente funzioni nuove.

## Global Constraints

- Next.js 16.3.3: leggere `AGENTS.md` e `node_modules/next/dist/docs/` prima di scrivere codice.
- Migrazioni 0001–0013 applicate: non si toccano. Una sola migrazione nuova, 0014, lanciata a mano da Fabio.
- Testi in italiano semplice, senza "devi/dovresti", senza colpa; passano `assertNessunaParolaVietata`.
- Mondo "Il Libretto" (`DESIGN.md`). Nessuna dipendenza nuova. Mai committare `.impeccable/hook.cache.json`. Si lavora su `master`.
- TDD: prima il test che fallisce, poi il codice. Suite intera, `npx tsc --noEmit` e `npm run build` prima del commit.

## Fuori da questo piano (decisione di Claude, con il motivo)

- **P12** (tabelle P.IVA in sola lettura dal client): serve un rilascio in due tempi con il database vivo (prima tutte le scritture passano da funzioni `security definer`, poi si tolgono le policy). È una difesa in più, non un difetto. Resta aperta, da fare con Fabio presente.
- **P13** (mettere da parte una percentuale in più): è un'idea di prodotto, da decidere con Fabio.
- **K2** (totale diverso dalla banca): servono i numeri veri di un caso.
- **"Home e P.IVA leggono in due modi"**: con i rientri le due letture usano già lo stesso aiuto (`rientriEffettivi`); unificare tutto è un rifacimento, non una chiusura.
- Prove dal vivo, valori ENPAP, soglie del percorso: sono di Fabio.

## Task 1: Fumetti e menu, le note rimandate (sonnet)

Files: `src/lib/fumetti/ambiente.ts`, `src/app/fumetti/Fumetto.tsx`, `src/app/fumetti/FumettoPrimaVolta.tsx`, `src/app/altro/RivediGiro.tsx`, `src/app/anteprima/ApriFoglio.tsx`, test relativi.
- `useQualcosaAperto`: `MutationObserver` con `attributeFilter: ['aria-modal', 'data-avviso-annulla', 'data-dopo-in-attesa']` (e `childList`, `subtree`).
- `Fumetto`: anche la zona sicura destra (`env(safe-area-inset-right)`) nel margine orizzontale; Esc nel giro con `stopPropagation`.
- Annuncio del fumetto della prima volta: una regione `aria-live="polite"` sempre presente nel componente, riempita quando il fumetto compare (un nodo inserito già con `aria-live` può non essere letto).
- `RivediGiro`: il bottone è disattivato finché l'utente non è noto (oggi il tocco non fa niente in silenzio).
- `ApriFoglio`: trova "Registra una spesa" anche nella forma "Registra una spesa di casa" (regex che inizia con "Registra una spesa").
- Test: Tab resta dentro il giro e il fuoco torna dov'era alla chiusura; il fumetto resta dentro lo schermo a 375px con un'ancora vicino al bordo destro.
Commit: `fix(fumetti): rifiniture rimandate`.

## Task 2: Rientri, le note rimandate (sonnet)

Files: `src/app/goals/GoalsList.tsx`, `src/app/casa/da-parte/DaParte.tsx`, `src/app/rientri/RigaRientro.tsx`, `src/app/HomeDashboard.tsx`, `src/app/history/page.tsx`, `src/lib/data/rientri.ts`, `src/lib/calculations/rientri.ts`, test relativi.
- Sulle card dei cassetti si vedono anche i rientri **fermati** non finiti: `RigaRientro` con "Rientro fermato: 200 € rimessi su 300 €" (niente "Ferma"). Spec: la card mostra il rientro; fermare non lo nasconde.
- "Versa nel cassetto": la rata di un rientro entra nella cifra proposta solo se il mese corrente è fra il primo e l'ultimo mese del rientro (oggi si controlla solo l'ultimo).
- Home, foglio "Rimetti a rate": anche per i cassetti di casa la cifra parte da quanto speso e non ancora rientrato (leggere lo speso collegato dei cassetti di casa che la Home ha già, o aggiungerlo alla lettura della casa).
- `euroInFrase` duplicato in `HomeDashboard.tsx`: usare quello condiviso.
- Storico: uno spostamento da o verso un conto archiviato mostra il suo nome (leggere anche i conti archiviati per i nomi).
- `creaRientro` con lo spazio della casa e un conto: rifiutato nel client con "Rientro non valido" (oggi lo rifiuta solo il database).
- Test: drift vero (somma di 12 rate da 33,33 su 400 € dà esattamente 400); spostamento con data uguale a `creatoIl` conta; un rientro chiuso e uno aperto sullo stesso conto: lo spostamento va all'aperto; `ultimoMeseRientro` con partenza a dicembre e 12 mesi.
Commit: `fix(rientri): rifiniture rimandate`.

## Task 3: Home e P.IVA, i rinviati della ROADMAP (sonnet)

Files: da trovare a partire da `src/lib/loadHomeData.ts`, `src/lib/pivaHome.ts`, `src/lib/calculations/stipendio.ts`, `src/app/history/page.tsx`, `src/lib/registraSpesa.ts`, test relativi.
- **P2**: le scadenze dell'anno corrente (e, da dicembre, dell'anno dopo) si creano anche quando si apre la Home, non solo la pagina P.IVA (`assicuraScadenze` è idempotente; un errore non rompe la Home).
- **Riga "P.IVA non letta"**: per chi non ha la P.IVA guidata, un errore passeggero nella lettura delle impostazioni P.IVA non mostra la riga (la riga è solo per chi la usa).
- **Disponibile negativo**: in `homeConStipendio` (`mostrato`), quando il disponibile vero è sotto zero, la Home mostra 0 con la frase "Fino al prossimo stipendio conviene spendere solo per il necessario." (stesso tono della Home senza stipendio).
- **"La riporto indietro?"**: se si lascia lo Storico prima dei 5 secondi, la domanda compare alla prossima apertura dello Storico (memoria di sessione); due eliminazioni di incassi vicine fanno due domande in fila, non una sola.
- **Risposta del server persa** (`registraMovimento` e i fogli che lo usano): se la chiamata fallisce per rete dopo l'invio, il messaggio dice "Non so se è stato salvato. Controlla nello Storico prima di riprovare." invece del messaggio generico; per gli altri errori resta quello di oggi.
- **Soglia del reddito irregolare (0,3)**: test che la blocca (0,29 regolare, 0,3 irregolare, o come dice il codice).
Commit: `fix(home): i rinviati della pulizia`.

## Task 4: Migrazione 0014, difese nel database (sonnet)

Files: `supabase/migrations/0014_difese.sql`, `supabase/tests/difese_0014.sql`, `tests/migration0014.test.ts`, più il codice dei movimenti di riconciliazione.
- `goal_versamenti`: trigger `before insert or update` che rifiuta importo fuori da (0, 1e9) e data dopo `public._casa_oggi()`.
- `rientri`: trigger `before update` che permette di cambiare solo `stato` e `fermato_il` (rifiuta cambi di `goal_id`, `account_id`, `importo`, `mesi`, `creato_il`, `household_id`, `user_id`).
- Righe della riconciliazione (`origine = 'riconciliazione'`): `modifica_movimento` le rifiuta con un messaggio; nello Storico non hanno la matita (si possono ancora eliminare).
- `begin;`/`commit;`, `create or replace` dove serve, `drop trigger if exists` prima dei trigger. Test statico come `tests/migration0013.test.ts`, test SQL da lanciare a mano.
Commit: `feat(db): migrazione 0014, difese in più`.

## Task 5: Documentazione (haiku)

- `docs/ROADMAP.md`: le voci chiuse da questo piano segnate come fatte; la sezione "Icona dell'app" segnata come fatta (icona già rifatta: commit `64d95d4`, `0e06f43`); "Da fare" per Fabio: lanciare la 0014 e il suo test SQL; esito del controllo dei link delle lezioni; elenco chiaro di cosa resta e perché (P12, P13, K2, prove dal vivo, ENPAP, soglie).
Commit: `docs(roadmap): chiusura`.

Ogni task: revisione (sonnet). Alla fine: revisione finale (opus), push dopo che Fabio ha lanciato la 0014.
