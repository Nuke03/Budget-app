# App di Finanza Personale — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sostituire il Google Sheet "Weekly Expense + Income Tracker" con una web app PWA personale (Next.js + Supabase) che mostra in tempo reale quanto si può spendere in sicurezza, gestisce transazioni, categorie e obiettivi di budget (bloccati/dilazionati).

**Architecture:** Next.js (App Router, TypeScript) come frontend, deployato su Vercel; Supabase (Postgres + Auth) come backend, piano gratuito. La logica di calcolo finanziario (disponibile libero, accantonamento obiettivi, margine di spesa) vive in funzioni pure testate in isolamento, separate dall'accesso ai dati e dalla UI.

**Tech Stack:** Next.js 14+ (App Router, TypeScript), Tailwind CSS, Supabase (`@supabase/supabase-js`, `@supabase/ssr`), Vitest + Testing Library, date-fns, recharts, lucide-react.

**Spec:** [docs/superpowers/specs/2026-08-29-personal-finance-app-design.md](../specs/2026-08-29-personal-finance-app-design.md)

## Global Constraints

- Utente singolo: nessuna logica multi-utente o condivisione da nessuna parte.
- Costo totale €0/mese: solo piani free (Supabase free, Vercel free), nessuna API a pagamento.
- Saldo conti aggiornato solo manualmente: nessuna integrazione Open Banking/PSD2.
- Divisione spese con altre persone (tipo Tricount) è fuori scope: non implementarla.
- Reattività: ogni scrittura usa optimistic UI update (l'interfaccia si aggiorna subito, la
  scrittura su Supabase avviene in background).
- Niente supporto offline: è richiesta connettività al momento dell'azione, nessuna coda di
  sincronizzazione né service worker.
- Valuta: EUR, formattazione locale `it-IT`.
- PWA installabile su iPhone (Add to Home Screen) e utilizzabile identica da desktop, stesso
  URL e stessi dati.

---

## Task 1: Scaffolding del progetto Next.js

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.mjs`, `tailwind.config.ts`, `postcss.config.js`, `vitest.config.ts`, `src/app/layout.tsx`, `src/app/globals.css`, `src/app/page.tsx`, `.gitignore`, `.env.local.example`
- Test: `tests/smoke.test.ts`

**Interfaces:**
- Produces: convenzione di path alias `@/*` → `src/*` (usata da tutti i task successivi).

- [ ] **Step 1: Creare il progetto Next.js con TypeScript e Tailwind**

```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --no-turbopack
```

Rispondere "No" a eventuali domande su Next.js router già implicite nei flag sopra.

- [ ] **Step 2: Installare le dipendenze del progetto**

```bash
npm install @supabase/supabase-js @supabase/ssr date-fns recharts lucide-react
npm install -D vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom jsdom
```

- [ ] **Step 3: Configurare Vitest**

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

Create `vitest.setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';
```

Add to `package.json` scripts:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Scrivere un test di fumo per verificare che Vitest funzioni**

Create `tests/smoke.test.ts`:

```ts
import { describe, it, expect } from 'vitest';

describe('smoke test', () => {
  it('confirms the test runner works', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: Eseguire il test e verificare che passi**

Run: `npm test`
Expected: PASS — `1 passed`

- [ ] **Step 6: Creare il file di esempio per le variabili d'ambiente**

Create `.env.local.example`:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

Verify `.gitignore` contiene già `.env*.local` (aggiunto automaticamente da create-next-app).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js project with Tailwind and Vitest"
```

---

## Task 2: Progetto Supabase e client di connessione

**Files:**
- Create: `src/lib/supabase/client.ts`, `src/lib/supabase/server.ts`, `src/middleware.ts`

**Interfaces:**
- Produces: `createClient()` (browser, da `src/lib/supabase/client.ts`) e `createClient()` (server/async, da `src/lib/supabase/server.ts`), entrambi ritornano un `SupabaseClient` tipizzato con le variabili d'ambiente `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

- [ ] **Step 1: Creare il progetto Supabase (azione manuale)**

Vai su https://supabase.com, crea un account gratuito e un nuovo progetto (piano Free).
Da **Project Settings → API**, copia:
- `Project URL` → in `.env.local` come `NEXT_PUBLIC_SUPABASE_URL`
- `anon public` key → in `.env.local` come `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `service_role` key (segreta, mai esposta al client) → in `.env.local` come `SUPABASE_SERVICE_ROLE_KEY` (serve solo per lo script di migrazione dati del Task 21)

Crea `.env.local` (non committato) copiando `.env.local.example` e incollando questi valori.

- [ ] **Step 2: Creare il client Supabase per il browser**

Create `src/lib/supabase/client.ts`:

```ts
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

- [ ] **Step 3: Creare il client Supabase per il server (Server Components/Route Handlers)**

Create `src/lib/supabase/server.ts`:

```ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // chiamato da un Server Component senza cookie store mutabile:
            // il middleware si occupa di rinfrescare la sessione.
          }
        },
      },
    }
  );
}
```

- [ ] **Step 4: Creare il middleware che protegge le route e rinfresca la sessione**

Create `src/middleware.ts`:

```ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isLoginPage = request.nextUrl.pathname.startsWith('/login');

  if (!user && !isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.json|icons).*)'],
};
```

- [ ] **Step 5: Verifica manuale**

Run: `npm run dev`, apri `http://localhost:3000`.
Expected: reindirizzamento a `/login` (che non esiste ancora, quindi mostrerà il 404 di Next.js — è atteso finché non viene creato nel Task 12). Nessun errore in console relativo a variabili d'ambiente mancanti.

- [ ] **Step 6: Commit**

```bash
git add src/lib/supabase src/middleware.ts .env.local.example
git commit -m "feat: wire up Supabase browser/server clients and auth middleware"
```

---

## Task 3: Schema del database

**Files:**
- Create: `supabase/migrations/0001_init.sql`

**Interfaces:**
- Produces: tabelle Postgres `accounts`, `categories`, `budget_goals`, `transactions` con le colonne usate da tutti i task di data-access successivi (Task 10, 11, 21).

- [ ] **Step 1: Scrivere la migrazione SQL**

Create `supabase/migrations/0001_init.sql`:

```sql
create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  saldo_attuale numeric not null default 0,
  conta_in_disponibile boolean not null default true,
  target_saldo numeric,
  created_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  tipo text not null check (tipo in ('expense', 'income')),
  colore text,
  archiviata boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.budget_goals (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  importo_target numeric not null,
  modalita text not null check (modalita in ('bloccato', 'dilazionato')),
  scadenza date,
  categoria_id uuid references public.categories(id) on delete set null,
  ricorrente boolean not null default false,
  frequenza_anni numeric,
  stato text not null default 'aperto' check (stato in ('aperto', 'chiuso', 'scaduto')),
  created_at timestamptz not null default now(),
  constraint dilazionato_richiede_scadenza check (
    modalita <> 'dilazionato' or scadenza is not null
  )
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('expense', 'income')),
  importo numeric not null,
  data date not null,
  categoria_id uuid references public.categories(id) on delete set null,
  account_id uuid references public.accounts(id) on delete set null,
  goal_id uuid references public.budget_goals(id) on delete set null,
  descrizione text not null default '',
  nota text,
  created_at timestamptz not null default now()
);

alter table public.accounts enable row level security;
alter table public.categories enable row level security;
alter table public.budget_goals enable row level security;
alter table public.transactions enable row level security;

create policy "authenticated_full_access" on public.accounts
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

create policy "authenticated_full_access" on public.categories
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

create policy "authenticated_full_access" on public.budget_goals
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

create policy "authenticated_full_access" on public.transactions
  for all using (auth.uid() is not null) with check (auth.uid() is not null);
```

- [ ] **Step 2: Eseguire la migrazione su Supabase**

Nel Dashboard Supabase, apri **SQL Editor**, incolla il contenuto del file e premi **Run**.

- [ ] **Step 3: Verifica manuale**

Nel Dashboard Supabase, apri **Table Editor**.
Expected: sono presenti le 4 tabelle `accounts`, `categories`, `budget_goals`, `transactions`, ciascuna con RLS abilitata (icona lucchetto verde).

- [ ] **Step 4: Creare il primo (e unico) utente**

Nel Dashboard Supabase, apri **Authentication → Users → Add user**, crea l'utente con la tua email e una password. Questo sarà l'unico account dell'app.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0001_init.sql
git commit -m "feat: add initial database schema with RLS policies"
```

---

## Task 4: Tipi di dominio

**Files:**
- Create: `src/lib/types.ts`

**Interfaces:**
- Consumes: nessuno.
- Produces: `Account`, `Category`, `BudgetGoal`, `Transaction` e i relativi union type (`CategoriaTipo`, `GoalModalita`, `GoalStato`, `TransactionTipo`), usati da ogni task successivo che tocca dati.

- [ ] **Step 1: Definire i tipi**

Create `src/lib/types.ts`:

```ts
export type CategoriaTipo = 'expense' | 'income';
export type GoalModalita = 'bloccato' | 'dilazionato';
export type GoalStato = 'aperto' | 'chiuso' | 'scaduto';
export type TransactionTipo = 'expense' | 'income';

export interface Account {
  id: string;
  nome: string;
  saldoAttuale: number;
  contaInDisponibile: boolean;
  targetSaldo: number | null;
}

export interface Category {
  id: string;
  nome: string;
  tipo: CategoriaTipo;
  colore: string | null;
  archiviata: boolean;
}

export interface BudgetGoal {
  id: string;
  nome: string;
  importoTarget: number;
  modalita: GoalModalita;
  scadenza: string | null;
  categoriaId: string | null;
  ricorrente: boolean;
  frequenzaAnni: number | null;
  stato: GoalStato;
  createdAt: string;
}

export interface Transaction {
  id: string;
  tipo: TransactionTipo;
  importo: number;
  data: string;
  categoriaId: string | null;
  accountId: string | null;
  goalId: string | null;
  descrizione: string;
  nota: string | null;
  createdAt: string;
}
```

- [ ] **Step 2: Verificare che il progetto compili**

Run: `npx tsc --noEmit`
Expected: nessun errore.

- [ ] **Step 3: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat: add domain types for accounts, categories, goals, transactions"
```

---

## Task 5: Utility di formattazione

**Files:**
- Create: `src/lib/format.ts`
- Test: `tests/format.test.ts`

**Interfaces:**
- Produces: `formatEuro(value: number): string`, `formatDateIt(date: Date | string): string`, usate da tutte le schermate (Task 13-18).

- [ ] **Step 1: Scrivere i test**

Create `tests/format.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { formatEuro, formatDateIt } from '@/lib/format';

describe('formatEuro', () => {
  it('formats a positive amount as Italian euros', () => {
    expect(formatEuro(1234.5)).toBe('1.234,50 €');
  });

  it('formats zero', () => {
    expect(formatEuro(0)).toBe('0,00 €');
  });

  it('formats negative amounts with a leading minus', () => {
    expect(formatEuro(-42)).toBe('-42,00 €');
  });
});

describe('formatDateIt', () => {
  it('formats a Date as gg/mm/aaaa', () => {
    expect(formatDateIt(new Date(2026, 10, 27))).toBe('27/11/2026');
  });

  it('formats an ISO date string', () => {
    expect(formatDateIt('2026-01-05')).toBe('05/01/2026');
  });
});
```

- [ ] **Step 2: Eseguire i test e verificare che falliscano**

Run: `npm test -- tests/format.test.ts`
Expected: FAIL — `Cannot find module '@/lib/format'`

- [ ] **Step 3: Implementare le utility**

Create `src/lib/format.ts`:

```ts
export function formatEuro(value: number): string {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
    currencyDisplay: 'symbol',
  })
    .format(value)
    .replace('€', '')
    .trim()
    .concat(' €')
    .replace(/^-\s*/, '-')
    .replace(/^(-?[\d.,]+) €$/, '$1 €');
}

export function formatDateIt(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
}
```

- [ ] **Step 4: Eseguire i test e verificare che passino**

Run: `npm test -- tests/format.test.ts`
Expected: PASS — 5 test passati. Se `formatEuro` non produce esattamente `1.234,50 €`/`-42,00 €`, semplificare l'implementazione a:

```ts
export function formatEuro(value: number): string {
  const formatted = new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
  }).format(value);
  return formatted.replace(/ /g, ' ');
}
```

(la sostituzione dello spazio non separabile è necessaria perché `Intl.NumberFormat` con locale `it-IT` inserisce U+00A0 prima del simbolo `€`, che altrimenti fallisce i confronti stringa nei test).

- [ ] **Step 5: Commit**

```bash
git add src/lib/format.ts tests/format.test.ts
git commit -m "feat: add EUR and Italian date formatting utilities"
```

---

## Task 6: Calcolo dell'accantonamento degli obiettivi

**Files:**
- Create: `src/lib/calculations/types.ts`, `src/lib/calculations/accantonato.ts`
- Test: `tests/calculations/accantonato.test.ts`

**Interfaces:**
- Consumes: nessuno (funzioni pure).
- Produces: `GoalForCalc` (tipo), `nextOccurrence(scadenza: Date, frequenzaAnni: number, today: Date): Date`, `computeAccantonatoFinora(goal: GoalForCalc, today: Date): number` — usate da Task 7.

- [ ] **Step 1: Definire il tipo di input per i calcoli**

Create `src/lib/calculations/types.ts`:

```ts
export interface AccountBalance {
  saldoAttuale: number;
  contaInDisponibile: boolean;
}

export interface GoalForCalc {
  importoTarget: number;
  modalita: 'bloccato' | 'dilazionato';
  stato: 'aperto' | 'chiuso' | 'scaduto';
  scadenza: string | null;
  createdAt: string;
  ricorrente: boolean;
  frequenzaAnni: number | null;
}
```

- [ ] **Step 2: Scrivere i test**

Create `tests/calculations/accantonato.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { computeAccantonatoFinora, nextOccurrence } from '@/lib/calculations/accantonato';
import type { GoalForCalc } from '@/lib/calculations/types';

describe('computeAccantonatoFinora', () => {
  it('riserva subito l\'intero importo per un obiettivo bloccato', () => {
    const goal: GoalForCalc = {
      importoTarget: 130,
      modalita: 'bloccato',
      stato: 'aperto',
      scadenza: null,
      createdAt: '2026-01-01',
      ricorrente: false,
      frequenzaAnni: null,
    };

    expect(computeAccantonatoFinora(goal, new Date(2026, 0, 2))).toBe(130);
  });

  it('accantona in modo lineare un obiettivo dilazionato non ricorrente', () => {
    const goal: GoalForCalc = {
      importoTarget: 300,
      modalita: 'dilazionato',
      stato: 'aperto',
      scadenza: '2026-11-27',
      createdAt: '2026-01-27',
      ricorrente: false,
      frequenzaAnni: null,
    };

    // 10 mesi totali (gen->nov), 5 mesi trascorsi (gen->giu) => metà dell'importo
    expect(computeAccantonatoFinora(goal, new Date(2026, 5, 27))).toBeCloseTo(150, 5);
  });

  it('non supera mai l\'importo target anche a scadenza passata', () => {
    const goal: GoalForCalc = {
      importoTarget: 300,
      modalita: 'dilazionato',
      scadenza: '2026-11-27',
      stato: 'aperto',
      createdAt: '2026-01-27',
      ricorrente: false,
      frequenzaAnni: null,
    };

    expect(computeAccantonatoFinora(goal, new Date(2027, 5, 27))).toBeCloseTo(300, 5);
  });

  it('per un obiettivo ricorrente ricalcola la finestra sul ciclo corrente', () => {
    const goal: GoalForCalc = {
      importoTarget: 160,
      modalita: 'dilazionato',
      scadenza: '2025-07-01',
      stato: 'aperto',
      createdAt: '2024-07-01',
      ricorrente: true,
      frequenzaAnni: 1,
    };

    // prossima occorrenza: 2026-07-01, finestra 2025-07-01 -> 2026-07-01 (12 mesi)
    // oggi 2026-06-01: 11 mesi trascorsi su 12 => 160 * 11/12
    expect(computeAccantonatoFinora(goal, new Date(2026, 5, 1))).toBeCloseTo((160 * 11) / 12, 5);
  });

  it('lancia un errore se un obiettivo dilazionato non ha scadenza', () => {
    const goal: GoalForCalc = {
      importoTarget: 100,
      modalita: 'dilazionato',
      scadenza: null,
      stato: 'aperto',
      createdAt: '2026-01-01',
      ricorrente: false,
      frequenzaAnni: null,
    };

    expect(() => computeAccantonatoFinora(goal, new Date(2026, 5, 1))).toThrow();
  });
});

describe('nextOccurrence', () => {
  it('non muove la data se è già nel futuro', () => {
    const result = nextOccurrence(new Date(2027, 0, 1), 1, new Date(2026, 5, 1));
    expect(result).toEqual(new Date(2027, 0, 1));
  });

  it('avanza di frequenzaAnni finché la data non è nel futuro', () => {
    const result = nextOccurrence(new Date(2024, 6, 1), 1, new Date(2026, 5, 1));
    expect(result).toEqual(new Date(2026, 6, 1));
  });
});
```

- [ ] **Step 3: Eseguire i test e verificare che falliscano**

Run: `npm test -- tests/calculations/accantonato.test.ts`
Expected: FAIL — modulo `@/lib/calculations/accantonato` non trovato.

- [ ] **Step 4: Implementare la logica**

Create `src/lib/calculations/accantonato.ts`:

```ts
import { addYears, differenceInCalendarMonths } from 'date-fns';
import type { GoalForCalc } from './types';

export function nextOccurrence(scadenza: Date, frequenzaAnni: number, today: Date): Date {
  let occurrence = scadenza;
  while (occurrence < today) {
    occurrence = addYears(occurrence, frequenzaAnni);
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

  const scadenzaDate = new Date(goal.scadenza);
  const createdAtDate = new Date(goal.createdAt);

  let windowStart: Date;
  let windowEnd: Date;

  if (goal.ricorrente && goal.frequenzaAnni) {
    windowEnd = nextOccurrence(scadenzaDate, goal.frequenzaAnni, today);
    windowStart = addYears(windowEnd, -goal.frequenzaAnni);
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

- [ ] **Step 5: Eseguire i test e verificare che passino**

Run: `npm test -- tests/calculations/accantonato.test.ts`
Expected: PASS — 7 test passati.

- [ ] **Step 6: Commit**

```bash
git add src/lib/calculations/types.ts src/lib/calculations/accantonato.ts tests/calculations/accantonato.test.ts
git commit -m "feat: implement bloccato/dilazionato goal accrual calculation"
```

---

## Task 7: Calcolo del disponibile libero

**Files:**
- Create: `src/lib/calculations/disponibile.ts`
- Test: `tests/calculations/disponibile.test.ts`

**Interfaces:**
- Consumes: `computeAccantonatoFinora` da `src/lib/calculations/accantonato.ts` (Task 6); `AccountBalance`, `GoalForCalc` da `src/lib/calculations/types.ts` (Task 6).
- Produces: `computeDisponibileLibero(accounts: AccountBalance[], goals: GoalForCalc[], today: Date): number` — usata da Task 13 (Home dashboard).

- [ ] **Step 1: Scrivere i test**

Create `tests/calculations/disponibile.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { computeDisponibileLibero } from '@/lib/calculations/disponibile';
import type { AccountBalance, GoalForCalc } from '@/lib/calculations/types';

describe('computeDisponibileLibero', () => {
  it('somma solo i conti che contano nel disponibile', () => {
    const accounts: AccountBalance[] = [
      { saldoAttuale: 1000, contaInDisponibile: true },
      { saldoAttuale: 5000, contaInDisponibile: false }, // fondo emergenza, escluso
    ];

    expect(computeDisponibileLibero(accounts, [], new Date(2026, 5, 1))).toBe(1000);
  });

  it('sottrae gli obiettivi bloccati aperti per intero', () => {
    const accounts: AccountBalance[] = [{ saldoAttuale: 1000, contaInDisponibile: true }];
    const goals: GoalForCalc[] = [
      {
        importoTarget: 130,
        modalita: 'bloccato',
        stato: 'aperto',
        scadenza: null,
        createdAt: '2026-01-01',
        ricorrente: false,
        frequenzaAnni: null,
      },
    ];

    expect(computeDisponibileLibero(accounts, goals, new Date(2026, 5, 1))).toBe(870);
  });

  it('ignora gli obiettivi non aperti', () => {
    const accounts: AccountBalance[] = [{ saldoAttuale: 1000, contaInDisponibile: true }];
    const goals: GoalForCalc[] = [
      {
        importoTarget: 130,
        modalita: 'bloccato',
        stato: 'chiuso',
        scadenza: null,
        createdAt: '2026-01-01',
        ricorrente: false,
        frequenzaAnni: null,
      },
    ];

    expect(computeDisponibileLibero(accounts, goals, new Date(2026, 5, 1))).toBe(1000);
  });

  it('combina più conti e più obiettivi di modalità diverse', () => {
    const accounts: AccountBalance[] = [
      { saldoAttuale: 600, contaInDisponibile: true },
      { saldoAttuale: 400, contaInDisponibile: true },
    ];
    const goals: GoalForCalc[] = [
      {
        importoTarget: 130,
        modalita: 'bloccato',
        stato: 'aperto',
        scadenza: null,
        createdAt: '2026-01-01',
        ricorrente: false,
        frequenzaAnni: null,
      },
      {
        importoTarget: 300,
        modalita: 'dilazionato',
        stato: 'aperto',
        scadenza: '2026-11-27',
        createdAt: '2026-01-27',
        ricorrente: false,
        frequenzaAnni: null,
      },
    ];

    // saldo: 1000, bloccato: -130, dilazionato al 2026-06-27: -150 (metà di 300)
    expect(computeDisponibileLibero(accounts, goals, new Date(2026, 5, 27))).toBeCloseTo(
      720,
      5
    );
  });
});
```

- [ ] **Step 2: Eseguire i test e verificare che falliscano**

Run: `npm test -- tests/calculations/disponibile.test.ts`
Expected: FAIL — modulo non trovato.

- [ ] **Step 3: Implementare**

Create `src/lib/calculations/disponibile.ts`:

```ts
import { computeAccantonatoFinora } from './accantonato';
import type { AccountBalance, GoalForCalc } from './types';

export function computeDisponibileLibero(
  accounts: AccountBalance[],
  goals: GoalForCalc[],
  today: Date
): number {
  const saldoDisponibile = accounts
    .filter((a) => a.contaInDisponibile)
    .reduce((sum, a) => sum + a.saldoAttuale, 0);

  const riservato = goals
    .filter((g) => g.stato === 'aperto')
    .reduce((sum, g) => sum + computeAccantonatoFinora(g, today), 0);

  return saldoDisponibile - riservato;
}
```

- [ ] **Step 4: Eseguire i test e verificare che passino**

Run: `npm test -- tests/calculations/disponibile.test.ts`
Expected: PASS — 4 test passati.

- [ ] **Step 5: Commit**

```bash
git add src/lib/calculations/disponibile.ts tests/calculations/disponibile.test.ts
git commit -m "feat: implement global disponibile libero calculation"
```

---

## Task 8: Stima della data target

**Files:**
- Create: `src/lib/calculations/stimaDataTarget.ts`
- Test: `tests/calculations/stimaDataTarget.test.ts`

**Interfaces:**
- Consumes: nessuno.
- Produces: `stimaDataTarget(ultimaEntrata: Date | null, today: Date): Date` — usata da Task 13 (Home dashboard) come default sovrascrivibile dall'utente.

- [ ] **Step 1: Scrivere i test**

Create `tests/calculations/stimaDataTarget.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { stimaDataTarget } from '@/lib/calculations/stimaDataTarget';

describe('stimaDataTarget', () => {
  it('usa il mese successivo se non ci sono entrate storiche', () => {
    const result = stimaDataTarget(null, new Date(2026, 5, 10));
    expect(result).toEqual(new Date(2026, 6, 10));
  });

  it('rimane nel mese corrente se il giorno dell\'ultima entrata non è ancora passato', () => {
    const ultimaEntrata = new Date(2026, 4, 27); // 27 del mese scorso
    const result = stimaDataTarget(ultimaEntrata, new Date(2026, 5, 10));
    expect(result).toEqual(new Date(2026, 5, 27));
  });

  it('passa al mese successivo se il giorno dell\'ultima entrata è già passato questo mese', () => {
    const ultimaEntrata = new Date(2026, 4, 27);
    const result = stimaDataTarget(ultimaEntrata, new Date(2026, 5, 30));
    expect(result).toEqual(new Date(2026, 6, 27));
  });
});
```

- [ ] **Step 2: Eseguire i test e verificare che falliscano**

Run: `npm test -- tests/calculations/stimaDataTarget.test.ts`
Expected: FAIL — modulo non trovato.

- [ ] **Step 3: Implementare**

Create `src/lib/calculations/stimaDataTarget.ts`:

```ts
import { addMonths, setDate } from 'date-fns';

export function stimaDataTarget(ultimaEntrata: Date | null, today: Date): Date {
  if (!ultimaEntrata) {
    return addMonths(today, 1);
  }

  const giorno = ultimaEntrata.getDate();
  let candidate = setDate(today, giorno);

  if (candidate <= today) {
    candidate = setDate(addMonths(today, 1), giorno);
  }

  return candidate;
}
```

- [ ] **Step 4: Eseguire i test e verificare che passino**

Run: `npm test -- tests/calculations/stimaDataTarget.test.ts`
Expected: PASS — 3 test passati.

- [ ] **Step 5: Commit**

```bash
git add src/lib/calculations/stimaDataTarget.ts tests/calculations/stimaDataTarget.test.ts
git commit -m "feat: estimate next income date for the safe-spend runway"
```

---

## Task 9: Calcolo del margine di spesa giornaliero

**Files:**
- Create: `src/lib/calculations/margine.ts`
- Test: `tests/calculations/margine.test.ts`

**Interfaces:**
- Consumes: nessuno.
- Produces: `computeMargineGiornaliero(disponibileLibero: number, dataTarget: Date, today: Date): number` — usata da Task 13 (Home dashboard).

- [ ] **Step 1: Scrivere i test**

Create `tests/calculations/margine.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { computeMargineGiornaliero } from '@/lib/calculations/margine';

describe('computeMargineGiornaliero', () => {
  it('divide il disponibile per i giorni rimanenti', () => {
    const result = computeMargineGiornaliero(1000, new Date(2026, 5, 11), new Date(2026, 5, 1));
    expect(result).toBe(100);
  });

  it('usa almeno 1 giorno quando la data target è oggi o nel passato', () => {
    const today = new Date(2026, 5, 1);
    expect(computeMargineGiornaliero(500, today, today)).toBe(500);
    expect(computeMargineGiornaliero(500, new Date(2026, 4, 20), today)).toBe(500);
  });
});
```

- [ ] **Step 2: Eseguire i test e verificare che falliscano**

Run: `npm test -- tests/calculations/margine.test.ts`
Expected: FAIL — modulo non trovato.

- [ ] **Step 3: Implementare**

Create `src/lib/calculations/margine.ts`:

```ts
import { differenceInCalendarDays } from 'date-fns';

export function computeMargineGiornaliero(
  disponibileLibero: number,
  dataTarget: Date,
  today: Date
): number {
  const giorniRimanenti = Math.max(1, differenceInCalendarDays(dataTarget, today));
  return disponibileLibero / giorniRimanenti;
}
```

- [ ] **Step 4: Eseguire i test e verificare che passino**

Run: `npm test -- tests/calculations/margine.test.ts`
Expected: PASS — 2 test passati.

- [ ] **Step 5: Commit**

```bash
git add src/lib/calculations/margine.ts tests/calculations/margine.test.ts
git commit -m "feat: implement daily safe-spend margin calculation"
```

---

## Task 10: Data access — conti e categorie

**Files:**
- Create: `src/lib/data/accounts.ts`, `src/lib/data/categories.ts`, `tests/helpers/fakeSupabase.ts`
- Test: `tests/data/accounts.test.ts`, `tests/data/categories.test.ts`

**Interfaces:**
- Consumes: `Account`, `Category` da `src/lib/types.ts` (Task 4).
- Produces: `getAccounts`, `updateAccountBalance`, `createAccount` (`src/lib/data/accounts.ts`); `getCategories`, `createCategory`, `archiveCategory` (`src/lib/data/categories.ts`) — usate da Task 13, 16, 17.

- [ ] **Step 1: Creare l'helper di test per un client Supabase finto**

Create `tests/helpers/fakeSupabase.ts`:

```ts
export function fakeSelectClient(rows: unknown[]) {
  const builder: any = {
    select: () => builder,
    order: () => Promise.resolve({ data: rows, error: null }),
    eq: () => builder,
    single: () => Promise.resolve({ data: rows[0] ?? null, error: null }),
  };
  return { from: () => builder } as any;
}

export function fakeMutationClient(returnedRow: unknown) {
  const builder: any = {
    update: () => builder,
    insert: () => builder,
    delete: () => builder,
    eq: () => Promise.resolve({ data: null, error: null }),
    select: () => builder,
    single: () => Promise.resolve({ data: returnedRow, error: null }),
  };
  return { from: () => builder } as any;
}
```

- [ ] **Step 2: Scrivere i test per `accounts`**

Create `tests/data/accounts.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { getAccounts, createAccount, updateAccountBalance } from '@/lib/data/accounts';
import { fakeSelectClient, fakeMutationClient } from '../helpers/fakeSupabase';

describe('getAccounts', () => {
  it('mappa le righe snake_case in oggetti Account camelCase', async () => {
    const supabase = fakeSelectClient([
      {
        id: '1',
        nome: 'Conto corrente',
        saldo_attuale: 500,
        conta_in_disponibile: true,
        target_saldo: null,
      },
    ]);

    const result = await getAccounts(supabase);

    expect(result).toEqual([
      { id: '1', nome: 'Conto corrente', saldoAttuale: 500, contaInDisponibile: true, targetSaldo: null },
    ]);
  });
});

describe('createAccount', () => {
  it('inserisce e ritorna il conto mappato', async () => {
    const supabase = fakeMutationClient({
      id: '2',
      nome: 'Fondo emergenza',
      saldo_attuale: 0,
      conta_in_disponibile: false,
      target_saldo: 3000,
    });

    const result = await createAccount(supabase, {
      nome: 'Fondo emergenza',
      saldoAttuale: 0,
      contaInDisponibile: false,
      targetSaldo: 3000,
    });

    expect(result).toEqual({
      id: '2',
      nome: 'Fondo emergenza',
      saldoAttuale: 0,
      contaInDisponibile: false,
      targetSaldo: 3000,
    });
  });
});

describe('updateAccountBalance', () => {
  it('non lancia errori quando la scrittura va a buon fine', async () => {
    const supabase = fakeMutationClient(null);
    await expect(updateAccountBalance(supabase, '1', 750)).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 3: Scrivere i test per `categories`**

Create `tests/data/categories.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { getCategories, createCategory, archiveCategory } from '@/lib/data/categories';
import { fakeSelectClient, fakeMutationClient } from '../helpers/fakeSupabase';

describe('getCategories', () => {
  it('mappa le righe in oggetti Category', async () => {
    const supabase = fakeSelectClient([
      { id: '1', nome: 'Groceries', tipo: 'expense', colore: '#22c55e', archiviata: false },
    ]);

    const result = await getCategories(supabase);

    expect(result).toEqual([
      { id: '1', nome: 'Groceries', tipo: 'expense', colore: '#22c55e', archiviata: false },
    ]);
  });
});

describe('createCategory', () => {
  it('inserisce e ritorna la categoria mappata', async () => {
    const supabase = fakeMutationClient({
      id: '2',
      nome: 'Viaggi',
      tipo: 'expense',
      colore: null,
      archiviata: false,
    });

    const result = await createCategory(supabase, { nome: 'Viaggi', tipo: 'expense', colore: null });

    expect(result.nome).toBe('Viaggi');
  });
});

describe('archiveCategory', () => {
  it('non lancia errori quando la scrittura va a buon fine', async () => {
    const supabase = fakeMutationClient(null);
    await expect(archiveCategory(supabase, '1')).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 4: Eseguire i test e verificare che falliscano**

Run: `npm test -- tests/data/accounts.test.ts tests/data/categories.test.ts`
Expected: FAIL — moduli `@/lib/data/accounts` e `@/lib/data/categories` non trovati.

- [ ] **Step 5: Implementare `accounts.ts`**

Create `src/lib/data/accounts.ts`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Account } from '../types';

interface AccountRow {
  id: string;
  nome: string;
  saldo_attuale: number;
  conta_in_disponibile: boolean;
  target_saldo: number | null;
}

function mapRow(row: AccountRow): Account {
  return {
    id: row.id,
    nome: row.nome,
    saldoAttuale: row.saldo_attuale,
    contaInDisponibile: row.conta_in_disponibile,
    targetSaldo: row.target_saldo,
  };
}

export async function getAccounts(supabase: SupabaseClient): Promise<Account[]> {
  const { data, error } = await supabase
    .from('accounts')
    .select('id, nome, saldo_attuale, conta_in_disponibile, target_saldo')
    .order('nome');

  if (error) throw error;
  return (data as AccountRow[]).map(mapRow);
}

export async function createAccount(
  supabase: SupabaseClient,
  input: { nome: string; saldoAttuale: number; contaInDisponibile: boolean; targetSaldo: number | null }
): Promise<Account> {
  const { data, error } = await supabase
    .from('accounts')
    .insert({
      nome: input.nome,
      saldo_attuale: input.saldoAttuale,
      conta_in_disponibile: input.contaInDisponibile,
      target_saldo: input.targetSaldo,
    })
    .select('id, nome, saldo_attuale, conta_in_disponibile, target_saldo')
    .single();

  if (error) throw error;
  return mapRow(data as AccountRow);
}

export async function updateAccountBalance(
  supabase: SupabaseClient,
  id: string,
  saldoAttuale: number
): Promise<void> {
  const { error } = await supabase.from('accounts').update({ saldo_attuale: saldoAttuale }).eq('id', id);
  if (error) throw error;
}
```

- [ ] **Step 6: Implementare `categories.ts`**

Create `src/lib/data/categories.ts`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Category, CategoriaTipo } from '../types';

interface CategoryRow {
  id: string;
  nome: string;
  tipo: CategoriaTipo;
  colore: string | null;
  archiviata: boolean;
}

function mapRow(row: CategoryRow): Category {
  return {
    id: row.id,
    nome: row.nome,
    tipo: row.tipo,
    colore: row.colore,
    archiviata: row.archiviata,
  };
}

export async function getCategories(supabase: SupabaseClient): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('id, nome, tipo, colore, archiviata')
    .order('nome');

  if (error) throw error;
  return (data as CategoryRow[]).map(mapRow);
}

export async function createCategory(
  supabase: SupabaseClient,
  input: { nome: string; tipo: CategoriaTipo; colore: string | null }
): Promise<Category> {
  const { data, error } = await supabase
    .from('categories')
    .insert({ nome: input.nome, tipo: input.tipo, colore: input.colore, archiviata: false })
    .select('id, nome, tipo, colore, archiviata')
    .single();

  if (error) throw error;
  return mapRow(data as CategoryRow);
}

export async function archiveCategory(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from('categories').update({ archiviata: true }).eq('id', id);
  if (error) throw error;
}
```

- [ ] **Step 7: Eseguire i test e verificare che passino**

Run: `npm test -- tests/data/accounts.test.ts tests/data/categories.test.ts`
Expected: PASS — 6 test passati.

- [ ] **Step 8: Commit**

```bash
git add src/lib/data/accounts.ts src/lib/data/categories.ts tests/data/accounts.test.ts tests/data/categories.test.ts tests/helpers/fakeSupabase.ts
git commit -m "feat: add data access layer for accounts and categories"
```

---

## Task 11: Data access — transazioni e obiettivi

**Files:**
- Create: `src/lib/data/transactions.ts`, `src/lib/data/goals.ts`
- Test: `tests/data/transactions.test.ts`, `tests/data/goals.test.ts`

**Interfaces:**
- Consumes: `Transaction`, `BudgetGoal` da `src/lib/types.ts` (Task 4); `fakeSelectClient`, `fakeMutationClient` da `tests/helpers/fakeSupabase.ts` (Task 10).
- Produces: `createTransaction`, `getTransactions`, `deleteTransaction`, `getLastIncomeDate` (`src/lib/data/transactions.ts`); `getOpenGoals`, `createGoal`, `closeGoal` (`src/lib/data/goals.ts`) — usate da Task 13, 14, 15, 18.

- [ ] **Step 1: Scrivere i test per `transactions`**

Create `tests/data/transactions.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  getTransactions,
  createTransaction,
  deleteTransaction,
  getLastIncomeDate,
} from '@/lib/data/transactions';
import { fakeSelectClient, fakeMutationClient } from '../helpers/fakeSupabase';

const row = {
  id: '1',
  tipo: 'expense',
  importo: 26,
  data: '2026-02-14',
  categoria_id: 'cat-1',
  account_id: 'acc-1',
  goal_id: null,
  descrizione: 'Spesa',
  nota: null,
  created_at: '2026-02-14T10:00:00Z',
};

describe('getTransactions', () => {
  it('mappa le righe in oggetti Transaction', async () => {
    const supabase = fakeSelectClient([row]);
    const result = await getTransactions(supabase);

    expect(result).toEqual([
      {
        id: '1',
        tipo: 'expense',
        importo: 26,
        data: '2026-02-14',
        categoriaId: 'cat-1',
        accountId: 'acc-1',
        goalId: null,
        descrizione: 'Spesa',
        nota: null,
        createdAt: '2026-02-14T10:00:00Z',
      },
    ]);
  });
});

describe('createTransaction', () => {
  it('inserisce e ritorna la transazione mappata', async () => {
    const supabase = fakeMutationClient(row);
    const result = await createTransaction(supabase, {
      tipo: 'expense',
      importo: 26,
      data: '2026-02-14',
      categoriaId: 'cat-1',
      accountId: 'acc-1',
      goalId: null,
      descrizione: 'Spesa',
      nota: null,
    });

    expect(result.id).toBe('1');
  });
});

describe('deleteTransaction', () => {
  it('non lancia errori quando la cancellazione va a buon fine', async () => {
    const supabase = fakeMutationClient(null);
    await expect(deleteTransaction(supabase, '1')).resolves.toBeUndefined();
  });
});

describe('getLastIncomeDate', () => {
  it('ritorna la data dell\'ultima entrata come oggetto Date', async () => {
    const supabase = fakeSelectClient([{ data: '2026-02-09' }]);
    const result = await getLastIncomeDate(supabase);
    expect(result).toEqual(new Date('2026-02-09'));
  });

  it('ritorna null se non ci sono entrate', async () => {
    const supabase = fakeSelectClient([]);
    const result = await getLastIncomeDate(supabase);
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Scrivere i test per `goals`**

Create `tests/data/goals.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { getOpenGoals, createGoal, closeGoal } from '@/lib/data/goals';
import { fakeSelectClient, fakeMutationClient } from '../helpers/fakeSupabase';

const row = {
  id: '1',
  nome: 'Telepass',
  importo_target: 130,
  modalita: 'bloccato',
  scadenza: null,
  categoria_id: null,
  ricorrente: false,
  frequenza_anni: null,
  stato: 'aperto',
  created_at: '2026-02-01T00:00:00Z',
};

describe('getOpenGoals', () => {
  it('mappa le righe in oggetti BudgetGoal', async () => {
    const supabase = fakeSelectClient([row]);
    const result = await getOpenGoals(supabase);

    expect(result).toEqual([
      {
        id: '1',
        nome: 'Telepass',
        importoTarget: 130,
        modalita: 'bloccato',
        scadenza: null,
        categoriaId: null,
        ricorrente: false,
        frequenzaAnni: null,
        stato: 'aperto',
        createdAt: '2026-02-01T00:00:00Z',
      },
    ]);
  });
});

describe('createGoal', () => {
  it('inserisce e ritorna l\'obiettivo mappato', async () => {
    const supabase = fakeMutationClient(row);
    const result = await createGoal(supabase, {
      nome: 'Telepass',
      importoTarget: 130,
      modalita: 'bloccato',
      scadenza: null,
      categoriaId: null,
      ricorrente: false,
      frequenzaAnni: null,
    });

    expect(result.nome).toBe('Telepass');
  });
});

describe('closeGoal', () => {
  it('non lancia errori quando la scrittura va a buon fine', async () => {
    const supabase = fakeMutationClient(null);
    await expect(closeGoal(supabase, '1')).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 3: Eseguire i test e verificare che falliscano**

Run: `npm test -- tests/data/transactions.test.ts tests/data/goals.test.ts`
Expected: FAIL — moduli non trovati.

- [ ] **Step 4: Implementare `transactions.ts`**

Create `src/lib/data/transactions.ts`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Transaction, TransactionTipo } from '../types';

interface TransactionRow {
  id: string;
  tipo: TransactionTipo;
  importo: number;
  data: string;
  categoria_id: string | null;
  account_id: string | null;
  goal_id: string | null;
  descrizione: string;
  nota: string | null;
  created_at: string;
}

function mapRow(row: TransactionRow): Transaction {
  return {
    id: row.id,
    tipo: row.tipo,
    importo: row.importo,
    data: row.data,
    categoriaId: row.categoria_id,
    accountId: row.account_id,
    goalId: row.goal_id,
    descrizione: row.descrizione,
    nota: row.nota,
    createdAt: row.created_at,
  };
}

export async function getTransactions(supabase: SupabaseClient): Promise<Transaction[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('id, tipo, importo, data, categoria_id, account_id, goal_id, descrizione, nota, created_at')
    .order('data', { ascending: false });

  if (error) throw error;
  return (data as TransactionRow[]).map(mapRow);
}

export async function createTransaction(
  supabase: SupabaseClient,
  input: {
    tipo: TransactionTipo;
    importo: number;
    data: string;
    categoriaId: string | null;
    accountId: string | null;
    goalId: string | null;
    descrizione: string;
    nota: string | null;
  }
): Promise<Transaction> {
  const { data, error } = await supabase
    .from('transactions')
    .insert({
      tipo: input.tipo,
      importo: input.importo,
      data: input.data,
      categoria_id: input.categoriaId,
      account_id: input.accountId,
      goal_id: input.goalId,
      descrizione: input.descrizione,
      nota: input.nota,
    })
    .select('id, tipo, importo, data, categoria_id, account_id, goal_id, descrizione, nota, created_at')
    .single();

  if (error) throw error;
  return mapRow(data as TransactionRow);
}

export async function deleteTransaction(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from('transactions').delete().eq('id', id);
  if (error) throw error;
}

export async function getLastIncomeDate(supabase: SupabaseClient): Promise<Date | null> {
  const { data, error } = await supabase
    .from('transactions')
    .select('data')
    .eq('tipo', 'income')
    .order('data', { ascending: false });

  if (error) throw error;
  const rows = data as { data: string }[];
  if (rows.length === 0) return null;
  return new Date(rows[0].data);
}
```

- [ ] **Step 5: Implementare `goals.ts`**

Create `src/lib/data/goals.ts`:

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
  frequenza_anni: number | null;
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
    frequenzaAnni: row.frequenza_anni,
    stato: row.stato,
    createdAt: row.created_at,
  };
}

export async function getOpenGoals(supabase: SupabaseClient): Promise<BudgetGoal[]> {
  const { data, error } = await supabase
    .from('budget_goals')
    .select(
      'id, nome, importo_target, modalita, scadenza, categoria_id, ricorrente, frequenza_anni, stato, created_at'
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
    frequenzaAnni: number | null;
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
      frequenza_anni: input.frequenzaAnni,
      stato: 'aperto',
    })
    .select(
      'id, nome, importo_target, modalita, scadenza, categoria_id, ricorrente, frequenza_anni, stato, created_at'
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

- [ ] **Step 6: Eseguire i test e verificare che passino**

Run: `npm test -- tests/data/transactions.test.ts tests/data/goals.test.ts`
Expected: PASS — 9 test passati.

- [ ] **Step 7: Commit**

```bash
git add src/lib/data/transactions.ts src/lib/data/goals.ts tests/data/transactions.test.ts tests/data/goals.test.ts
git commit -m "feat: add data access layer for transactions and budget goals"
```

---

## Task 12: Autenticazione

**Files:**
- Create: `src/app/login/page.tsx`, `src/app/login/actions.ts`
- Test: `tests/login-actions.test.ts`

**Interfaces:**
- Consumes: `createClient()` da `src/lib/supabase/server.ts` (Task 2).
- Produces: pagina `/login` funzionante, `login(formData: FormData)` server action.

- [ ] **Step 1: Scrivere il test per la validazione della action di login**

Create `tests/login-actions.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { validateLoginInput } from '@/app/login/actions';

describe('validateLoginInput', () => {
  it('accetta email e password non vuote', () => {
    expect(validateLoginInput('me@example.com', 'password123')).toEqual({ valid: true });
  });

  it('rifiuta email vuota', () => {
    expect(validateLoginInput('', 'password123')).toEqual({
      valid: false,
      error: 'Email obbligatoria',
    });
  });

  it('rifiuta password vuota', () => {
    expect(validateLoginInput('me@example.com', '')).toEqual({
      valid: false,
      error: 'Password obbligatoria',
    });
  });
});
```

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

Run: `npm test -- tests/login-actions.test.ts`
Expected: FAIL — modulo `@/app/login/actions` non trovato.

- [ ] **Step 3: Implementare la server action di login**

Create `src/app/login/actions.ts`:

```ts
'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export function validateLoginInput(
  email: string,
  password: string
): { valid: true } | { valid: false; error: string } {
  if (!email) return { valid: false, error: 'Email obbligatoria' };
  if (!password) return { valid: false, error: 'Password obbligatoria' };
  return { valid: true };
}

export async function login(formData: FormData) {
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');

  const validation = validateLoginInput(email, password);
  if (!validation.valid) {
    redirect(`/login?error=${encodeURIComponent(validation.error)}`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  redirect('/');
}
```

- [ ] **Step 4: Implementare la pagina di login**

Create `src/app/login/page.tsx`:

```tsx
import { login } from './actions';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-bold">Accedi</h1>
      {error && <p className="rounded bg-red-100 p-2 text-sm text-red-700">{error}</p>}
      <form action={login} className="flex flex-col gap-3">
        <input
          name="email"
          type="email"
          placeholder="Email"
          required
          className="rounded border p-2"
        />
        <input
          name="password"
          type="password"
          placeholder="Password"
          required
          className="rounded border p-2"
        />
        <button type="submit" className="rounded bg-slate-900 p-2 text-white">
          Accedi
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 5: Eseguire il test e verificare che passi**

Run: `npm test -- tests/login-actions.test.ts`
Expected: PASS — 3 test passati.

- [ ] **Step 6: Verifica manuale**

Run: `npm run dev`, apri `http://localhost:3000/login`, accedi con le credenziali create nel Task 3 Step 4.
Expected: dopo il login vieni reindirizzato a `/` (che darà 404 finché non viene creata nel Task 13 — atteso).

- [ ] **Step 7: Commit**

```bash
git add src/app/login tests/login-actions.test.ts
git commit -m "feat: add login page and Supabase auth server action"
```

---

## Task 13: Home dashboard

**Files:**
- Create: `src/app/page.tsx`, `src/app/HomeDashboard.tsx`
- Test: `tests/HomeDashboard.test.tsx`

**Interfaces:**
- Consumes: `computeDisponibileLibero` (Task 7), `computeMargineGiornaliero` (Task 9), `stimaDataTarget` (Task 8), `getAccounts` (Task 10), `getOpenGoals`, `getLastIncomeDate` (Task 11), `formatEuro`, `formatDateIt` (Task 5), `createClient()` server (Task 2).
- Produces: componente `HomeDashboard` esportato da `src/app/HomeDashboard.tsx`, consumato solo da `src/app/page.tsx`.

- [ ] **Step 1: Scrivere il test del componente**

Create `tests/HomeDashboard.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HomeDashboard } from '@/app/HomeDashboard';

const accounts = [
  { id: '1', nome: 'Conto corrente', saldoAttuale: 870, contaInDisponibile: true, targetSaldo: null },
];
const goals = [
  {
    id: '1',
    nome: 'Telepass',
    importoTarget: 130,
    modalita: 'bloccato' as const,
    scadenza: null,
    categoriaId: null,
    ricorrente: false,
    frequenzaAnni: null,
    stato: 'aperto' as const,
    createdAt: '2026-02-01T00:00:00Z',
  },
];

describe('HomeDashboard', () => {
  it('mostra il disponibile libero e il margine giornaliero', () => {
    render(
      <HomeDashboard
        disponibileLibero={870}
        margineGiornaliero={29}
        dataTarget="2026-07-01T00:00:00Z"
        accounts={accounts}
        goals={goals}
      />
    );

    expect(screen.getByText(/870,00/)).toBeInTheDocument();
    expect(screen.getByText(/29,00/)).toBeInTheDocument();
  });

  it('mostra il dettaglio conti/obiettivi solo dopo il click', () => {
    render(
      <HomeDashboard
        disponibileLibero={870}
        margineGiornaliero={29}
        dataTarget="2026-07-01T00:00:00Z"
        accounts={accounts}
        goals={goals}
      />
    );

    expect(screen.queryByText('Conto corrente')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Mostra dettaglio'));

    expect(screen.getByText('Conto corrente')).toBeInTheDocument();
    expect(screen.getByText(/Telepass/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

Run: `npm test -- tests/HomeDashboard.test.tsx`
Expected: FAIL — modulo `@/app/HomeDashboard` non trovato.

- [ ] **Step 3: Implementare il componente**

Create `src/app/HomeDashboard.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { formatEuro, formatDateIt } from '@/lib/format';
import type { Account, BudgetGoal } from '@/lib/types';

export function HomeDashboard({
  disponibileLibero,
  margineGiornaliero,
  dataTarget,
  accounts,
  goals,
}: {
  disponibileLibero: number;
  margineGiornaliero: number;
  dataTarget: string;
  accounts: Account[];
  goals: BudgetGoal[];
}) {
  const [showBreakdown, setShowBreakdown] = useState(false);

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 p-6">
      <section className="rounded-2xl bg-slate-900 p-6 text-white">
        <p className="text-sm text-slate-300">Disponibile libero</p>
        <p className="text-4xl font-bold">{formatEuro(disponibileLibero)}</p>
        <p className="mt-4 text-sm text-slate-300">
          Margine sicuro: {formatEuro(margineGiornaliero)}/giorno fino al{' '}
          {formatDateIt(dataTarget)}
        </p>
      </section>

      <button
        type="button"
        className="text-left text-sm text-slate-500 underline"
        onClick={() => setShowBreakdown((v) => !v)}
      >
        {showBreakdown ? 'Nascondi dettaglio' : 'Mostra dettaglio'}
      </button>

      {showBreakdown && (
        <section className="flex flex-col gap-2 text-sm">
          {accounts.map((a) => (
            <div key={a.id} className="flex justify-between">
              <span>{a.nome}</span>
              <span>{formatEuro(a.saldoAttuale)}</span>
            </div>
          ))}
          {goals.map((g) => (
            <div key={g.id} className="flex justify-between text-slate-500">
              <span>
                {g.nome} ({g.modalita})
              </span>
              <span>{formatEuro(g.importoTarget)}</span>
            </div>
          ))}
        </section>
      )}

      <a href="/add" className="fixed bottom-6 right-6 rounded-full bg-slate-900 px-6 py-4 text-2xl text-white shadow-lg">
        +
      </a>
    </main>
  );
}
```

- [ ] **Step 4: Implementare la Server Component che orchestra i dati**

Create `src/app/page.tsx`:

```tsx
import { createClient } from '@/lib/supabase/server';
import { getAccounts } from '@/lib/data/accounts';
import { getOpenGoals, } from '@/lib/data/goals';
import { getLastIncomeDate } from '@/lib/data/transactions';
import { computeDisponibileLibero } from '@/lib/calculations/disponibile';
import { computeMargineGiornaliero } from '@/lib/calculations/margine';
import { stimaDataTarget } from '@/lib/calculations/stimaDataTarget';
import { HomeDashboard } from './HomeDashboard';

export default async function HomePage() {
  const supabase = await createClient();
  const [accounts, goals, ultimaEntrata] = await Promise.all([
    getAccounts(supabase),
    getOpenGoals(supabase),
    getLastIncomeDate(supabase),
  ]);

  const today = new Date();
  const disponibileLibero = computeDisponibileLibero(accounts, goals, today);
  const dataTarget = stimaDataTarget(ultimaEntrata, today);
  const margineGiornaliero = computeMargineGiornaliero(disponibileLibero, dataTarget, today);

  return (
    <HomeDashboard
      disponibileLibero={disponibileLibero}
      margineGiornaliero={margineGiornaliero}
      dataTarget={dataTarget.toISOString()}
      accounts={accounts}
      goals={goals}
    />
  );
}
```

- [ ] **Step 5: Eseguire il test e verificare che passi**

Run: `npm test -- tests/HomeDashboard.test.tsx`
Expected: PASS — 2 test passati.

- [ ] **Step 6: Verifica manuale**

Run: `npm run dev`, accedi da `/login`.
Expected: vieni reindirizzato alla Home, che mostra "0,00 €" (nessun dato ancora inserito) senza errori in console.

- [ ] **Step 7: Commit**

```bash
git add src/app/page.tsx src/app/HomeDashboard.tsx tests/HomeDashboard.test.tsx
git commit -m "feat: build home dashboard with disponibile libero and safe-spend margin"
```

---

## Task 14: Aggiungi transazione (con optimistic UI)

**Files:**
- Create: `src/app/add/page.tsx`, `src/app/add/AddTransactionForm.tsx`
- Test: `tests/AddTransactionForm.test.tsx`

**Interfaces:**
- Consumes: `createTransaction` (Task 11), `getCategories` (Task 10), `getAccounts` (Task 10), `createClient()` browser (Task 2), `formatEuro` (Task 5).
- Produces: pagina `/add` funzionante.

- [ ] **Step 1: Scrivere il test del form**

Create `tests/AddTransactionForm.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AddTransactionForm } from '@/app/add/AddTransactionForm';

const categories = [
  { id: 'cat-1', nome: 'Groceries', tipo: 'expense' as const, colore: null, archiviata: false },
];
const accounts = [
  { id: 'acc-1', nome: 'Conto corrente', saldoAttuale: 500, contaInDisponibile: true, targetSaldo: null },
];

describe('AddTransactionForm', () => {
  it('chiama onSubmit con i valori del form e mostra subito la transazione come aggiunta (optimistic UI)', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <AddTransactionForm categories={categories} accounts={accounts} onSubmit={onSubmit} />
    );

    fireEvent.change(screen.getByLabelText('Importo'), { target: { value: '26' } });
    fireEvent.change(screen.getByLabelText('Descrizione'), { target: { value: 'Spesa' } });
    fireEvent.click(screen.getByText('Salva'));

    expect(screen.getByText('Salvata ✓')).toBeInTheDocument();

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        tipo: 'expense',
        importo: 26,
        categoriaId: 'cat-1',
        accountId: 'acc-1',
        descrizione: 'Spesa',
      });
    });
  });

  it('disabilita il pulsante se importo o descrizione sono vuoti', () => {
    const onSubmit = vi.fn();
    render(
      <AddTransactionForm categories={categories} accounts={accounts} onSubmit={onSubmit} />
    );

    expect(screen.getByText('Salva')).toBeDisabled();
  });
});
```

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

Run: `npm test -- tests/AddTransactionForm.test.tsx`
Expected: FAIL — modulo `@/app/add/AddTransactionForm` non trovato.

- [ ] **Step 3: Implementare il form con optimistic UI**

Create `src/app/add/AddTransactionForm.tsx`:

```tsx
'use client';

import { useState } from 'react';
import type { Account, Category, TransactionTipo } from '@/lib/types';

interface SubmitPayload {
  tipo: TransactionTipo;
  importo: number;
  categoriaId: string | null;
  accountId: string | null;
  descrizione: string;
}

export function AddTransactionForm({
  categories,
  accounts,
  onSubmit,
}: {
  categories: Category[];
  accounts: Account[];
  onSubmit: (payload: SubmitPayload) => Promise<void>;
}) {
  const [tipo, setTipo] = useState<TransactionTipo>('expense');
  const [importo, setImporto] = useState('');
  const [descrizione, setDescrizione] = useState('');
  const [categoriaId, setCategoriaId] = useState<string | null>(categories[0]?.id ?? null);
  const [accountId, setAccountId] = useState<string | null>(accounts[0]?.id ?? null);
  const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle');

  const importoNumerico = Number(importo);
  const isValid = importo.trim() !== '' && !Number.isNaN(importoNumerico) && descrizione.trim() !== '';

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;

    const payload: SubmitPayload = { tipo, importo: importoNumerico, categoriaId, accountId, descrizione };

    // Optimistic UI: mostriamo subito il salvataggio come riuscito, la scrittura
    // reale avviene in background; se fallisce lo segnaliamo ma non blocchiamo l'utente.
    setStatus('saved');
    setImporto('');
    setDescrizione('');

    onSubmit(payload).catch(() => setStatus('error'));
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto flex max-w-md flex-col gap-3 p-6">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setTipo('expense')}
          className={tipo === 'expense' ? 'font-bold underline' : ''}
        >
          Spesa
        </button>
        <button
          type="button"
          onClick={() => setTipo('income')}
          className={tipo === 'income' ? 'font-bold underline' : ''}
        >
          Entrata
        </button>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        Importo
        <input
          aria-label="Importo"
          type="number"
          inputMode="decimal"
          value={importo}
          onChange={(e) => setImporto(e.target.value)}
          className="rounded border p-2 text-lg"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Descrizione
        <input
          aria-label="Descrizione"
          type="text"
          value={descrizione}
          onChange={(e) => setDescrizione(e.target.value)}
          className="rounded border p-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Categoria
        <select
          value={categoriaId ?? ''}
          onChange={(e) => setCategoriaId(e.target.value || null)}
          className="rounded border p-2"
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Conto
        <select
          value={accountId ?? ''}
          onChange={(e) => setAccountId(e.target.value || null)}
          className="rounded border p-2"
        >
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nome}
            </option>
          ))}
        </select>
      </label>

      <button
        type="submit"
        disabled={!isValid}
        className="rounded bg-slate-900 p-3 text-white disabled:opacity-40"
      >
        Salva
      </button>

      {status === 'saved' && <p className="text-sm text-green-600">Salvata ✓</p>}
      {status === 'error' && (
        <p className="text-sm text-red-600">Salvataggio fallito, controlla la connessione e riprova.</p>
      )}
    </form>
  );
}
```

- [ ] **Step 4: Eseguire il test e verificare che passi**

Run: `npm test -- tests/AddTransactionForm.test.tsx`
Expected: PASS — 2 test passati.

- [ ] **Step 5: Implementare la pagina che collega il form ai dati**

Create `src/app/add/page.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { getCategories } from '@/lib/data/categories';
import { getAccounts } from '@/lib/data/accounts';
import { createTransaction } from '@/lib/data/transactions';
import { AddTransactionForm } from './AddTransactionForm';
import type { Account, Category } from '@/lib/types';

export default function AddTransactionPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);

  useEffect(() => {
    const supabase = createClient();
    Promise.all([getCategories(supabase), getAccounts(supabase)]).then(([cats, accs]) => {
      setCategories(cats);
      setAccounts(accs);
    });
  }, []);

  async function handleSubmit(payload: {
    tipo: 'expense' | 'income';
    importo: number;
    categoriaId: string | null;
    accountId: string | null;
    descrizione: string;
  }) {
    const supabase = createClient();
    await createTransaction(supabase, {
      ...payload,
      data: new Date().toISOString().slice(0, 10),
      goalId: null,
      nota: null,
    });
    router.push('/');
  }

  return <AddTransactionForm categories={categories} accounts={accounts} onSubmit={handleSubmit} />;
}
```

- [ ] **Step 6: Verifica manuale**

Run: `npm run dev`, dalla Home tocca il pulsante "+", inserisci una spesa e salvala.
Expected: il messaggio "Salvata ✓" appare istantaneamente, poi vieni riportato alla Home e il disponibile è aggiornato.

- [ ] **Step 7: Commit**

```bash
git add src/app/add tests/AddTransactionForm.test.tsx
git commit -m "feat: add quick transaction entry form with optimistic UI"
```

---

## Task 15: Obiettivi di budget

**Files:**
- Create: `src/app/goals/page.tsx`, `src/app/goals/GoalsList.tsx`, `src/app/goals/CreateGoalForm.tsx`
- Test: `tests/CreateGoalForm.test.tsx`

**Interfaces:**
- Consumes: `getOpenGoals`, `createGoal` (Task 11), `formatEuro` (Task 5), `createClient()` browser (Task 2).
- Produces: pagina `/goals` funzionante.

- [ ] **Step 1: Scrivere il test del form di creazione**

Create `tests/CreateGoalForm.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CreateGoalForm } from '@/app/goals/CreateGoalForm';

describe('CreateGoalForm', () => {
  it('richiede una scadenza quando la modalità è dilazionato', () => {
    const onSubmit = vi.fn();
    render(<CreateGoalForm onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Regalo anniversario' } });
    fireEvent.change(screen.getByLabelText('Importo target'), { target: { value: '100' } });
    fireEvent.change(screen.getByLabelText('Modalità'), { target: { value: 'dilazionato' } });

    expect(screen.getByText('Crea obiettivo')).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Scadenza'), { target: { value: '2026-11-27' } });

    expect(screen.getByText('Crea obiettivo')).toBeEnabled();
  });

  it('non richiede scadenza quando la modalità è bloccato', () => {
    const onSubmit = vi.fn();
    render(<CreateGoalForm onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Telepass' } });
    fireEvent.change(screen.getByLabelText('Importo target'), { target: { value: '130' } });

    expect(screen.getByText('Crea obiettivo')).toBeEnabled();
  });
});
```

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

Run: `npm test -- tests/CreateGoalForm.test.tsx`
Expected: FAIL — modulo `@/app/goals/CreateGoalForm` non trovato.

- [ ] **Step 3: Implementare il form di creazione obiettivo**

Create `src/app/goals/CreateGoalForm.tsx`:

```tsx
'use client';

import { useState } from 'react';
import type { GoalModalita } from '@/lib/types';

interface GoalPayload {
  nome: string;
  importoTarget: number;
  modalita: GoalModalita;
  scadenza: string | null;
  ricorrente: boolean;
  frequenzaAnni: number | null;
}

export function CreateGoalForm({ onSubmit }: { onSubmit: (payload: GoalPayload) => void }) {
  const [nome, setNome] = useState('');
  const [importoTarget, setImportoTarget] = useState('');
  const [modalita, setModalita] = useState<GoalModalita>('bloccato');
  const [scadenza, setScadenza] = useState('');
  const [ricorrente, setRicorrente] = useState(false);
  const [frequenzaAnni, setFrequenzaAnni] = useState('1');

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
      ricorrente,
      frequenzaAnni: ricorrente ? Number(frequenzaAnni) : null,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        Nome
        <input
          aria-label="Nome"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          className="rounded border p-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Importo target
        <input
          aria-label="Importo target"
          type="number"
          value={importoTarget}
          onChange={(e) => setImportoTarget(e.target.value)}
          className="rounded border p-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Modalità
        <select
          aria-label="Modalità"
          value={modalita}
          onChange={(e) => setModalita(e.target.value as GoalModalita)}
          className="rounded border p-2"
        >
          <option value="bloccato">Bloccato</option>
          <option value="dilazionato">Dilazionato</option>
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Scadenza {modalita === 'bloccato' && '(opzionale)'}
        <input
          aria-label="Scadenza"
          type="date"
          value={scadenza}
          onChange={(e) => setScadenza(e.target.value)}
          className="rounded border p-2"
        />
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={ricorrente}
          onChange={(e) => setRicorrente(e.target.checked)}
        />
        Ricorrente
      </label>

      {ricorrente && (
        <label className="flex flex-col gap-1 text-sm">
          Ogni quanti anni
          <input
            type="number"
            value={frequenzaAnni}
            onChange={(e) => setFrequenzaAnni(e.target.value)}
            className="rounded border p-2"
          />
        </label>
      )}

      <button
        type="submit"
        disabled={!isValid}
        className="rounded bg-slate-900 p-3 text-white disabled:opacity-40"
      >
        Crea obiettivo
      </button>
    </form>
  );
}
```

- [ ] **Step 4: Eseguire il test e verificare che passi**

Run: `npm test -- tests/CreateGoalForm.test.tsx`
Expected: PASS — 2 test passati.

- [ ] **Step 5: Implementare la lista obiettivi**

Create `src/app/goals/GoalsList.tsx`:

```tsx
import { formatEuro, formatDateIt } from '@/lib/format';
import type { BudgetGoal } from '@/lib/types';

export function GoalsList({ goals }: { goals: BudgetGoal[] }) {
  if (goals.length === 0) {
    return <p className="text-sm text-slate-500">Nessun obiettivo aperto.</p>;
  }

  return (
    <ul className="flex flex-col gap-3">
      {goals.map((g) => (
        <li key={g.id} className="rounded border p-3">
          <div className="flex justify-between font-medium">
            <span>{g.nome}</span>
            <span>{formatEuro(g.importoTarget)}</span>
          </div>
          <p className="text-sm text-slate-500">
            {g.modalita === 'bloccato' ? 'Bloccato' : 'Dilazionato'}
            {g.scadenza && ` · entro il ${formatDateIt(g.scadenza)}`}
            {g.ricorrente && ' · ricorrente'}
          </p>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 6: Implementare la pagina**

Create `src/app/goals/page.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getOpenGoals, createGoal } from '@/lib/data/goals';
import { GoalsList } from './GoalsList';
import { CreateGoalForm } from './CreateGoalForm';
import type { BudgetGoal, GoalModalita } from '@/lib/types';

export default function GoalsPage() {
  const [goals, setGoals] = useState<BudgetGoal[]>([]);

  async function refresh() {
    const supabase = createClient();
    setGoals(await getOpenGoals(supabase));
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleCreate(payload: {
    nome: string;
    importoTarget: number;
    modalita: GoalModalita;
    scadenza: string | null;
    ricorrente: boolean;
    frequenzaAnni: number | null;
  }) {
    const supabase = createClient();
    await createGoal(supabase, { ...payload, categoriaId: null });
    await refresh();
  }

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 p-6">
      <h1 className="text-xl font-bold">Obiettivi di budget</h1>
      <GoalsList goals={goals} />
      <h2 className="text-lg font-semibold">Nuovo obiettivo</h2>
      <CreateGoalForm onSubmit={handleCreate} />
    </main>
  );
}
```

- [ ] **Step 7: Verifica manuale**

Run: `npm run dev`, apri `/goals`, crea un obiettivo bloccato (es. Telepass 130€) e uno dilazionato con scadenza futura.
Expected: entrambi appaiono nella lista; tornando in Home il "disponibile libero" è diminuito di conseguenza.

- [ ] **Step 8: Commit**

```bash
git add src/app/goals tests/CreateGoalForm.test.tsx
git commit -m "feat: add budget goals list and creation screen"
```

---

## Task 16: Gestione conti

**Files:**
- Create: `src/app/accounts/page.tsx`, `src/app/accounts/AccountRow.tsx`
- Test: `tests/AccountRow.test.tsx`

**Interfaces:**
- Consumes: `getAccounts`, `updateAccountBalance`, `createAccount` (Task 10), `formatEuro` (Task 5), `createClient()` browser (Task 2).
- Produces: pagina `/accounts` funzionante.

- [ ] **Step 1: Scrivere il test della riga conto**

Create `tests/AccountRow.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AccountRow } from '@/app/accounts/AccountRow';

const account = {
  id: '1',
  nome: 'Fondo emergenza',
  saldoAttuale: 1200,
  contaInDisponibile: false,
  targetSaldo: 3000,
};

describe('AccountRow', () => {
  it('mostra la barra di progresso quando c\'è un target', () => {
    render(<AccountRow account={account} onUpdateBalance={vi.fn()} />);
    expect(screen.getByText('1.200,00 € / 3.000,00 €')).toBeInTheDocument();
  });

  it('chiama onUpdateBalance con il nuovo saldo', () => {
    const onUpdateBalance = vi.fn();
    render(<AccountRow account={account} onUpdateBalance={onUpdateBalance} />);

    fireEvent.change(screen.getByLabelText('Aggiorna saldo'), { target: { value: '1500' } });
    fireEvent.click(screen.getByText('Aggiorna'));

    expect(onUpdateBalance).toHaveBeenCalledWith('1', 1500);
  });
});
```

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

Run: `npm test -- tests/AccountRow.test.tsx`
Expected: FAIL — modulo `@/app/accounts/AccountRow` non trovato.

- [ ] **Step 3: Implementare il componente**

Create `src/app/accounts/AccountRow.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { formatEuro } from '@/lib/format';
import type { Account } from '@/lib/types';

export function AccountRow({
  account,
  onUpdateBalance,
}: {
  account: Account;
  onUpdateBalance: (id: string, saldo: number) => void;
}) {
  const [saldo, setSaldo] = useState(String(account.saldoAttuale));

  return (
    <div className="rounded border p-3">
      <div className="flex justify-between font-medium">
        <span>{account.nome}</span>
        <span>{formatEuro(account.saldoAttuale)}</span>
      </div>

      {account.targetSaldo !== null && (
        <p className="text-sm text-slate-500">
          {formatEuro(account.saldoAttuale)} / {formatEuro(account.targetSaldo)}
        </p>
      )}

      <div className="mt-2 flex gap-2">
        <input
          aria-label="Aggiorna saldo"
          type="number"
          value={saldo}
          onChange={(e) => setSaldo(e.target.value)}
          className="w-32 rounded border p-1"
        />
        <button
          type="button"
          onClick={() => onUpdateBalance(account.id, Number(saldo))}
          className="rounded bg-slate-900 px-3 py-1 text-sm text-white"
        >
          Aggiorna
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Eseguire il test e verificare che passi**

Run: `npm test -- tests/AccountRow.test.tsx`
Expected: PASS — 2 test passati.

- [ ] **Step 5: Implementare la pagina**

Create `src/app/accounts/page.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getAccounts, updateAccountBalance, createAccount } from '@/lib/data/accounts';
import { AccountRow } from './AccountRow';
import type { Account } from '@/lib/types';

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [nome, setNome] = useState('');
  const [contaInDisponibile, setContaInDisponibile] = useState(true);

  async function refresh() {
    const supabase = createClient();
    setAccounts(await getAccounts(supabase));
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleUpdateBalance(id: string, saldo: number) {
    const supabase = createClient();
    await updateAccountBalance(supabase, id, saldo);
    await refresh();
  }

  async function handleCreate() {
    if (!nome.trim()) return;
    const supabase = createClient();
    await createAccount(supabase, {
      nome,
      saldoAttuale: 0,
      contaInDisponibile,
      targetSaldo: null,
    });
    setNome('');
    await refresh();
  }

  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 p-6">
      <h1 className="text-xl font-bold">Conti</h1>
      {accounts.map((a) => (
        <AccountRow key={a.id} account={a} onUpdateBalance={handleUpdateBalance} />
      ))}

      <h2 className="text-lg font-semibold">Nuovo conto</h2>
      <input
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        placeholder="Nome conto"
        className="rounded border p-2"
      />
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={contaInDisponibile}
          onChange={(e) => setContaInDisponibile(e.target.checked)}
        />
        Conta nel disponibile libero
      </label>
      <button type="button" onClick={handleCreate} className="rounded bg-slate-900 p-2 text-white">
        Aggiungi conto
      </button>
    </main>
  );
}
```

- [ ] **Step 6: Verifica manuale**

Run: `npm run dev`, apri `/accounts`, crea "Conto corrente" (conta nel disponibile) e "Fondo emergenza" (non conta), aggiorna i saldi.
Expected: il disponibile in Home riflette solo il saldo del Conto corrente.

- [ ] **Step 7: Commit**

```bash
git add src/app/accounts tests/AccountRow.test.tsx
git commit -m "feat: add accounts management screen"
```

---

## Task 17: Gestione categorie

**Files:**
- Create: `src/app/categories/page.tsx`

**Interfaces:**
- Consumes: `getCategories`, `createCategory`, `archiveCategory` (Task 10), `createClient()` browser (Task 2).
- Produces: pagina `/categories` funzionante.

- [ ] **Step 1: Implementare la pagina (CRUD semplice, riusa componenti esistenti)**

Create `src/app/categories/page.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getCategories, createCategory, archiveCategory } from '@/lib/data/categories';
import type { Category, CategoriaTipo } from '@/lib/types';

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState<CategoriaTipo>('expense');

  async function refresh() {
    const supabase = createClient();
    setCategories(await getCategories(supabase));
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleCreate() {
    if (!nome.trim()) return;
    const supabase = createClient();
    await createCategory(supabase, { nome, tipo, colore: null });
    setNome('');
    await refresh();
  }

  async function handleArchive(id: string) {
    const supabase = createClient();
    await archiveCategory(supabase, id);
    await refresh();
  }

  const attive = categories.filter((c) => !c.archiviata);

  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 p-6">
      <h1 className="text-xl font-bold">Categorie</h1>

      <ul className="flex flex-col gap-2">
        {attive.map((c) => (
          <li key={c.id} className="flex items-center justify-between rounded border p-2">
            <span>
              {c.nome} <span className="text-xs text-slate-400">({c.tipo})</span>
            </span>
            <button
              type="button"
              onClick={() => handleArchive(c.id)}
              className="text-sm text-slate-500 underline"
            >
              Archivia
            </button>
          </li>
        ))}
      </ul>

      <h2 className="text-lg font-semibold">Nuova categoria</h2>
      <input
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        placeholder="Nome categoria"
        className="rounded border p-2"
      />
      <select
        value={tipo}
        onChange={(e) => setTipo(e.target.value as CategoriaTipo)}
        className="rounded border p-2"
      >
        <option value="expense">Spesa</option>
        <option value="income">Entrata</option>
      </select>
      <button type="button" onClick={handleCreate} className="rounded bg-slate-900 p-2 text-white">
        Aggiungi categoria
      </button>
    </main>
  );
}
```

- [ ] **Step 2: Verifica manuale**

Run: `npm run dev`, apri `/categories`, crea "Groceries" (spesa) e "Stipendio" (entrata), poi archivia una categoria.
Expected: le categorie create appaiono nel form di Aggiungi transazione (Task 14); quelle archiviate scompaiono dalla lista di questa pagina.

- [ ] **Step 3: Commit**

```bash
git add src/app/categories
git commit -m "feat: add categories management screen"
```

---

## Task 18: Storico e report

**Files:**
- Create: `src/app/history/page.tsx`, `src/lib/calculations/aggregateByCategory.ts`
- Test: `tests/calculations/aggregateByCategory.test.ts`

**Interfaces:**
- Consumes: `getTransactions` (Task 11), `getCategories` (Task 10), `Transaction`, `Category` (Task 4), `formatEuro` (Task 5).
- Produces: `aggregateByCategory(transactions: Transaction[], categories: Category[]): { nome: string; totale: number }[]`.

- [ ] **Step 1: Scrivere i test per l'aggregazione**

Create `tests/calculations/aggregateByCategory.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { aggregateByCategory } from '@/lib/calculations/aggregateByCategory';
import type { Transaction, Category } from '@/lib/types';

const categories: Category[] = [
  { id: 'cat-1', nome: 'Groceries', tipo: 'expense', colore: null, archiviata: false },
  { id: 'cat-2', nome: 'Transport', tipo: 'expense', colore: null, archiviata: false },
];

function tx(overrides: Partial<Transaction>): Transaction {
  return {
    id: '1',
    tipo: 'expense',
    importo: 10,
    data: '2026-02-01',
    categoriaId: 'cat-1',
    accountId: null,
    goalId: null,
    descrizione: '',
    nota: null,
    createdAt: '2026-02-01T00:00:00Z',
    ...overrides,
  };
}

describe('aggregateByCategory', () => {
  it('somma gli importi per categoria', () => {
    const transactions = [
      tx({ categoriaId: 'cat-1', importo: 26 }),
      tx({ categoriaId: 'cat-1', importo: 24 }),
      tx({ categoriaId: 'cat-2', importo: 275 }),
    ];

    const result = aggregateByCategory(transactions, categories);

    expect(result).toEqual(
      expect.arrayContaining([
        { nome: 'Groceries', totale: 50 },
        { nome: 'Transport', totale: 275 },
      ])
    );
  });

  it('raggruppa come "Senza categoria" le transazioni senza categoriaId', () => {
    const transactions = [tx({ categoriaId: null, importo: 15 })];
    const result = aggregateByCategory(transactions, categories);
    expect(result).toEqual([{ nome: 'Senza categoria', totale: 15 }]);
  });

  it('ignora le entrate, considera solo le spese', () => {
    const transactions = [
      tx({ tipo: 'income', categoriaId: null, importo: 1000 }),
      tx({ tipo: 'expense', categoriaId: 'cat-1', importo: 20 }),
    ];

    const result = aggregateByCategory(transactions, categories);
    expect(result).toEqual([{ nome: 'Groceries', totale: 20 }]);
  });
});
```

- [ ] **Step 2: Eseguire i test e verificare che falliscano**

Run: `npm test -- tests/calculations/aggregateByCategory.test.ts`
Expected: FAIL — modulo non trovato.

- [ ] **Step 3: Implementare**

Create `src/lib/calculations/aggregateByCategory.ts`:

```ts
import type { Transaction, Category } from '../types';

export function aggregateByCategory(
  transactions: Transaction[],
  categories: Category[]
): { nome: string; totale: number }[] {
  const nomeById = new Map(categories.map((c) => [c.id, c.nome]));
  const totali = new Map<string, number>();

  for (const t of transactions) {
    if (t.tipo !== 'expense') continue;
    const nome = t.categoriaId ? nomeById.get(t.categoriaId) ?? 'Senza categoria' : 'Senza categoria';
    totali.set(nome, (totali.get(nome) ?? 0) + t.importo);
  }

  return Array.from(totali.entries()).map(([nome, totale]) => ({ nome, totale }));
}
```

- [ ] **Step 4: Eseguire i test e verificare che passino**

Run: `npm test -- tests/calculations/aggregateByCategory.test.ts`
Expected: PASS — 3 test passati.

- [ ] **Step 5: Implementare la pagina Storico con grafico**

Create `src/app/history/page.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { createClient } from '@/lib/supabase/client';
import { getTransactions, deleteTransaction } from '@/lib/data/transactions';
import { getCategories } from '@/lib/data/categories';
import { aggregateByCategory } from '@/lib/calculations/aggregateByCategory';
import { formatEuro, formatDateIt } from '@/lib/format';
import type { Transaction, Category } from '@/lib/types';

export default function HistoryPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  async function refresh() {
    const supabase = createClient();
    const [tx, cats] = await Promise.all([getTransactions(supabase), getCategories(supabase)]);
    setTransactions(tx);
    setCategories(cats);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleDelete(id: string) {
    const supabase = createClient();
    await deleteTransaction(supabase, id);
    await refresh();
  }

  const chartData = aggregateByCategory(transactions, categories);

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 p-6">
      <h1 className="text-xl font-bold">Storico</h1>

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <XAxis dataKey="nome" tick={{ fontSize: 10 }} />
            <YAxis />
            <Tooltip formatter={(value: number) => formatEuro(value)} />
            <Bar dataKey="totale" fill="#0f172a" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <ul className="flex flex-col gap-2">
        {transactions.map((t) => (
          <li key={t.id} className="flex items-center justify-between rounded border p-2 text-sm">
            <div>
              <p>{t.descrizione || '(senza descrizione)'}</p>
              <p className="text-xs text-slate-400">{formatDateIt(t.data)}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={t.tipo === 'income' ? 'text-green-600' : ''}>
                {t.tipo === 'income' ? '+' : '-'}
                {formatEuro(t.importo)}
              </span>
              <button
                type="button"
                onClick={() => handleDelete(t.id)}
                className="text-xs text-red-500 underline"
              >
                Elimina
              </button>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
```

- [ ] **Step 6: Verifica manuale**

Run: `npm run dev`, apri `/history` dopo aver inserito alcune transazioni.
Expected: il grafico mostra le spese per categoria, la lista sotto è filtrabile a occhio e le transazioni si possono eliminare.

- [ ] **Step 7: Commit**

```bash
git add src/app/history src/lib/calculations/aggregateByCategory.ts tests/calculations/aggregateByCategory.test.ts
git commit -m "feat: add history screen with category breakdown chart"
```

---

## Task 19: Navigazione tra le schermate

**Files:**
- Create: `src/app/NavBar.tsx`
- Modify: `src/app/layout.tsx`

**Interfaces:**
- Consumes: nessuno.
- Produces: `NavBar` montata in tutte le pagine tramite il layout condiviso.

- [ ] **Step 1: Implementare la barra di navigazione**

Create `src/app/NavBar.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
  { href: '/', label: 'Home' },
  { href: '/goals', label: 'Obiettivi' },
  { href: '/history', label: 'Storico' },
  { href: '/accounts', label: 'Conti' },
  { href: '/categories', label: 'Categorie' },
];

export function NavBar() {
  const pathname = usePathname();

  if (pathname === '/login') return null;

  return (
    <nav className="sticky bottom-0 flex justify-around border-t bg-white p-2 text-xs">
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className={pathname === l.href ? 'font-bold' : 'text-slate-500'}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
```

- [ ] **Step 2: Montare la NavBar nel layout condiviso**

Modify `src/app/layout.tsx` aggiungendo `<NavBar />` subito prima della chiusura di `<body>`, ad esempio:

```tsx
import './globals.css';
import { NavBar } from './NavBar';

export const metadata = {
  title: 'Budget',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body className="pb-16">
        {children}
        <NavBar />
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Verifica manuale**

Run: `npm run dev`, naviga tra tutte le schermate usando la barra in basso.
Expected: la voce attiva è evidenziata; la barra è nascosta in `/login`.

- [ ] **Step 4: Commit**

```bash
git add src/app/NavBar.tsx src/app/layout.tsx
git commit -m "feat: add bottom navigation bar across screens"
```

---

## Task 20: PWA installabile su iPhone

**Files:**
- Create: `public/manifest.json`, `public/icons/icon-192.png`, `public/icons/icon-512.png`
- Modify: `src/app/layout.tsx`

**Interfaces:**
- Consumes: nessuno.
- Produces: app installabile via "Aggiungi a Home" su Safari iOS e su browser desktop.

- [ ] **Step 1: Creare il manifest PWA**

Create `public/manifest.json`:

```json
{
  "name": "Budget",
  "short_name": "Budget",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#0f172a",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

- [ ] **Step 2: Generare due icone placeholder**

Genera (o chiedi di generare) due PNG quadrati, 192x192 e 512x512, con sfondo `#0f172a` e una "€" bianca al centro, salvati in `public/icons/icon-192.png` e `public/icons/icon-512.png`. Puoi sostituirli in seguito con un'icona definitiva senza toccare altro codice.

- [ ] **Step 3: Collegare il manifest e i meta tag iOS nel layout**

Modify `src/app/layout.tsx` aggiungendo l'export `metadata` con i campi PWA:

```tsx
export const metadata = {
  title: 'Budget',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Budget',
  },
};

export const viewport = {
  themeColor: '#0f172a',
};
```

- [ ] **Step 4: Verifica manuale su iPhone**

Deploy o esponi l'app in locale sulla rete (es. `npm run dev -- --hostname 0.0.0.0`), apri l'URL da Safari su iPhone, tocca "Condividi" → "Aggiungi a Home".
Expected: l'icona appare in Home Screen; aprendola si comporta come un'app a schermo intero, senza barra degli indirizzi di Safari.

- [ ] **Step 5: Commit**

```bash
git add public/manifest.json public/icons src/app/layout.tsx
git commit -m "feat: make the app installable as a PWA on iPhone"
```

---

## Task 21: Deploy su Vercel

**Files:** nessuno (solo configurazione della piattaforma).

- [ ] **Step 1: Push del repository su GitHub**

```bash
git remote add origin <url-del-tuo-repo-github>
git push -u origin master
```

(Se non esiste ancora un repository GitHub, creane uno vuoto dal sito github.com prima di questo step.)

- [ ] **Step 2: Collegare il progetto a Vercel**

Su https://vercel.com, "Add New Project", importa il repository GitHub appena creato. Vercel rileva automaticamente Next.js.

- [ ] **Step 3: Configurare le variabili d'ambiente su Vercel**

Nella sezione **Settings → Environment Variables** del progetto Vercel, aggiungi `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` con gli stessi valori di `.env.local` (il `SUPABASE_SERVICE_ROLE_KEY` NON va qui: serve solo per lo script di migrazione locale del Task 22, mai in un ambiente client-facing).

- [ ] **Step 4: Deploy**

Premi "Deploy" su Vercel. Al termine, apri l'URL pubblico assegnato (es. `https://budget-app-xxxx.vercel.app`).

- [ ] **Step 5: Verifica manuale**

Apri l'URL pubblico da iPhone e da desktop.
Expected: login funzionante, dati sincronizzati identici su entrambi i dispositivi, nessun errore in console relativo a variabili d'ambiente.

---

## Task 22: Migrazione dati storici

**Files:**
- Create: `scripts/migrate-legacy-data.ts`, `scripts/legacy-expenses.csv` (placeholder, sovrascritto dall'export reale), `scripts/legacy-income.csv` (placeholder)

**Interfaces:**
- Consumes: `SUPABASE_SERVICE_ROLE_KEY` (env, bypassa RLS per lo script una tantum), schema di `accounts`, `categories`, `transactions` (Task 3).

- [ ] **Step 1: Esportare i dati storici in CSV**

Da Google Sheets, apri i fogli "Expenses" e "Income" del tracker esistente, `File → Scarica → Valori separati da virgola (.csv)`. Salva come `scripts/legacy-expenses.csv` e `scripts/legacy-income.csv`, mantenendo le intestazioni originali (`Timestamp,Purchase Date,Item,Amount,Category` e `Timestamp,Date,Income Source,Description/Invoice No.,Income Amount`).

- [ ] **Step 2: Installare le dipendenze per lo script**

```bash
npm install -D tsx csv-parse
```

- [ ] **Step 3: Scrivere lo script di migrazione**

Create `scripts/migrate-legacy-data.ts`:

```ts
import { readFileSync } from 'fs';
import { parse } from 'csv-parse/sync';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface ExpenseRow {
  'Purchase Date': string;
  Item: string;
  Amount: string;
  Category: string;
}

interface IncomeRow {
  Date: string;
  'Income Source': string;
  'Description/Invoice No.': string;
  'Income Amount': string;
}

async function getOrCreateCategory(nome: string, tipo: 'expense' | 'income'): Promise<string> {
  const { data: existing } = await supabase
    .from('categories')
    .select('id')
    .eq('nome', nome)
    .eq('tipo', tipo)
    .maybeSingle();

  if (existing) return existing.id;

  const { data: created, error } = await supabase
    .from('categories')
    .insert({ nome, tipo, archiviata: false })
    .select('id')
    .single();

  if (error) throw error;
  return created.id;
}

function parseItalianOrIsoDate(value: string): string {
  const asDate = new Date(value);
  if (Number.isNaN(asDate.getTime())) {
    throw new Error(`Data non valida: ${value}`);
  }
  return asDate.toISOString().slice(0, 10);
}

async function migrateExpenses() {
  const csv = readFileSync('scripts/legacy-expenses.csv', 'utf-8');
  const rows: ExpenseRow[] = parse(csv, { columns: true, skip_empty_lines: true });

  for (const row of rows) {
    if (!row.Amount || !row['Purchase Date']) continue;

    const categoriaId = await getOrCreateCategory(row.Category || 'Other', 'expense');

    const { error } = await supabase.from('transactions').insert({
      tipo: 'expense',
      importo: Number(row.Amount),
      data: parseItalianOrIsoDate(row['Purchase Date']),
      categoria_id: categoriaId,
      account_id: null,
      goal_id: null,
      descrizione: row.Item || '',
      nota: null,
    });

    if (error) throw error;
  }

  console.log(`Migrate ${rows.length} spese.`);
}

async function migrateIncome() {
  const csv = readFileSync('scripts/legacy-income.csv', 'utf-8');
  const rows: IncomeRow[] = parse(csv, { columns: true, skip_empty_lines: true });

  for (const row of rows) {
    if (!row['Income Amount'] || !row.Date) continue;

    const categoriaId = await getOrCreateCategory(row['Income Source'] || 'Altro', 'income');

    const { error } = await supabase.from('transactions').insert({
      tipo: 'income',
      importo: Number(row['Income Amount']),
      data: parseItalianOrIsoDate(row.Date),
      categoria_id: categoriaId,
      account_id: null,
      goal_id: null,
      descrizione: row['Description/Invoice No.'] || '',
      nota: null,
    });

    if (error) throw error;
  }

  console.log(`Migrate ${rows.length} entrate.`);
}

async function main() {
  await migrateExpenses();
  await migrateIncome();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 4: Eseguire lo script**

```bash
npx tsx scripts/migrate-legacy-data.ts
```

Expected: log `Migrate N spese.` e `Migrate M entrate.` senza errori.

- [ ] **Step 5: Verifica manuale**

Apri `/history` nell'app.
Expected: le transazioni storiche compaiono nel grafico e nella lista, con le categorie ricreate automaticamente.

- [ ] **Step 6: Commit**

```bash
git add scripts/migrate-legacy-data.ts
git commit -m "chore: add one-off script to migrate legacy spreadsheet data"
```

(I file CSV con dati reali non vanno committati: aggiungi `scripts/*.csv` a `.gitignore` prima di questo commit.)

---

## Nota per chi esegue: ordine di esecuzione

I task sono ordinati per dipendenza: 1→4 sono infrastruttura e schema, 5→9 sono la logica di
calcolo (il cuore del progetto, massima cura nei test), 10→11 collegano i calcoli al database,
12 aggiunge l'autenticazione, 13→19 costruiscono le schermate una alla volta, 20→21 rendono
l'app installabile e pubblica, 22 è la migrazione dei dati storici e può essere eseguita in
qualunque momento dopo il Task 3 (anche in parallelo alle schermate), dato che scrive
direttamente nel database senza passare dalla UI.
