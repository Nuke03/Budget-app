# Correzioni dalla prova di Fabio e Miriam (23 novembre 2026)

Segnalazioni di Fabio: Impara lento; zoom su alcuni telefoni; scritte e bottoni attaccati su alcuni telefoni; nelle lezioni "Salva" si blocca (insistendo riparte); Categorie: la modifica compare nel modulo in fondo, invisibile con tante categorie, pochi colori; l'app rallenta e si blocca mentre si usa (anche mentre si pubblicavano versioni nuove).

## Cause trovate (indagine, prima di correggere)

1. **Versioni nuove con l'app aperta.** Ogni push pubblica una versione nuova su Vercel; l'app aperta sul telefono resta con il codice vecchio e le sue azioni sul server possono non trovare più la funzione finché non si ricarica. Next prevede `deploymentId`: con un id diverso il client ricarica da solo.
2. **Impara carica tutta la Home.** `loadPercorsoData` chiama `loadHomeBase` (circa 20 letture, con Casa, P.IVA, rientri, conferme, promemoria). Lo usano `/impara`, `/impara/primi-passi`, `/impara/primi-passi/[passo]`, `/impara/[argomento]` e `valutaDopoSalvataggio` dopo **ogni spesa personale**. Le azioni sul server di un client girano una alla volta: un'azione lenta dopo un salvataggio fa aspettare quella dopo.
3. **"Salva" nei primi passi ricarica due volte e non conferma.** Le azioni chiamano `revalidatePath` su tre percorsi e poi il componente chiama `router.refresh()`: due caricamenti pesanti, e nessun "Salvato".
4. **Campi a 15px.** Su iPhone un campo con testo sotto i 16px fa ingrandire la pagina quando lo tocchi (`AccountRow`, `CreateGoalForm`, `HoMessoDaParte`, `PeriodoFilter`, `PivaSettingsForm` e altri).
5. **Categorie.** La matita compila il modulo in fondo alla pagina invece di aprire la modifica vicino a chi la tocca.

## Global Constraints

- Leggere `AGENTS.md` e `node_modules/next/dist/docs/` (in particolare `deploymentId`) prima del codice Next.
- Nessuna dipendenza nuova. Mondo "Il Libretto". Testi senza "devi". Mai committare `.impeccable/hook.cache.json`. Master. Commit con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- TDD dove un test può esprimere la correzione; suite intera, `npx tsc --noEmit`, `npm run build` prima del commit.

## Task B1: L'app si ricarica da sola con una versione nuova (haiku)

- `next.config.ts`: `deploymentId: process.env.VERCEL_DEPLOYMENT_ID` (su Vercel c'è sempre; in locale resta `undefined` e non cambia niente). Leggere il doc `deploymentId` per confermare il comportamento.
- Test: `tests/nextConfig.test.ts` controlla che con `VERCEL_DEPLOYMENT_ID='dpl_x'` la config esporti `deploymentId: 'dpl_x'` e senza resti `undefined`.
- Commit `fix(app): con una versione nuova l'app si ricarica da sola`.

## Task B2: Impara e il dopo-salvataggio leggono solo quello che serve (sonnet)

- Nuova `loadPercorsoLeggero(supabase, today, userId)` in `src/lib/loadPercorsoData.ts` con lo stesso tipo di ritorno di `loadPercorsoData`, che legge solo: percorso utente e lezioni, conti, categorie, cassetti aperti (con speso collegato, conferme e rientri come oggi, perché servono al riservato), transazioni della finestra, impostazioni P.IVA con le quote in sospeso solo se guidata, la riserva della casa (`riservaVersamento`, `debitoDaRestituire`) letta con la funzione più leggera che la dà (senza `loadCasaAggiunta` né i promemoria). Niente lista d'attesa, promemoria utente, ultima creazione, scadenze, fatture.
- Test di equivalenza: con gli stessi dati finti, `loadPercorsoLeggero` restituisce gli stessi `disponibileReale`, `disponibileLibero`, `riservati`, `primiPassi`, `lezioni`, `percorso`, `goals` di `loadPercorsoData`; e fa meno letture (conta le chiamate al client finto).
- Usarla in `/impara`, `/impara/primi-passi`, `/impara/primi-passi/[passo]`, `/impara/[argomento]` e in `valutaDopoSalvataggio` / `rispondiAvviso`. `loadPercorsoData` resta per chi serve tutto (se nessuno, si toglie).
- Primi passi: le azioni fanno `revalidatePath('/impara/primi-passi', 'layout')` e `revalidatePath('/')` una volta; i componenti **non** chiamano più `router.refresh()` dopo un'azione che ha già rivalidato; dopo il salvataggio compare "Salvato." (role status, 15px, inchiostro tenue) per 3 secondi.
- Commit `fix(impara): letture leggere e un solo aggiornamento dopo Salva`.

## Task B3: Niente zoom sui campi (haiku)

- Tutti i campi (`input`, `select`, `textarea`) dell'app a `text-base` (16px) o più. Le costanti di stile dei campi (`fieldClass`, `CAMPO`, ecc.) e ogni `className` di un campo.
- Test statico `tests/campiSenzaZoom.test.ts`: scorre `src/app/**/*.tsx` e fallisce se una costante o una `className` di un campo contiene `text-[1x px]` sotto 16 o `text-sm`/`text-xs`. (I testi delle etichette restano come sono.)
- Commit `fix(app): campi a 16px, niente zoom su iPhone`.

## Task B4: Spazi sui telefoni stretti (controller + sonnet)

- Il controller apre il dev server e le viste `/anteprima` a 320 e 360px, e annota i punti dove testi e bottoni si toccano o escono dallo schermo. Poi un subagente corregge con il ritmo di `DESIGN.md` (gap 8/12/14/16, bersagli 44px, `min-w-0` e `break-words` dove serve).

## Task B5: Categorie: modifica in un foglio, più colori, icone (dopo il sì di Fabio sul design breve)

Design breve proposto a Fabio:
- La matita apre "Modifica categoria" in un `FoglioInferiore` (come il resto dell'app); il modulo in fondo resta solo per "Nuova categoria".
- **Colori:** da 8 a 16 tinte piatte (le 8 di oggi più rosa antico, arancio, lime, ciano, indaco, viola chiaro, marrone, grigio caldo), con contrasto controllato come oggi (testo bianco o scuro sulla tinta).
- **Icone:** facoltative, scelte da una griglia di circa 24 icone lucide per le spese di casa (carrello, casa, auto, benzina, bus, bolletta, telefono, wifi, salute, farmacia, svago, ristorante, caffè, regalo, vestiti, animali, sport, viaggio, studio, lavoro, tasse, banca, bambini, altro). Dove oggi c'è il pallino del colore (registro, Storico, chip), con un'icona compare l'icona di 16px nel colore della categoria; senza icona resta il pallino.
- Migrazione **0016**: colonna `icona text null` su `categories` con il controllo sull'elenco; la lancia Fabio.
- `DESIGN.md`: la palette delle categorie passa a 16 tinte e si aggiunge la regola delle icone.
