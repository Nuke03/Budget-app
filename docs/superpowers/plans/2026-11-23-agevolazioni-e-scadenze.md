# Agevolazioni e scadenze Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Una sezione "Agevolazioni e scadenze" con la situazione personale, le voci che potrebbero riguardarti, i promemoria annuali nella Home e una lezione in Impara.

**Architecture:** Contenuti fissi e regole pure in `src/lib/agevolazioni/`; due tabelle personali (migrazione 0015) per la situazione e gli stati delle voci; una pagina `/agevolazioni` raggiunta da Altro; un promemoria in `prossimaCosa`.

**Tech Stack:** Next.js 16.3.3, React 19, TypeScript, Supabase (RLS), Vitest.

**Spec:** `docs/superpowers/specs/2026-11-23-agevolazioni-e-scadenze-design.md` (contenuti: `docs/research/2026-11-23-agevolazioni-e-scadenze.md`).

## Global Constraints

- Leggere `AGENTS.md` prima del codice Next. Migrazioni 0001–0014 applicate: non si toccano. La 0015 si lancia a mano.
- Mai "hai diritto", "ti spetta": sempre "potrebbe riguardarti". Niente consigli fiscali personalizzati; per i dubbi "un CAF" (gratuito solo per ISEE e DSU) o "l'ufficio dottorato".
- Ogni cifra con l'anno ("nel 2026 …"); ogni voce con `controllatoIl` mostrato come "Controllato il <data lunga>"; oltre 12 mesi: "Potrebbe essere cambiata: controlla il link."
- Dati personali: RLS solo sul proprietario; mai visibili in Casa.
- Testi senza "devi", senza colpa, passano `assertNessunaParolaVietata`. Mondo "Il Libretto". Nessuna dipendenza nuova.
- Mai committare `.impeccable/hook.cache.json`. Master. Commit con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. Situazione vuota: la pagina mostra le voci generali e l'invito "Rispondi a 4 domande…", nessun errore. (Task 4)
2. ISEE con DSU dell'anno prima: trattato come scaduto, non usato per l'ordine. (Task 1)
3. Una voce oltre `validaFinoAl` non compare né in pagina né nei promemoria. (Task 1)
4. Lettura delle tabelle fallita: Home e pagina si aprono, senza promemoria e con la situazione vuota. (Task 4, Task 5)
5. Valori assurdi nel modulo (ISEE negativo, oltre 1 milione, data DSU futura): rifiutati prima di scrivere. (Task 3)

---

### Task 1: Contenuti e regole (sonnet)

**Files:** Create `src/lib/agevolazioni/tipi.ts`, `src/lib/agevolazioni/voci.ts`, `src/lib/agevolazioni/regole.ts`; Test `tests/agevolazioni/regole.test.ts`, `tests/agevolazioni/voci.test.ts`.

**Interfaces — Produces:**
```ts
export interface Situazione { isee: number | null; dsuData: string | null; comune: string | null; inAffitto: boolean | null; studente: boolean | null; piva: boolean }
export type VoceId = 'isee-dsu' | 'bonus-sociale' | 'tari-comune' | 'contributo-affitto' | 'dedicata-a-te' | 'trasporto' | 'dottorato' | 'detrazione-affitto' | 'scadenze-piva';
export type Come = 'automatica' | 'su-domanda' | 'informativa' | 'collegamento';
export interface Voce {
  id: VoceId; titolo: string; perche: string; come: Come; cosaFare: string[];
  cercare: string | null;           // con "{comune}" da sostituire
  link: { testo: string; href: string } | null;
  controllatoIl: string;            // 'yyyy-MM-dd'
  validaFinoAl: string | null;
  soglia: { anno: number; valore: number } | null;
  annuale: boolean;                 // "Fatto" torna a zero l'anno dopo
  meseBando: number | null;         // 1-12, per il promemoria dei bandi
  mostra: (s: Situazione) => boolean;
}
export type StatoVoce = { voceId: VoceId; stato: 'fatto' | 'non-mi-riguarda'; il: string };
export interface VoceMostrata { voce: Voce; frase: string; cercare: string | null; daRicontrollare: boolean; stato: StatoVoce['stato'] | null }
export const VOCI: Voce[]
export function iseeValido(s: Situazione, oggi: string): number | null   // null se manca o DSU di un anno precedente
export function vociDaMostrare(s: Situazione, stati: StatoVoce[], oggi: string): { daControllare: VoceMostrata[]; chiuse: VoceMostrata[] }
export function promemoriaAgevolazioni(s: Situazione | null, stati: StatoVoce[], haApertoSezione: boolean, oggi: string): { testo: string; href: string; voceId: VoceId } | null
```
Contenuti: le 9 voci della tabella della spec, testi dalla ricerca (soglie 2026: bonus sociale 9.796 €, Dedicata a te 15.000 € con `validaFinoAl: '2027-12-31'`); `controllatoIl: '2026-11-23'`; `scadenze-piva` con link `/piva`. La voce ISEE contiene la frase del nucleo della spec.

Regole (dalla spec): le soglie non nascondono mai; ordine: voci con soglia e ISEE valido ≤ soglia in cima con "Il tuo ISEE è sotto la soglia del <anno>: potrebbe riguardarti."; le altre con soglia: "Nel <anno> la soglia è <€>: controlla se è cambiata e se vale per te."; `mostra(s)` per le voci legate alla situazione (affitto, studente, P.IVA); oltre `validaFinoAl` esclusa; `daRicontrollare` se `controllatoIl` è più vecchio di 12 mesi; voci con stato in `chiuse` (uno stato "fatto" di un anno precedente su una voce `annuale` non conta); `cercare` con `{comune}` sostituito, o senza il comune se manca. Promemoria: dal 2 al 31 gennaio "L'ISEE è scaduto il 31 dicembre: rifai la DSU." alle condizioni della spec; altrimenti, nel `meseBando` (o febbraio se null) per `tari-comune` (se ISEE o comune indicati) e `contributo-affitto` (se `inAffitto`), "Controlla se il comune ha aperto il bando: <titolo>." — mai se la voce è chiusa quest'anno; href `/agevolazioni#<voceId>`.

- [ ] **Step 1: Test che falliscono:** ISEE 7.200 con DSU 2026 a novembre 2026 → `bonus-sociale` primo con la frase "sotto la soglia del 2026"; ISEE 20.000 → `bonus-sociale` presente con "Nel 2026 la soglia è 9.796 €"; DSU 2025 a gennaio 2027 → `iseeValido` null e promemoria DSU; `dedicata-a-te` assente il 2028-01-01; `contributo-affitto` assente senza affitto; `controllatoIl` 2026-11-23 → `daRicontrollare` il 2027-11-24; "fatto" 2026 su `isee-dsu` → di nuovo da controllare nel 2027; `cercare` con il comune "Bologna"; nessun testo di `VOCI` contiene "hai diritto", "ti spetta", "devi"; tutte passano `assertNessunaParolaVietata`; ogni soglia ha `anno`.
- [ ] **Step 2:** `npx vitest run tests/agevolazioni` → FAIL.
- [ ] **Step 3:** Implementa.
- [ ] **Step 4:** stesso comando → PASS.
- [ ] **Step 5: Commit** `feat(agevolazioni): contenuti e regole`.

### Task 2: Migrazione 0015 (sonnet)

**Files:** Create `supabase/migrations/0015_agevolazioni.sql`, `supabase/tests/agevolazioni_0015.sql`; Test `tests/migration0015.test.ts`.

- `public.agevolazioni_situazione` (`user_id uuid pk default auth.uid() references auth.users on delete cascade`, `isee numeric(10,2) null check (isee >= 0 and isee < 1000000)`, `dsu_data date null`, `comune text null check (char_length(comune) <= 80)`, `in_affitto boolean null`, `studente boolean null`, `aggiornata_il timestamptz default now()`, `sezione_aperta_il date null`).
- `public.agevolazioni_stati` (`user_id`, `voce_id text not null check (char_length(voce_id) <= 40)`, `stato text check (stato in ('fatto','non-mi-riguarda'))`, `il date not null`, pk `(user_id, voce_id)`).
- RLS: `for all to authenticated using/with check (user_id = (select auth.uid()))` su tutte e due.
- Trigger `before insert or update` su `agevolazioni_situazione`: `dsu_data` non dopo `public._casa_oggi()`.
- `ricomincia_da_zero()`: `create or replace` dalla versione della 0013 più la cancellazione delle due tabelle di chi chiama.
- `begin;`/`commit;`, test statico come `tests/migration0014.test.ts`, test SQL con il pattern `v_ok`.

- [ ] Step 1 test statico che fallisce → Step 2 FAIL → Step 3 scrivi → Step 4 PASS → **Commit** `feat(db): migrazione 0015, agevolazioni`.

### Task 3: Lettura, scrittura e azioni (sonnet)

**Files:** Create `src/lib/data/agevolazioni.ts`, `src/app/agevolazioni/actions.ts`; Test `tests/data/agevolazioni.test.ts`, `tests/agevolazioniActions.test.ts`.

**Interfaces — Produces:** `getSituazione(supabase): Promise<Situazione | null>` (P.IVA da `getPivaSettings`/guidata: `piva = !!guidataDal`), `getStatiVoci(supabase): Promise<StatoVoce[]>`; azioni `salvaSituazione(input: Omit<Situazione, 'piva'>)`, `segnaVoce(voceId: VoceId, stato: 'fatto' | 'non-mi-riguarda' | null)` (null = toglie lo stato), `segnaSezioneAperta()`. Validazione come `src/app/impara/attesa/actions.ts`: ISEE 0 ≤ x < 1.000.000 ai centesimi, data DSU esistente e non futura (Roma), comune ≤ 80 caratteri ripulito, voceId fra quelli di `VOCI`.

- [ ] Test che falliscono (mappatura, validazioni con i valori del Review Focus 5, errori rilanciati) → FAIL → implementa → PASS → **Commit** `feat(agevolazioni): lettura, scrittura e azioni`.

### Task 4: La pagina e Altro (sonnet)

**Files:** Create `src/app/agevolazioni/page.tsx`, `src/app/agevolazioni/AgevolazioniVista.tsx`, `src/app/agevolazioni/SituazioneFoglio.tsx`; Modify `src/app/altro/page.tsx`, `src/lib/fumetti/visti.ts` (`FumettoId` + `'agevolazioni'`); Test `tests/AgevolazioniVista.test.tsx`, `tests/SituazioneFoglio.test.tsx`, `tests/AltroPage.test.tsx`.

- Pagina server: legge situazione e stati (ciascuno con `.catch` → vuoto), chiama `segnaSezioneAperta` best-effort, passa `vociDaMostrare` alla vista.
- Vista: `CoverHeader` "Agevolazioni e scadenze"; card "La tua situazione" con riepilogo e "Modifica" (o l'invito "Rispondi a 4 domande per vedere cosa potrebbe riguardarti."); "Da controllare" come righe da registro con etichetta "Automatico" / "Su domanda" / "Da sapere" / "Vai"; ogni riga si apre (accordion o foglio, scelta del costruttore) con perché, cosa fare, cosa cercare (con "Copia"), link, "Controllato il …", nota "Potrebbe essere cambiata…" se serve, bottoni "Fatto" e "Non mi riguarda"; in fondo "Fatte e non mi riguardano (N)" che si apre e permette "Rimetti fra da controllare". Ancora `id={voceId}` per l'href dei promemoria. Fumetto della prima volta sulla card della situazione: "Qui trovi aiuti e sconti che potrebbero riguardarti, e quando chiederli."
- `SituazioneFoglio`: ISEE (campo numerico facoltativo), data DSU, comune, affitto e studio con `SceltePill` (Sì / No / Non so → null), "Salva".
- Altro: voce "Agevolazioni e scadenze" (icona lucide `HandCoins` o `BadgeEuro`) dopo "Impara".

- [ ] Test che falliscono (situazione vuota → invito e voci generali; con ISEE basso → bonus in cima; "Fatto" sposta la voce fra le chiuse; nota "Potrebbe essere cambiata" con data vecchia; letture fallite → pagina aperta; testi senza parole vietate e senza "hai diritto") → FAIL → implementa → PASS → **Commit** `feat(agevolazioni): la pagina`.

### Task 5: Il promemoria nella Home (sonnet)

**Files:** Modify `src/lib/calculations/supporto/home.ts` (`InputProssimaCosa.agevolazione?: { testo: string; href: string } | null`, tipo `'agevolazione'`, priorità: dopo P.IVA urgente e Casa, prima della P.IVA non urgente e della lista d'attesa), `src/lib/loadHomeData.ts` (legge situazione e stati con `.catch`, calcola `promemoriaAgevolazioni`); Test relativi.

- [ ] Test che falliscono (2 gennaio 2027 con DSU 2026 → "L'ISEE è scaduto il 31 dicembre: rifai la DSU."; DSU 2027 → niente; febbraio con affitto → promemoria del contributo affitto; letture fallite → niente promemoria e Home intatta; un promemoria Casa ha la precedenza) → FAIL → implementa → PASS → **Commit** `feat(agevolazioni): il promemoria nella Home`.

### Task 6: Lezione, documenti, controlli (haiku)

**Files:** Modify `src/lib/percorso/tipi.ts` (`ArgomentoId` + `'aiuti'`), `src/lib/percorso/lezioni.ts` (lezione "Gli aiuti che si chiedono": "In breve" sul fatto che molte agevolazioni vanno chieste, "Con i tuoi numeri" = ISEE valido e numero di voci da controllare, azione verso `/agevolazioni`, fonti INPS e ARERA dalla ricerca), `DESIGN.md`, `PRODUCT.md`, `docs/ROADMAP.md` (0015 da lanciare a mano con il suo test SQL; la routine annuale da creare con il sì di Fabio); test esistenti delle lezioni.

- [ ] Aggiorna i test delle lezioni → implementa → `npm run lint` (nessun errore nuovo), `npx vitest run`, `npm run build`, detector impeccable `detect --json --changed` → **Commit** `feat(agevolazioni): lezione e documenti`.
- [ ] Revisione finale (opus), poi `git push`. Poi chiedi a Fabio se creare la routine annuale (skill `schedule`, 15 gennaio): solo con il suo sì.
