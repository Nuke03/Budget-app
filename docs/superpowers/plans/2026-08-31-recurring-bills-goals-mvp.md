# Obiettivi Ricorrenti Generalizzati — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generalizzare la frequenza degli obiettivi ricorrenti da "solo anni" a mesi
configurabili (mensile/trimestrale/semestrale/annuale/personalizzato), e aggiungere un
suggerimento dell'importo per bollette a importo variabile basato sulla media delle spese
passate nella stessa categoria più un margine di sicurezza.

**Architecture:** Estende il sistema `budget_goals` esistente (Task 6/11/15 del piano MVP
originale) senza introdurre nuove entità: stesso modello dati, più opzioni alla creazione.
La logica di suggerimento vive in una funzione pura separata dal layer dati, testata in
isolamento come il resto del motore di calcolo.

**Tech Stack:** Stesso stack del progetto (Next.js App Router, TypeScript, Supabase,
Vitest, date-fns).

**Spec:** [docs/superpowers/specs/2026-08-31-recurring-bills-goals-design.md](../specs/2026-08-31-recurring-bills-goals-design.md)

## Global Constraints

- Nessun nuovo campo persistente per "margine %" o "numero di spese considerate" — sono
  input usati solo al momento del calcolo del suggerimento, mai salvati sull'obiettivo.
- L'importo suggerito, una volta usato, resta fisso come qualsiasi altro obiettivo — nessun
  ricalcolo automatico ai cicli successivi in questa fase.
- La gestione P.IVA è esplicitamente fuori scope da questo piano.
- Ogni scrittura continua a seguire il pattern optimistic-UI/RLS-per-utente già stabilito
  nel resto dell'app — nessuna modifica a quel comportamento qui.

---

## Task 1: Generalizzare la frequenza da anni a mesi

**Files:**
- Create: `supabase/migrations/0002_recurring_frequency_months.sql`
- Modify: `src/lib/calculations/types.ts`
- Modify: `src/lib/calculations/accantonato.ts`
- Modify: `src/lib/types.ts`
- Modify: `src/lib/data/goals.ts`
- Test: `tests/calculations/accantonato.test.ts`
- Test: `tests/calculations/disponibile.test.ts`
- Test: `tests/data/goals.test.ts`
- Test: `tests/HomeDashboard.test.tsx`

**Interfaces:**
- Consumes: nessuno (rinomina interna a tipi/logica già esistenti).
- Produces: `GoalForCalc.frequenzaMesi` (era `frequenzaAnni`), `BudgetGoal.frequenzaMesi`,
  colonna DB `budget_goals.frequenza_mesi` (era `frequenza_anni`) — usati da Task 5.

Questo è un rename coordinato: tipi, logica di calcolo, layer dati e tutti i test che li
usano cambiano insieme, altrimenti il progetto non compila in nessuno stato intermedio.

- [ ] **Step 1: Scrivere la migrazione SQL**

Create `supabase/migrations/0002_recurring_frequency_months.sql`:

```sql
alter table public.budget_goals drop column frequenza_anni;
alter table public.budget_goals add column frequenza_mesi numeric;
```

Nel Dashboard Supabase, apri **SQL Editor**, incolla il contenuto del file e premi **Run**.
Non ci sono obiettivi ricorrenti reali salvati finora, quindi non serve convertire dati
esistenti.

- [ ] **Step 2: Aggiornare i tipi**

In `src/lib/calculations/types.ts`, rinomina il campo:

```ts
export interface GoalForCalc {
  importoTarget: number;
  modalita: 'bloccato' | 'dilazionato';
  stato: 'aperto' | 'chiuso' | 'scaduto';
  scadenza: string | null;
  createdAt: string;
  ricorrente: boolean;
  frequenzaMesi: number | null;
}
```

In `src/lib/types.ts`, rinomina lo stesso campo su `BudgetGoal`:

```ts
export interface BudgetGoal {
  id: string;
  nome: string;
  importoTarget: number;
  modalita: GoalModalita;
  scadenza: string | null;
  categoriaId: string | null;
  ricorrente: boolean;
  frequenzaMesi: number | null;
  stato: GoalStato;
  createdAt: string;
}
```

- [ ] **Step 3: Aggiornare la logica di calcolo**

Sostituisci `src/lib/calculations/accantonato.ts` con:

```ts
import { addMonths, differenceInCalendarMonths, parseISO } from 'date-fns';
import type { GoalForCalc } from './types';

export function nextOccurrence(scadenza: Date, frequenzaMesi: number, today: Date): Date {
  let occurrence = scadenza;
  while (occurrence < today) {
    occurrence = addMonths(occurrence, frequenzaMesi);
  }
  return occurrence;
}

export function computeAccantonatoFinora(goal: GoalForCalc, today: Date): number {
  if (goal.modalita === 'bloccato') {
    return goal.importoTarget;
  }

  if (!goal.scadenza) {
    throw new Error('Obiettivo dilazionato senza scadenza');
  }

  const scadenzaDate = parseISO(goal.scadenza);
  const createdAtDate = parseISO(goal.createdAt);

  let windowStart: Date;
  let windowEnd: Date;

  if (goal.ricorrente) {
    if (!(goal.frequenzaMesi && goal.frequenzaMesi > 0)) {
      throw new Error('Obiettivo ricorrente con frequenzaMesi non valida');
    }
    windowEnd = nextOccurrence(scadenzaDate, goal.frequenzaMesi, today);
    windowStart = addMonths(windowEnd, -goal.frequenzaMesi);
  } else {
    windowStart = createdAtDate;
    windowEnd = scadenzaDate;
  }

  const totalMonths = Math.max(1, differenceInCalendarMonths(windowEnd, windowStart));
  const elapsedMonthsRaw = differenceInCalendarMonths(today, windowStart);
  const elapsedMonths = Math.min(Math.max(elapsedMonthsRaw, 0), totalMonths);

  const quotaMensile = goal.importoTarget / totalMonths;
  return quotaMensile * elapsedMonths;
}
```

(Unica differenza dal file precedente: `addYears` → `addMonths`, `frequenzaAnni` →
`frequenzaMesi` ovunque. Nessun altro cambio di logica.)

- [ ] **Step 4: Aggiornare il layer dati**

Sostituisci `src/lib/data/goals.ts` con:

```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { BudgetGoal, GoalModalita } from '../types';

interface GoalRow {
  id: string;
  nome: string;
  importo_target: number;
  modalita: GoalModalita;
  scadenza: string | null;
  categoria_id: string | null;
  ricorrente: boolean;
  frequenza_mesi: number | null;
  stato: 'aperto' | 'chiuso' | 'scaduto';
  created_at: string;
}

function mapRow(row: GoalRow): BudgetGoal {
  return {
    id: row.id,
    nome: row.nome,
    importoTarget: row.importo_target,
    modalita: row.modalita,
    scadenza: row.scadenza,
    categoriaId: row.categoria_id,
    ricorrente: row.ricorrente,
    frequenzaMesi: row.frequenza_mesi,
    stato: row.stato,
    createdAt: row.created_at,
  };
}

export async function getOpenGoals(supabase: SupabaseClient): Promise<BudgetGoal[]> {
  const { data, error } = await supabase
    .from('budget_goals')
    .select(
      'id, nome, importo_target, modalita, scadenza, categoria_id, ricorrente, frequenza_mesi, stato, created_at'
    )
    .eq('stato', 'aperto')
    .order('scadenza', { ascending: true });

  if (error) throw error;
  return (data as GoalRow[]).map(mapRow);
}

export async function createGoal(
  supabase: SupabaseClient,
  input: {
    nome: string;
    importoTarget: number;
    modalita: GoalModalita;
    scadenza: string | null;
    categoriaId: string | null;
    ricorrente: boolean;
    frequenzaMesi: number | null;
  }
): Promise<BudgetGoal> {
  const { data, error } = await supabase
    .from('budget_goals')
    .insert({
      nome: input.nome,
      importo_target: input.importoTarget,
      modalita: input.modalita,
      scadenza: input.scadenza,
      categoria_id: input.categoriaId,
      ricorrente: input.ricorrente,
      frequenza_mesi: input.frequenzaMesi,
      stato: 'aperto',
    })
    .select(
      'id, nome, importo_target, modalita, scadenza, categoria_id, ricorrente, frequenza_mesi, stato, created_at'
    )
    .single();

  if (error) throw error;
  return mapRow(data as GoalRow);
}

export async function closeGoal(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from('budget_goals').update({ stato: 'chiuso' }).eq('id', id);
  if (error) throw error;
}
```

- [ ] **Step 5: Aggiornare tutti i test esistenti che referenziano `frequenzaAnni`**

In `tests/calculations/accantonato.test.ts`: sostituisci ogni `frequenzaAnni: null` con
`frequenzaMesi: null`. Nel test "per un obiettivo ricorrente ricalcola la finestra sul ciclo
corrente", nel test "lancia un errore se un obiettivo ricorrente ha frequenzaAnni pari a 0",
nel test "lancia un errore (senza andare in loop infinito) se frequenzaAnni è negativa", e
nel test di regressione TZ: sostituisci `frequenzaAnni: 1` con `frequenzaMesi: 12` (1 anno =
12 mesi, stesso identico risultato numerico atteso), `frequenzaAnni: 0` con
`frequenzaMesi: 0`, `frequenzaAnni: -1` con `frequenzaMesi: -1`. Rinomina anche i titoli dei
due test che lo citano esplicitamente ("... ha frequenzaMesi pari a 0", "... se
frequenzaMesi è negativa").

Nel blocco `describe('nextOccurrence', ...)`, il secondo test ("avanza di frequenzaAnni
finché la data non è nel futuro") chiama `nextOccurrence(new Date(2024, 6, 1), 1, ...)` con
`1` inteso come "1 anno" nella vecchia semantica. Cambia l'argomento da `1` a `12` (12 mesi =
1 anno, stesso risultato atteso `new Date(2026, 6, 1)`, nessun'altra modifica) e rinomina il
titolo in "avanza di frequenzaMesi finché la data non è nel futuro". Il primo test di questo
blocco non usa unità temporali significative (la data è già nel futuro) e non richiede
modifiche oltre a lasciare `1` come valore arbitrario.

In `tests/calculations/disponibile.test.ts`: sostituisci ogni `frequenzaAnni: null` con
`frequenzaMesi: null` (compaiono nei due array `goals` che usano `GoalForCalc`, nessun valore
numerico da ricalcolare dato che sono tutti `null`).

In `tests/data/goals.test.ts`: nell'oggetto `row` sostituisci `frequenza_anni: null` con
`frequenza_mesi: null`; nella chiamata `createGoal(supabase, {...})` sostituisci
`frequenzaAnni: null` con `frequenzaMesi: null`; nell'`expect(result).toEqual([...])` di
`getOpenGoals` sostituisci `frequenzaAnni: null` con `frequenzaMesi: null`.

In `tests/HomeDashboard.test.tsx`: sostituisci entrambe le occorrenze di
`frequenzaAnni: null` (nei due array di fixture `goals` e `goalsDilazionato`) con
`frequenzaMesi: null`.

- [ ] **Step 6: Eseguire l'intera suite e verificare che passi**

Run: `npm test`
Expected: PASS — tutti i test verdi, nessuna riduzione nel conteggio totale rispetto a prima
di questo task.

- [ ] **Step 7: Verificare il type-check**

Run: `npx tsc --noEmit`
Expected: nessun errore (conferma che non sono rimasti riferimenti a `frequenzaAnni` in
nessun file).

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/0002_recurring_frequency_months.sql src/lib/calculations/types.ts src/lib/calculations/accantonato.ts src/lib/types.ts src/lib/data/goals.ts tests/calculations/accantonato.test.ts tests/calculations/disponibile.test.ts tests/data/goals.test.ts tests/HomeDashboard.test.tsx
git commit -m "feat: generalize goal recurrence frequency from years to months"
```

---

## Task 2: Funzione di suggerimento importo dallo storico

**Files:**
- Create: `src/lib/calculations/suggestImportoFromHistory.ts`
- Test: `tests/calculations/suggestImportoFromHistory.test.ts`

**Interfaces:**
- Consumes: nessuno (funzione pura).
- Produces: `suggestImportoFromHistory(importiPassati: number[], marginePercent: number): number`
  — usata da Task 4.

- [ ] **Step 1: Scrivere i test**

Create `tests/calculations/suggestImportoFromHistory.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { suggestImportoFromHistory } from '@/lib/calculations/suggestImportoFromHistory';

describe('suggestImportoFromHistory', () => {
  it('calcola la media semplice quando il margine è 0', () => {
    expect(suggestImportoFromHistory([100, 110, 90], 0)).toBeCloseTo(100, 5);
  });

  it('applica il margine percentuale sopra la media', () => {
    // media = 100, +10% = 110
    expect(suggestImportoFromHistory([100, 110, 90], 10)).toBeCloseTo(110, 5);
  });

  it('funziona con un solo importo storico', () => {
    expect(suggestImportoFromHistory([60], 10)).toBeCloseTo(66, 5);
  });

  it('lancia un errore se la lista di importi passati è vuota', () => {
    expect(() => suggestImportoFromHistory([], 10)).toThrow();
  });
});
```

- [ ] **Step 2: Eseguire i test e verificare che falliscano**

Run: `npm test -- tests/calculations/suggestImportoFromHistory.test.ts`
Expected: FAIL — modulo `@/lib/calculations/suggestImportoFromHistory` non trovato.

- [ ] **Step 3: Implementare**

Create `src/lib/calculations/suggestImportoFromHistory.ts`:

```ts
export function suggestImportoFromHistory(
  importiPassati: number[],
  marginePercent: number
): number {
  if (importiPassati.length === 0) {
    throw new Error('Nessun importo storico su cui calcolare una media');
  }

  const media = importiPassati.reduce((sum, v) => sum + v, 0) / importiPassati.length;
  return media * (1 + marginePercent / 100);
}
```

- [ ] **Step 4: Eseguire i test e verificare che passino**

Run: `npm test -- tests/calculations/suggestImportoFromHistory.test.ts`
Expected: PASS — 4 test passati.

- [ ] **Step 5: Commit**

```bash
git add src/lib/calculations/suggestImportoFromHistory.ts tests/calculations/suggestImportoFromHistory.test.ts
git commit -m "feat: add history-based amount suggestion calculation"
```

---

## Task 3: Recupero importi storici per categoria

**Files:**
- Modify: `src/lib/data/transactions.ts`
- Modify: `tests/helpers/fakeSupabase.ts`
- Test: `tests/data/transactions.test.ts`

**Interfaces:**
- Consumes: `fakeSelectClient` da `tests/helpers/fakeSupabase.ts` (Task 10 del piano MVP
  originale).
- Produces: `getRecentTransactionAmounts(supabase: SupabaseClient, categoriaId: string, limite: number): Promise<number[]>`
  — usata da Task 4.

- [ ] **Step 1: Estendere il fake client di test**

In `tests/helpers/fakeSupabase.ts`, aggiungi il metodo `limit` a `fakeSelectClient` come
chiamata intermedia (non terminale, ritorna il builder) — non toccare nessun altro metodo
esistente:

```ts
export function fakeSelectClient(rows: unknown[]) {
  const builder: any = {
    select: () => builder,
    order: () => Promise.resolve({ data: rows, error: null }),
    eq: () => builder,
    single: () => Promise.resolve({ data: rows[0] ?? null, error: null }),
    limit: () => builder,
  };
  return { from: () => builder } as any;
}
```

- [ ] **Step 2: Scrivere i test**

Aggiungi a `tests/data/transactions.test.ts` (in fondo al file, dopo il blocco
`describe('getLastIncomeDate', ...)` esistente):

```ts
describe('getRecentTransactionAmounts', () => {
  it('ritorna gli importi delle transazioni più recenti per categoria', async () => {
    const supabase = fakeSelectClient([{ importo: 60 }, { importo: 55 }, { importo: 58 }]);
    const result = await getRecentTransactionAmounts(supabase, 'cat-luce', 3);
    expect(result).toEqual([60, 55, 58]);
  });

  it('ritorna un array vuoto se non ci sono transazioni in quella categoria', async () => {
    const supabase = fakeSelectClient([]);
    const result = await getRecentTransactionAmounts(supabase, 'cat-luce', 3);
    expect(result).toEqual([]);
  });
});
```

Aggiungi `getRecentTransactionAmounts` all'import esistente di `@/lib/data/transactions` in
cima al file.

- [ ] **Step 3: Eseguire i test e verificare che falliscano**

Run: `npm test -- tests/data/transactions.test.ts`
Expected: FAIL — `getRecentTransactionAmounts` non esportata dal modulo.

- [ ] **Step 4: Implementare**

Aggiungi in fondo a `src/lib/data/transactions.ts`:

```ts
export async function getRecentTransactionAmounts(
  supabase: SupabaseClient,
  categoriaId: string,
  limite: number
): Promise<number[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('importo')
    .eq('categoria_id', categoriaId)
    .eq('tipo', 'expense')
    .limit(limite)
    .order('data', { ascending: false });

  if (error) throw error;
  return (data as { importo: number }[]).map((row) => row.importo);
}
```

- [ ] **Step 5: Eseguire i test e verificare che passino**

Run: `npm test -- tests/data/transactions.test.ts`
Expected: PASS — 2 nuovi test passati, nessuna regressione sui test esistenti dello stesso
file.

- [ ] **Step 6: Eseguire l'intera suite per confermare che il nuovo metodo `limit` nel fake
      non abbia rotto nulla**

Run: `npm test`
Expected: PASS — tutti i test verdi.

- [ ] **Step 7: Commit**

```bash
git add src/lib/data/transactions.ts tests/helpers/fakeSupabase.ts tests/data/transactions.test.ts
git commit -m "feat: add getRecentTransactionAmounts for history-based suggestions"
```

---

## Task 4: Componente pannello di suggerimento

**Files:**
- Create: `src/app/goals/SuggestAmountPanel.tsx`
- Test: `tests/SuggestAmountPanel.test.tsx`

**Interfaces:**
- Consumes: `getRecentTransactionAmounts` (Task 3), `suggestImportoFromHistory` (Task 2),
  `createClient` da `src/lib/supabase/client.ts`, `formatEuro` da `src/lib/format.ts`.
- Produces: componente `SuggestAmountPanel` con props `{ categoriaId: string; onUseAmount: (importo: number) => void }`
  — usato da Task 5.

- [ ] **Step 1: Scrivere i test**

Create `tests/SuggestAmountPanel.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SuggestAmountPanel } from '@/app/goals/SuggestAmountPanel';

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({}),
}));

vi.mock('@/lib/data/transactions', () => ({
  getRecentTransactionAmounts: vi.fn(),
}));

import { getRecentTransactionAmounts } from '@/lib/data/transactions';

describe('SuggestAmountPanel', () => {
  it('mostra il messaggio quando non ci sono spese storiche nella categoria', async () => {
    vi.mocked(getRecentTransactionAmounts).mockResolvedValue([]);
    render(<SuggestAmountPanel categoriaId="cat-1" onUseAmount={vi.fn()} />);

    await waitFor(() => {
      expect(
        screen.getByText(
          'Non ci sono ancora abbastanza spese in questa categoria per calcolare una media.'
        )
      ).toBeInTheDocument();
    });
  });

  it("calcola e mostra l'importo suggerito, e lo passa a onUseAmount al click", async () => {
    vi.mocked(getRecentTransactionAmounts).mockResolvedValue([100, 110, 90]);
    const onUseAmount = vi.fn();
    render(<SuggestAmountPanel categoriaId="cat-1" onUseAmount={onUseAmount} />);

    // media = 100, margine default 10% => 110
    await waitFor(() => {
      expect(screen.getByText('110,00 €')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Usa questo importo'));
    expect(onUseAmount).toHaveBeenCalledWith(110);
  });
});
```

- [ ] **Step 2: Eseguire i test e verificare che falliscano**

Run: `npm test -- tests/SuggestAmountPanel.test.tsx`
Expected: FAIL — modulo `@/app/goals/SuggestAmountPanel` non trovato.

- [ ] **Step 3: Implementare**

Create `src/app/goals/SuggestAmountPanel.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getRecentTransactionAmounts } from '@/lib/data/transactions';
import { suggestImportoFromHistory } from '@/lib/calculations/suggestImportoFromHistory';
import { formatEuro } from '@/lib/format';

export function SuggestAmountPanel({
  categoriaId,
  onUseAmount,
}: {
  categoriaId: string;
  onUseAmount: (importo: number) => void;
}) {
  const [limite, setLimite] = useState('3');
  const [margine, setMargine] = useState('10');
  const [importi, setImporti] = useState<number[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const limiteNumerico = Number(limite);
    if (!limiteNumerico || limiteNumerico <= 0) return;

    let cancelled = false;
    setLoading(true);
    const supabase = createClient();
    getRecentTransactionAmounts(supabase, categoriaId, limiteNumerico).then((result) => {
      if (!cancelled) {
        setImporti(result);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [categoriaId, limite]);

  const margineNumerico = Number(margine);
  const suggerito =
    importi && importi.length > 0 && !Number.isNaN(margineNumerico)
      ? suggestImportoFromHistory(importi, margineNumerico)
      : null;

  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius-md)] bg-surface-muted p-4 text-sm">
      <div className="flex gap-3">
        <label className="flex flex-1 flex-col gap-1 text-xs font-medium text-muted">
          Quante spese passate
          <input
            aria-label="Quante spese passate"
            type="number"
            value={limite}
            onChange={(e) => setLimite(e.target.value)}
            className="rounded-[var(--radius-sm)] border border-black/5 bg-surface px-3 py-2 text-sm outline-none"
          />
        </label>
        <label className="flex flex-1 flex-col gap-1 text-xs font-medium text-muted">
          Margine %
          <input
            aria-label="Margine %"
            type="number"
            value={margine}
            onChange={(e) => setMargine(e.target.value)}
            className="rounded-[var(--radius-sm)] border border-black/5 bg-surface px-3 py-2 text-sm outline-none"
          />
        </label>
      </div>

      {loading && <p className="text-muted">Ricerca spese passate...</p>}

      {!loading && importi && importi.length === 0 && (
        <p className="text-muted">
          Non ci sono ancora abbastanza spese in questa categoria per calcolare una media.
        </p>
      )}

      {!loading && importi && importi.length > 0 && (
        <>
          <ul className="flex flex-col gap-1 text-muted">
            {importi.map((importo, i) => (
              <li key={i} className="flex justify-between">
                <span>Spesa passata {i + 1}</span>
                <span className="tabular-nums">{formatEuro(importo)}</span>
              </li>
            ))}
          </ul>
          {suggerito !== null && (
            <div className="flex items-center justify-between border-t border-black/5 pt-2 font-semibold">
              <span>Importo suggerito</span>
              <span className="tabular-nums">{formatEuro(suggerito)}</span>
            </div>
          )}
          <button
            type="button"
            disabled={suggerito === null}
            onClick={() => suggerito !== null && onUseAmount(Math.round(suggerito * 100) / 100)}
            className="rounded-[var(--radius-sm)] bg-brand py-2 text-sm font-semibold text-brand-foreground disabled:opacity-40"
          >
            Usa questo importo
          </button>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Eseguire i test e verificare che passino**

Run: `npm test -- tests/SuggestAmountPanel.test.tsx`
Expected: PASS — 2 test passati.

- [ ] **Step 5: Commit**

```bash
git add src/app/goals/SuggestAmountPanel.tsx tests/SuggestAmountPanel.test.tsx
git commit -m "feat: add SuggestAmountPanel component for history-based goal amounts"
```

---

## Task 5: Categoria e frequenza in mesi nel form di creazione obiettivo

**Files:**
- Modify: `src/app/goals/CreateGoalForm.tsx`
- Test: `tests/CreateGoalForm.test.tsx`

**Interfaces:**
- Consumes: `Category` da `src/lib/types.ts`, `SuggestAmountPanel` (Task 4), `GoalModalita`
  da `src/lib/types.ts`.
- Produces: `CreateGoalForm` con props estese `{ categories: Category[]; onSubmit: (payload: GoalPayload) => void }`
  dove `GoalPayload` include ora `categoriaId: string | null` e `frequenzaMesi: number | null`
  (era `frequenzaAnni`) — usato da Task 6.

- [ ] **Step 1: Aggiornare i test esistenti per includere la nuova prop `categories`**

In `tests/CreateGoalForm.test.tsx`, aggiungi `categories={[]}` a entrambe le chiamate
`render(<CreateGoalForm ... />)` esistenti:

```tsx
render(<CreateGoalForm categories={[]} onSubmit={onSubmit} />);
```

(in entrambi i test, sostituendo `render(<CreateGoalForm onSubmit={onSubmit} />)`).

- [ ] **Step 2: Aggiungere un test per la selezione della frequenza**

Aggiungi in fondo al file, dentro `describe('CreateGoalForm', ...)`:

```tsx
  it('invia frequenzaMesi corretta in base al preset selezionato', () => {
    const onSubmit = vi.fn();
    render(<CreateGoalForm categories={[]} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Tidal' } });
    fireEvent.change(screen.getByLabelText('Importo target'), { target: { value: '10' } });
    fireEvent.click(screen.getByLabelText('Ricorrente'));
    fireEvent.change(screen.getByLabelText('Frequenza'), { target: { value: '3' } });

    fireEvent.click(screen.getByText('Crea obiettivo'));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ ricorrente: true, frequenzaMesi: 3 })
    );
  });
```

Nota: il checkbox "Ricorrente" nel markup attuale non ha un `aria-label` esplicito, ma il
testo "Ricorrente" è dentro lo stesso `<label>` dell'input — `getByLabelText('Ricorrente')`
funziona già con l'associazione automatica label→input. Se il framework di test segnala che
non lo trova, verificare che il checkbox sia effettivamente annidato dentro l'elemento
`<label>` (lo è già nel codice attuale).

- [ ] **Step 3: Aggiungere un test per la comparsa del pannello di suggerimento**

Aggiungi anche questo test, con i mock necessari in cima al file (prima di
`describe('CreateGoalForm', ...)`, insieme agli import esistenti):

```tsx
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({}),
}));

vi.mock('@/lib/data/transactions', () => ({
  getRecentTransactionAmounts: vi.fn().mockResolvedValue([]),
}));
```

E il test:

```tsx
  it('mostra il pannello di suggerimento quando si seleziona una categoria', async () => {
    const categories = [
      { id: 'cat-1', nome: 'Bollette luce', tipo: 'expense' as const, colore: null, archiviata: false },
    ];
    render(<CreateGoalForm categories={categories} onSubmit={vi.fn()} />);

    expect(screen.queryByLabelText('Quante spese passate')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Categoria'), { target: { value: 'cat-1' } });

    expect(await screen.findByLabelText('Quante spese passate')).toBeInTheDocument();
  });
```

- [ ] **Step 4: Eseguire i test e verificare che i nuovi falliscano**

Run: `npm test -- tests/CreateGoalForm.test.tsx`
Expected: FAIL sui 3 nuovi/modificati test (prop `categories` mancante nel componente
attuale, nessun campo "Frequenza"/"Categoria" ancora presente).

- [ ] **Step 5: Implementare**

Sostituisci `src/app/goals/CreateGoalForm.tsx` con:

```tsx
'use client';

import { useState } from 'react';
import type { Category, GoalModalita } from '@/lib/types';
import { SuggestAmountPanel } from './SuggestAmountPanel';

interface GoalPayload {
  nome: string;
  importoTarget: number;
  modalita: GoalModalita;
  scadenza: string | null;
  categoriaId: string | null;
  ricorrente: boolean;
  frequenzaMesi: number | null;
}

const FREQUENZA_PRESETS = [
  { label: 'Mensile', mesi: 1 },
  { label: 'Trimestrale', mesi: 3 },
  { label: 'Semestrale', mesi: 6 },
  { label: 'Annuale', mesi: 12 },
] as const;

const fieldClass =
  'rounded-[var(--radius-md)] border border-black/5 bg-surface-muted px-4 py-3 text-base outline-none focus-visible:border-brand';

export function CreateGoalForm({
  categories,
  onSubmit,
}: {
  categories: Category[];
  onSubmit: (payload: GoalPayload) => void;
}) {
  const [nome, setNome] = useState('');
  const [importoTarget, setImportoTarget] = useState('');
  const [modalita, setModalita] = useState<GoalModalita>('bloccato');
  const [scadenza, setScadenza] = useState('');
  const [categoriaId, setCategoriaId] = useState<string | null>(null);
  const [ricorrente, setRicorrente] = useState(false);
  const [frequenzaPreset, setFrequenzaPreset] = useState<number | 'custom'>(1);
  const [frequenzaMesiCustom, setFrequenzaMesiCustom] = useState('2');

  const categorieDisponibili = categories.filter((c) => !c.archiviata && c.tipo === 'expense');

  const frequenzaMesi =
    frequenzaPreset === 'custom' ? Number(frequenzaMesiCustom) : frequenzaPreset;

  const isValid =
    nome.trim() !== '' &&
    importoTarget.trim() !== '' &&
    !Number.isNaN(Number(importoTarget)) &&
    (modalita === 'bloccato' || scadenza.trim() !== '');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;

    onSubmit({
      nome,
      importoTarget: Number(importoTarget),
      modalita,
      scadenza: scadenza.trim() === '' ? null : scadenza,
      categoriaId,
      ricorrente,
      frequenzaMesi: ricorrente ? frequenzaMesi : null,
    });

    setNome('');
    setImportoTarget('');
    setScadenza('');
    setCategoriaId(null);
    setRicorrente(false);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 rounded-[var(--radius-lg)] bg-surface p-5 shadow-[var(--shadow-card)]"
    >
      <label className="flex flex-col gap-1.5 text-sm font-medium text-muted">
        Nome
        <input
          aria-label="Nome"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Es. Viaggio, Telepass..."
          className={fieldClass}
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm font-medium text-muted">
        Categoria (opzionale)
        <select
          aria-label="Categoria"
          value={categoriaId ?? ''}
          onChange={(e) => setCategoriaId(e.target.value || null)}
          className={fieldClass}
        >
          <option value="">Nessuna</option>
          {categorieDisponibili.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>
      </label>

      {categoriaId && (
        <SuggestAmountPanel
          categoriaId={categoriaId}
          onUseAmount={(importo) => setImportoTarget(String(importo))}
        />
      )}

      <label className="flex flex-col gap-1.5 text-sm font-medium text-muted">
        Importo target
        <input
          aria-label="Importo target"
          type="number"
          inputMode="decimal"
          value={importoTarget}
          onChange={(e) => setImportoTarget(e.target.value)}
          placeholder="0"
          className={fieldClass}
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm font-medium text-muted">
        Modalità
        <select
          aria-label="Modalità"
          value={modalita}
          onChange={(e) => setModalita(e.target.value as GoalModalita)}
          className={fieldClass}
        >
          <option value="bloccato">Bloccato</option>
          <option value="dilazionato">Dilazionato</option>
        </select>
      </label>

      <label className="flex flex-col gap-1.5 text-sm font-medium text-muted">
        Scadenza {modalita === 'bloccato' && '(opzionale)'}
        <input
          aria-label="Scadenza"
          type="date"
          value={scadenza}
          onChange={(e) => setScadenza(e.target.value)}
          className={fieldClass}
        />
      </label>

      <label className="flex items-center gap-2.5 text-sm font-medium">
        <input
          type="checkbox"
          checked={ricorrente}
          onChange={(e) => setRicorrente(e.target.checked)}
          className="h-4 w-4 accent-brand"
        />
        Ricorrente
      </label>

      {ricorrente && (
        <div className="flex flex-col gap-1.5 text-sm font-medium text-muted">
          Frequenza
          <select
            aria-label="Frequenza"
            value={frequenzaPreset}
            onChange={(e) =>
              setFrequenzaPreset(e.target.value === 'custom' ? 'custom' : Number(e.target.value))
            }
            className={fieldClass}
          >
            {FREQUENZA_PRESETS.map((p) => (
              <option key={p.mesi} value={p.mesi}>
                {p.label}
              </option>
            ))}
            <option value="custom">Personalizzato</option>
          </select>
          {frequenzaPreset === 'custom' && (
            <input
              aria-label="Ogni quanti mesi"
              type="number"
              value={frequenzaMesiCustom}
              onChange={(e) => setFrequenzaMesiCustom(e.target.value)}
              placeholder="Numero di mesi"
              className={fieldClass}
            />
          )}
        </div>
      )}

      <button
        type="submit"
        disabled={!isValid}
        className="rounded-[var(--radius-md)] bg-brand py-3 text-sm font-semibold text-brand-foreground disabled:opacity-40"
      >
        Crea obiettivo
      </button>
    </form>
  );
}
```

- [ ] **Step 6: Eseguire i test e verificare che passino**

Run: `npm test -- tests/CreateGoalForm.test.tsx`
Expected: PASS — tutti i test del file (i 2 originali aggiornati + i 2 nuovi).

- [ ] **Step 7: Eseguire l'intera suite**

Run: `npm test`
Expected: PASS — nessuna regressione altrove.

- [ ] **Step 8: Commit**

```bash
git add src/app/goals/CreateGoalForm.tsx tests/CreateGoalForm.test.tsx
git commit -m "feat: add category link, monthly frequency presets, and amount suggestion to goal creation"
```

---

## Task 6: Collegare categoria e frequenza nella pagina Obiettivi

**Files:**
- Modify: `src/app/goals/page.tsx`

**Interfaces:**
- Consumes: `getCategories` da `src/lib/data/categories.ts` (Task 10 del piano MVP
  originale), `CreateGoalForm` (Task 5), `createGoal` (Task 1, firma aggiornata con
  `frequenzaMesi`).
- Produces: nessuna nuova interfaccia — collega quanto già costruito.

- [ ] **Step 1: Implementare**

Sostituisci `src/app/goals/page.tsx` con:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getOpenGoals, createGoal } from '@/lib/data/goals';
import { getCategories } from '@/lib/data/categories';
import { GoalsList } from './GoalsList';
import { CreateGoalForm } from './CreateGoalForm';
import type { BudgetGoal, Category, GoalModalita } from '@/lib/types';

export default function GoalsPage() {
  const [goals, setGoals] = useState<BudgetGoal[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  async function refresh() {
    const supabase = createClient();
    const [openGoals, cats] = await Promise.all([getOpenGoals(supabase), getCategories(supabase)]);
    setGoals(openGoals);
    setCategories(cats);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleCreate(payload: {
    nome: string;
    importoTarget: number;
    modalita: GoalModalita;
    scadenza: string | null;
    categoriaId: string | null;
    ricorrente: boolean;
    frequenzaMesi: number | null;
  }) {
    const supabase = createClient();
    await createGoal(supabase, payload);
    await refresh();
  }

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 p-5 pt-8">
      <h1 className="text-2xl font-bold">Obiettivi di budget</h1>
      <GoalsList goals={goals} />
      <h2 className="text-lg font-bold">Nuovo obiettivo</h2>
      <CreateGoalForm categories={categories} onSubmit={handleCreate} />
    </main>
  );
}
```

- [ ] **Step 2: Verificare build e type-check**

Run: `npx tsc --noEmit`
Expected: nessun errore.

Run: `npm run build`
Expected: build completata con successo, nessun errore.

- [ ] **Step 3: Eseguire l'intera suite una ultima volta**

Run: `npm test`
Expected: PASS — tutti i test verdi.

- [ ] **Step 4: Verifica manuale**

Dopo aver eseguito la migrazione SQL del Task 1 sul progetto Supabase reale, apri `/goals` da
loggato: crea una categoria "Bollette luce" (da `/categories`), registra 2-3 spese passate in
quella categoria (da "Aggiungi transazione"), poi crea un nuovo obiettivo ricorrente
collegato a quella categoria e verifica che il pannello di suggerimento mostri le spese
trovate e un importo suggerito coerente con la media + margine.

- [ ] **Step 5: Commit**

```bash
git add src/app/goals/page.tsx
git commit -m "feat: wire category selection and monthly frequency into the goals screen"
```
