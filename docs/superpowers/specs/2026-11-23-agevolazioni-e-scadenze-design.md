# Agevolazioni e scadenze

Data: 23 novembre 2026. Stato: approvata da Fabio il 23 novembre 2026.
Base dei contenuti: `docs/research/2026-11-23-agevolazioni-e-scadenze.md` (fonti, stime e voci non verificate, segnate una per una).

## Perché

Fabio ha un ISEE basso e ha scoperto **per caso**, leggendo il modulo del comune per lo sconto sulla TARI, di avere diritto a uno sconto. L'app non dice niente su ISEE, DSU, bonus, sconti comunali e scadenze dell'Agenzia delle Entrate. Fabio vuole indicazioni concrete del tipo "fai questo, controlla qui", con le scadenze al momento giusto. Lo scopo dell'app è insegnare l'economia domestica: le agevolazioni sono una parte che nessuno insegna e che si perde se non la si chiede.

## Obiettivi

- Una sezione **"Agevolazioni e scadenze"** che mostra le agevolazioni che **potrebbero** riguardare chi la usa, partendo da poche informazioni sulla sua situazione.
- Ogni voce dice cos'è, perché potrebbe riguardarti, se è **automatica** o **su domanda**, cosa fare, cosa cercare e il link ufficiale, con la data dell'ultimo controllo.
- Le scadenze dell'anno (rinnovare la DSU, i bandi del comune, il 730 se serve) arrivano nella Home al momento giusto, una alla volta, come gli altri promemoria.
- I contenuti restano aggiornati con un controllo programmato all'anno (approccio A, scelto da Fabio).

## Cosa non si fa

- **Niente consigli fiscali personalizzati.** L'app non dice mai "hai diritto" né "ti spettano X €": dice "potrebbe riguardarti, controlla qui". Per i dubbi rimanda a un CAF (gratuito) o all'ente.
- Niente calcolo dell'ISEE, niente compilazione di moduli, niente collegamenti a INPS o Agenzia delle Entrate.
- Niente consigli su residenza o composizione del nucleo.
- Niente lettura automatica dei siti ufficiali (approccio C, scartato).
- Le scadenze P.IVA di Miriam restano nella pagina P.IVA: qui c'è solo un collegamento.

## Cosa sarebbe un fallimento anche se funziona

- Una voce che sembra una promessa ("hai diritto") e poi non vale.
- Una soglia vecchia mostrata come se fosse di quest'anno.
- Troppe voci o troppi promemoria: deve restare "una cosa alla volta".
- Il valore dell'ISEE visibile all'altro membro della casa.

## Approcci considerati

- **A. Testi fissi con la data e un controllo all'anno** — scelto da Fabio. Le voci stanno nell'app come le lezioni, ognuna con "Controllato il …" e il link ufficiale; i testi evitano numeri dove possono e, dove servono, dicono l'anno ("nel 2026 la soglia è 9.796 €"); una voce controllata più di 12 mesi fa mostra "potrebbe essere cambiata, controlla il link". Un controllo programmato (routine di Claude a gennaio, dopo la legge di bilancio) rilegge le fonti e propone a Fabio gli aggiornamenti; con il suo sì si aggiornano e si pubblicano.
- B. Voci in una tabella aggiornata a mano da Fabio — scartato: diventa un lavoro.
- C. L'app legge i siti ufficiali da sola — scartato: niente dati aperti affidabili, letture fragili, servirebbe un servizio sempre acceso fuori dal piano gratuito.

## La tua situazione

Dati **personali** (spazio privato, invisibili all'altro membro, come il resto): Fabio e Miriam hanno residenze e quindi ISEE separati.

Domande, tutte facoltative, che si cambiano quando si vuole:
- **Valore dell'ISEE** (€) e **data della DSU** (scelta di Fabio: il valore, non la fascia).
- **Comune di residenza** (testo; serve solo a comporre le ricerche "… + nome del comune").
- **Abiti in affitto?** (sì/no)
- **Studi o fai un dottorato con borsa?** (sì/no)
- La P.IVA guidata si legge da sola dalle impostazioni P.IVA (nessuna domanda).

Senza risposte la sezione mostra lo stesso le voci generali (ISEE, DSU), con un invito: "Rispondi a 4 domande per vedere cosa potrebbe riguardarti".

## Le voci (versione 1)

Ogni voce ha: titolo, frase "perché potrebbe riguardarti", come si ottiene (automatica / su domanda), cosa fare (1-3 passi), cosa cercare (testo con il comune inserito), link ufficiale, controllato il, quando mostrarla (regola sui dati della situazione), eventuale periodo dell'anno per il promemoria.

Dalla ricerca (le soglie con l'anno, le voci non verificate segnate come "da verificare con il CAF"):

| Voce | Quando si mostra | Come si ottiene |
|---|---|---|
| **ISEE e DSU**: cos'è, scade il 31 dicembre, la DSU precompilata su INPS | sempre | su domanda (DSU) |
| **Bonus sociale luce, gas, acqua e rifiuti** (−25% TARI), ISEE fino a 9.796 € nel 2026 | ISEE ≤ soglia o ISEE non indicato | automatico con la DSU; lo sconto rifiuti arriva l'anno dopo |
| **Sconto TARI del comune** (oltre al bonus): di solito modulo e scadenza | ISEE indicato (qualsiasi) o non indicato | su domanda: "modulo agevolazioni TARI <comune>" |
| **Contributo affitto** (bandi comunali o regionali) | in affitto | su domanda, bando annuale |
| **Carta "Dedicata a te"** (500 €, ISEE fino a 15.000 €), da verificare | ISEE ≤ 15.000 | senza domanda: liste del comune |
| **Trasporto pubblico agevolato** (ISEE o studenti) | ISEE indicato o studente | su domanda, azienda di trasporto |
| **Borsa di dottorato: tasse e contributi** (informativa: contributi INPS gestione separata; per IRPEF e 730 chiedi all'ufficio dottorato o a un CAF) | studente/dottorato | informativa |
| **Detrazione per chi è in affitto** (informativa: con redditi esenti o forfettario spesso non si recupera; chiedi a un CAF) | in affitto | informativa |
| **Le scadenze P.IVA** (collegamento alla pagina P.IVA) | P.IVA guidata | collegamento |

**Regole (scelte di Claude, dopo il controllo del revisore):**
- **Le soglie non nascondono mai una voce.** Nascondere vorrebbe dire "non ti riguarda", che è già un giudizio. Le voci con una soglia si mostrano sempre; cambia solo l'ordine e la frase: ISEE sotto la soglia → in cima, "Il tuo ISEE è sotto la soglia del 2026: potrebbe riguardarti."; sopra o non indicato → più in basso, "Nel 2026 la soglia è X €: controlla se è cambiata e se vale per te."
- **ISEE scaduto**: se la data della DSU è di un anno precedente, il valore non si usa per l'ordine (vale come "non indicato") e la voce ISEE dice "Il tuo ISEE è scaduto il 31 dicembre".
- **Il nucleo**: la voce ISEE dice, come fatto e senza consiglio: "Il nucleo è quello del tuo stato di famiglia: se cambia la residenza o la convivenza registrata, cambia anche l'ISEE. Per i dubbi, un CAF."
- **Scadenza della voce**: ogni voce può avere `validaFinoAl`; dopo quella data non si mostra (per esempio "Dedicata a te" fino al 31 dicembre 2027). Le finestre con date (primo utilizzo, accrediti) si scrivono con l'anno.
- **Voci informative** (dottorato, detrazione affitto): solo cosa sono e "chiedi all'ufficio dottorato o a un CAF"; niente "spesso non si recupera". "CAF gratuito" si scrive solo per ISEE e DSU.
- **"Studente/dottorato" e le altre risposte sono per persona**: ognuno risponde per sé.

Stato di ogni voce per utente: nessuno, **Fatto** (con data), **Non mi riguarda**. "Fatto" su una voce annuale (DSU, bandi) torna a "nessuno" l'anno dopo.

## Le scadenze nella Home

Promemoria annuali, nella card "Prossimo" con le sue priorità (dopo quelli della casa e della P.IVA, prima dei consigli), uno alla volta, chiudibili con "Fatto" o "Più tardi":
- **Gennaio** (dal 2 al 31): "L'ISEE è scaduto il 31 dicembre: rifai la DSU." Compare a chi ha indicato un ISEE o una data della DSU, oppure a chi non ha segnato "Non mi riguarda" sulla voce ISEE e ha aperto la sezione almeno una volta. Non compare se la data della DSU è dell'anno in corso. "Fatto" sul promemoria e "Fatto" sulla voce sono lo stesso stato.
- **Bandi della voce "Sconto TARI" e "Contributo affitto"** (il secondo solo per chi ha risposto "in affitto"; il primo per chi ha indicato un ISEE o il comune): un promemoria all'anno ("Controlla se il comune ha aperto il bando…") nel mese indicato dalla voce, o, se la voce non ha un mese, a febbraio.
- **730** solo come informativa per chi ha detto "studente/dottorato": niente promemoria finché non è verificato che serva.

## Dove si vede

- **Altro → "Agevolazioni e scadenze"** (con il fumetto della prima volta: "Qui trovi aiuti e sconti che potrebbero riguardarti, e quando chiederli.").
- **Impara**: una lezione nuova "Gli aiuti che si chiedono", con "Con i tuoi numeri" (il tuo ISEE e le voci che potrebbero riguardarti) e il bottone verso la sezione.
- **Menu del +**: nessuna voce nuova.

```
 Agevolazioni e scadenze
 ┌───────────────────────────────────────┐
 │ La tua situazione            Modifica │
 │ ISEE 7.200 € · DSU 12/03/2026 · affitto│
 └───────────────────────────────────────┘
 Da controllare
 ─────────────────────────────────────────
 Sconto TARI del comune         Su domanda ›
 Con un ISEE basso molti comuni la scontano.
 Controllato il 23 novembre 2026
 ─────────────────────────────────────────
 Bonus sociale luce, gas, rifiuti  Automatico ›
 ─────────────────────────────────────────
 Fatte e non mi riguardano (2)            ›
```

## Il controllo annuale (approccio A)

- Una routine programmata di Claude (skill `schedule`) gira il **15 gennaio** di ogni anno: rilegge le fonti ufficiali delle voci, confronta soglie e regole, e scrive a Fabio una proposta di aggiornamento (cosa è cambiato, con i link). Con il sì di Fabio si aggiornano i testi e le date "Controllato il" e si pubblica.
- La routine si crea alla fine dell'implementazione, solo con il sì esplicito di Fabio.

## Dati e migrazione

- Migrazione **0015** (a mano da Fabio): tabella personale della situazione (una riga per utente: isee, dsu_data, comune, in_affitto, studente) e tabella degli stati delle voci (utente, voce, stato, data). RLS solo sul proprietario. "Ricomincia da zero" le cancella: la 0015 fa `create or replace` di `ricomincia_da_zero` (ultima versione: 0013) aggiungendo le due tabelle.
- I contenuti delle voci sono testi fissi nel codice (non nel database).

## Vincoli

- Next.js 16.3.3 (leggere `AGENTS.md`), Supabase free tier, nessuna dipendenza nuova.
- Mondo "Il Libretto", testi senza "devi", senza colpa, `PAROLE_VIETATE`.
- Ogni cifra con l'anno; ogni voce con "Controllato il"; dopo 12 mesi la nota "potrebbe essere cambiata".
- Mai "hai diritto": sempre "potrebbe riguardarti".

## Lasciato a chi costruisce

- I testi definitivi delle voci, dalla ricerca, con le stesse regole e i tag [da verificare] trasformati in "chiedi a un CAF".
- La forma esatta delle regole "quando si mostra" (funzioni pure, testate).
- Nomi di tabelle e colonne, test SQL.
- Il testo della lezione in Impara.
