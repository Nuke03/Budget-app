# Redesign direction — note di lavoro (impeccable skill, code-led)

Stato: direzione confermata con l'utente, implementazione non ancora iniziata. Riprendere da qui.

## Contesto

L'utente ha aperto l'app deployata e trovato la UX "terribile, non per niente stile app" —
form piatti senza personalità, nessuna animazione, nessun feedback (già corretto parzialmente:
press-state sui bottoni, loading state sul login, font system fix). Questo documento riguarda
il redesign visivo completo successivo a quei fix minori.

## Riferimenti dati dall'utente

- **Cashew** (Expense Management App) — molto colorata, card grandi arrotondate, icone colorate
  per categoria, numeri protagonisti, animazioni fluide. **Direzione scelta.**
- Tricount — minimale, diretto, poco colore (scartato come riferimento principale)
- Money manager (genere) — dashboard con grafici a torta, stile fintech standard (scartato)

**Direzione confermata dall'utente: stile Cashew.**

## Vincoli di sessione

- Nessuno strumento di generazione immagini disponibile → lavoro **code-led** (niente comp/mockup
  immagine prima, si costruisce direttamente in codice, ambizione nel FIRST VIEWPORT/motion).
- PRODUCT.md già scritto in `PROJECT_ROOT/PRODUCT.md` — non riscrivere, contiene la verità di
  prodotto confermata.
- Modalità: **Operate** (l'utente completa un task — inserire spese, controllare il disponibile —
  non è una pagina di marketing).

## Sistema visivo deciso (token, da scrivere in `src/app/globals.css`)

- **Colore primario/brand**: verde smeraldo `#0F9D6B` — associazione positiva con denaro/crescita,
  usato per la hero card del disponibile libero, bottoni primari, stato attivo nav.
- **Palette categorie** (8 swatch, l'utente sceglie il colore alla creazione categoria —
  il campo `colore` in `categories` esiste già nello schema ma non è mai stato popolato/usato
  da nessun task, va finalmente sfruttato):
  1. Corallo `#F97362`
  2. Ambra `#F5A524`
  3. Smeraldo `#0F9D6B`
  4. Teal `#14B8A6`
  5. Cielo `#3B9AE1`
  6. Viola `#8B5CF6`
  7. Rosa `#EC4899`
  8. Ardesia (neutro/altro) `#64748B`
- **Sfondo**: quasi-bianco caldo `#FAFAF8` (non bianco puro), superfici card `#FFFFFF`.
- **Testo**: primario `#111827`, secondario `#6B7280` su sfondi neutri; su superfici colorate
  (es. la hero card verde) il testo secondario va tinto dal verde stesso, mai grigio piatto
  (regola craft-floor.md).
- **Font**: `system-ui` stack (non Geist) — scelta deliberata e motivata: il PRODUCT.md dice
  esplicitamente che l'app deve "sentirsi nativa su iPhone", e `system-ui` su iOS renderizza
  con San Francisco, il font di sistema Apple. Numeri di denaro con `font-variant-numeric:
  tabular-nums`, pesi/dimensioni marcati (hero number ~40-48px bold).
- **Forme**: raggio grande (`--radius-lg: 24px` su hero/card principali, `--radius-md: 16px`
  su list item/bottoni, pill/`rounded-full` su FAB e badge).
- **Ombre**: morbide con offset+blur reali (mai zero-offset), la hero card ha un'ombra tinta
  dal verde brand (`0 12px 32px -8px rgba(15,157,107,0.35)`).

## Piano di implementazione (non ancora iniziato)

Ordine di priorità per la prossima sessione:

1. **globals.css**: scrivere i token sopra (variabili CSS), stile bottoni/focus/scrollbar tema.
2. **NavBar**: ridisegnare come barra flottante arrotondata con icone lucide-react (Home, Target
   per Obiettivi, BarChart per Storico, Wallet per Conti, Tag per Categorie) + stato attivo a pillola.
3. **HomeDashboard**: hero card verde grande con disponibile libero (numeri tabulari grandi),
   margine sotto, breakdown con indicatori colorati per conti/obiettivi, FAB circolare con icona
   Plus (lucide) e ombra propria.
4. **Add transaction → bottom sheet**: è il cambiamento con più impatto percepito. Oggi `/add` è
   una pagina separata raggiunta con navigazione piena (nessuna transizione, sensazione "sito
   web"). Convertirla in un overlay/bottom sheet che scorre dal basso sopra la Home (animazione
   CSS slide-up + backdrop semi-trasparente, chiusura al tap sul backdrop o su una X) è
   esattamente il pattern "schede slider" che l'utente ha citato come mancante. Non serve gesture
   di drag-to-dismiss completa (troppo costosa per il beneficio), basta l'animazione di apertura/
   chiusura ben fatta — è il "signature interaction" del redesign.
5. **Colore categorie**: aggiungere selettore colore (8 swatch sopra) alla creazione categoria in
   `src/app/categories/page.tsx`, popolare finalmente il campo `colore` (mai usato finora), e
   usarlo per le icone/chip categoria in Add transaction, Storico, Categorie stesse.
6. **Goals, Accounts, History, Categories, Login**: applicare lo stesso sistema di card/colore/
   forme in modo coerente, così nessuna schermata sembra rimasta "vecchio stile" rispetto alle altre.

## Nota di processo

Non è stata seguita la cerimonia completa di `new-work.md` (concept-seed/dice roll, decision
page con più direzioni) perché la direzione è "brief-pinned" dall'utente (ha nominato Cashew
esplicitamente) — la skill impeccable permette di saltare il torneo di concept in questo caso
("a user- or brief-pinned direction beats the roll, always"). Si procede direttamente a costruire
la direzione scelta con piena cura (craft-floor.md), non con un torneo di alternative.

Alla fine dell'implementazione: verifica screenshot (desktop+mobile) via browser tool sul deploy
o in locale, poi commit/push. Considerare se scrivere `DESIGN.md` a fine lavoro per documentare
il sistema (raccomandato dalla skill, non obbligatorio per un progetto personale di queste
dimensioni).
