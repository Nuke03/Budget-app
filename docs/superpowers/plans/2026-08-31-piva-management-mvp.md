# Gestione P.IVA (regime forfettario) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "P.IVA" screen, gated by a per-account activation toggle, that estimates the imposta sostitutiva and contributi previdenziali due on freelance revenue (regime forfettario only) and suggests a monthly amount to set aside.

**Architecture:** A new `piva_settings` table (one configurable row per account, RLS-isolated like every other table) holds the user's own tax-regime parameters. A pure calculation module (`src/lib/calculations/piva.ts`) turns `(settings, transactions, today)` into the numbers shown on screen — no calculation ever writes data. A client-rendered `/piva` route follows the same fetch-in-`useEffect` pattern already used by `/goals` and `/categories`, and shows either a configuration form (not yet activated / editing) or a read-only dashboard (activated).

**Tech Stack:** Next.js App Router (TypeScript), Supabase (Postgres + Auth, RLS), Vitest + React Testing Library, date-fns, Tailwind CSS v4 design tokens already in `src/app/globals.css`.

**Spec:** [docs/superpowers/specs/2026-08-31-piva-management-design.md](../specs/2026-08-31-piva-management-design.md)

## Global Constraints

- Scope is **regime forfettario only** — no IRPEF a scaglioni, no F24, no scadenze reminders.
- The app never asserts tax rules on the user's behalf: every rate/coefficient/minimale is a user-editable setting, defaulted sensibly but never hardcoded as "correct."
- RLS pattern for the new table matches every existing table exactly: `user_id uuid not null default auth.uid() references auth.users(id) on delete cascade`, policy `for all using (auth.uid() = user_id) with check (auth.uid() = user_id)`.
- All calculation functions are pure (inputs in, number out) and take `today: Date` as an explicit parameter — never call `new Date()` internally — so they stay unit-testable without fake timers.
- Naming: camelCase in TypeScript, snake_case in Postgres/SQL, Italian domain vocabulary throughout (matches every existing file).
- No new UI patterns: reuse the existing pill-toggle, `fieldClass` input styling, and card (`shadow-card`/`radius-lg`) conventions already established in `CreateGoalForm.tsx` and `categories/page.tsx`.

---

### Task 1: `piva_settings` table, type, and data layer

**Files:**
- Create: `supabase/migrations/0003_piva_settings.sql`
- Modify: `src/lib/types.ts`
- Create: `src/lib/data/pivaSettings.ts`
- Modify: `tests/helpers/fakeSupabase.ts`
- Test: `tests/data/pivaSettings.test.ts`

**Interfaces:**
- Produces: `PivaSettings` type (in `src/lib/types.ts`), `PivaSettingsInput` type, `getPivaSettings(supabase): Promise<PivaSettings | null>`, `createPivaSettings(supabase, input: PivaSettingsInput): Promise<PivaSettings>`, `updatePivaSettings(supabase, id: string, input: PivaSettingsInput): Promise<PivaSettings>` (all in `src/lib/data/pivaSettings.ts`) — consumed by Task 5's page.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0003_piva_settings.sql`:

```sql
create table if not exists public.piva_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  attivo boolean not null default false,
  data_apertura date,
  categoria_fatturato_id uuid references public.categories(id) on delete set null,
  coefficiente_redditivita numeric not null default 78,
  aliquota_sostitutiva_override numeric,
  aliquota_contributo_soggettivo numeric not null default 10,
  aliquota_contributo_integrativo numeric not null default 4,
  minimale_contributivo_annuo numeric not null default 0,
  contributi_versati_anno_precedente numeric not null default 0,
  created_at timestamptz not null default now()
);

alter table public.piva_settings enable row level security;

create policy "owner_full_access" on public.piva_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

This is not run automatically — it will be applied manually against Supabase later (same as migrations `0001`/`0002`). No test for this step; proceed to the type and data layer.

- [ ] **Step 2: Add the `PivaSettings` type**

Append to `src/lib/types.ts`:

```ts
export interface PivaSettings {
  id: string;
  attivo: boolean;
  dataApertura: string | null;
  categoriaFatturatoId: string | null;
  coefficienteRedditivita: number;
  aliquotaSostitutivaOverride: number | null;
  aliquotaContributoSoggettivo: number;
  aliquotaContributoIntegrativo: number;
  minimaleContributivoAnnuo: number;
  contributiVersatiAnnoPrecedente: number;
}
```

- [ ] **Step 3: Extend `fakeSupabase.ts` additively for the new query shapes**

`getPivaSettings` needs `.select(...).maybeSingle()` (may return zero rows without erroring). `updatePivaSettings` needs `.update(...).eq(...).select(...).single()` — a chain not currently supported because `fakeMutationClient`'s `eq` resolves directly instead of staying chainable. Add both without changing what existing tests observe:

Modify `tests/helpers/fakeSupabase.ts`:

```ts
export function fakeSelectClient(rows: unknown[]) {
  const builder: any = {
    select: () => builder,
    order: () => Promise.resolve({ data: rows, error: null }),
    eq: () => builder,
    single: () => Promise.resolve({ data: rows[0] ?? null, error: null }),
    maybeSingle: () => Promise.resolve({ data: rows[0] ?? null, error: null }),
    limit: () => builder,
  };
  return { from: () => builder } as any;
}

export function fakeMutationClient(returnedRow: unknown) {
  const builder: any = {
    update: () => builder,
    insert: () => builder,
    delete: () => builder,
    eq: () => eqResult,
    select: () => builder,
    single: () => Promise.resolve({ data: returnedRow, error: null }),
  };
  // `.eq()` on a real Supabase query builder is both awaitable directly
  // (resolves like the old fake did, `{ data: null, error: null }`, for
  // callers that stop the chain right there) and further chainable with
  // `.select().single()` for callers that want the row back.
  const eqResult: any = {
    ...builder,
    then: (resolve: (value: { data: null; error: null }) => void) =>
      resolve({ data: null, error: null }),
  };
  return { from: () => builder } as any;
}
```

- [ ] **Step 4: Write the failing data-layer test**

Create `tests/data/pivaSettings.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { getPivaSettings, createPivaSettings, updatePivaSettings } from '@/lib/data/pivaSettings';
import { fakeSelectClient, fakeMutationClient } from '../helpers/fakeSupabase';

const row = {
  id: '1',
  attivo: true,
  data_apertura: '2024-01-15',
  categoria_fatturato_id: 'cat-fatt',
  coefficiente_redditivita: 78,
  aliquota_sostitutiva_override: null,
  aliquota_contributo_soggettivo: 10,
  aliquota_contributo_integrativo: 4,
  minimale_contributivo_annuo: 856,
  contributi_versati_anno_precedente: 0,
};

const input = {
  attivo: true,
  dataApertura: '2024-01-15',
  categoriaFatturatoId: 'cat-fatt',
  coefficienteRedditivita: 78,
  aliquotaSostitutivaOverride: null,
  aliquotaContributoSoggettivo: 10,
  aliquotaContributoIntegrativo: 4,
  minimaleContributivoAnnuo: 856,
  contributiVersatiAnnoPrecedente: 0,
};

const mapped = {
  id: '1',
  attivo: true,
  dataApertura: '2024-01-15',
  categoriaFatturatoId: 'cat-fatt',
  coefficienteRedditivita: 78,
  aliquotaSostitutivaOverride: null,
  aliquotaContributoSoggettivo: 10,
  aliquotaContributoIntegrativo: 4,
  minimaleContributivoAnnuo: 856,
  contributiVersatiAnnoPrecedente: 0,
};

describe('getPivaSettings', () => {
  it('mappa la riga esistente', async () => {
    const supabase = fakeSelectClient([row]);
    const result = await getPivaSettings(supabase);
    expect(result).toEqual(mapped);
  });

  it('ritorna null se non esiste ancora nessuna riga', async () => {
    const supabase = fakeSelectClient([]);
    const result = await getPivaSettings(supabase);
    expect(result).toBeNull();
  });
});

describe('createPivaSettings', () => {
  it('inserisce e ritorna la riga mappata', async () => {
    const supabase = fakeMutationClient(row);
    const result = await createPivaSettings(supabase, input);
    expect(result).toEqual(mapped);
  });
});

describe('updatePivaSettings', () => {
  it('aggiorna e ritorna la riga mappata', async () => {
    const supabase = fakeMutationClient(row);
    const result = await updatePivaSettings(supabase, '1', input);
    expect(result).toEqual(mapped);
  });
});
```

- [ ] **Step 5: Run the test to verify it fails**

Run: `npx vitest run tests/data/pivaSettings.test.ts`
Expected: FAIL — `Cannot find module '@/lib/data/pivaSettings'`.

- [ ] **Step 6: Implement the data layer**

Create `src/lib/data/pivaSettings.ts`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { PivaSettings } from '../types';

interface PivaSettingsRow {
  id: string;
  attivo: boolean;
  data_apertura: string | null;
  categoria_fatturato_id: string | null;
  coefficiente_redditivita: number;
  aliquota_sostitutiva_override: number | null;
  aliquota_contributo_soggettivo: number;
  aliquota_contributo_integrativo: number;
  minimale_contributivo_annuo: number;
  contributi_versati_anno_precedente: number;
}

const SELECT_COLUMNS =
  'id, attivo, data_apertura, categoria_fatturato_id, coefficiente_redditivita, ' +
  'aliquota_sostitutiva_override, aliquota_contributo_soggettivo, aliquota_contributo_integrativo, ' +
  'minimale_contributivo_annuo, contributi_versati_anno_precedente';

function mapRow(row: PivaSettingsRow): PivaSettings {
  return {
    id: row.id,
    attivo: row.attivo,
    dataApertura: row.data_apertura,
    categoriaFatturatoId: row.categoria_fatturato_id,
    coefficienteRedditivita: row.coefficiente_redditivita,
    aliquotaSostitutivaOverride: row.aliquota_sostitutiva_override,
    aliquotaContributoSoggettivo: row.aliquota_contributo_soggettivo,
    aliquotaContributoIntegrativo: row.aliquota_contributo_integrativo,
    minimaleContributivoAnnuo: row.minimale_contributivo_annuo,
    contributiVersatiAnnoPrecedente: row.contributi_versati_anno_precedente,
  };
}

export interface PivaSettingsInput {
  attivo: boolean;
  dataApertura: string | null;
  categoriaFatturatoId: string | null;
  coefficienteRedditivita: number;
  aliquotaSostitutivaOverride: number | null;
  aliquotaContributoSoggettivo: number;
  aliquotaContributoIntegrativo: number;
  minimaleContributivoAnnuo: number;
  contributiVersatiAnnoPrecedente: number;
}

function toRow(input: PivaSettingsInput) {
  return {
    attivo: input.attivo,
    data_apertura: input.dataApertura,
    categoria_fatturato_id: input.categoriaFatturatoId,
    coefficiente_redditivita: input.coefficienteRedditivita,
    aliquota_sostitutiva_override: input.aliquotaSostitutivaOverride,
    aliquota_contributo_soggettivo: input.aliquotaContributoSoggettivo,
    aliquota_contributo_integrativo: input.aliquotaContributoIntegrativo,
    minimale_contributivo_annuo: input.minimaleContributivoAnnuo,
    contributi_versati_anno_precedente: input.contributiVersatiAnnoPrecedente,
  };
}

export async function getPivaSettings(supabase: SupabaseClient): Promise<PivaSettings | null> {
  const { data, error } = await supabase.from('piva_settings').select(SELECT_COLUMNS).maybeSingle();
  if (error) throw error;
  return data ? mapRow(data as PivaSettingsRow) : null;
}

export async function createPivaSettings(
  supabase: SupabaseClient,
  input: PivaSettingsInput
): Promise<PivaSettings> {
  const { data, error } = await supabase
    .from('piva_settings')
    .insert(toRow(input))
    .select(SELECT_COLUMNS)
    .single();

  if (error) throw error;
  return mapRow(data as PivaSettingsRow);
}

export async function updatePivaSettings(
  supabase: SupabaseClient,
  id: string,
  input: PivaSettingsInput
): Promise<PivaSettings> {
  const { data, error } = await supabase
    .from('piva_settings')
    .update(toRow(input))
    .eq('id', id)
    .select(SELECT_COLUMNS)
    .single();

  if (error) throw error;
  return mapRow(data as PivaSettingsRow);
}
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `npx vitest run tests/data/pivaSettings.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 8: Run the full suite to confirm no regressions from the `fakeSupabase.ts` change**

Run: `npx vitest run`
Expected: PASS, same or higher test count than before this task, zero failures.

- [ ] **Step 9: Commit**

```bash
git add supabase/migrations/0003_piva_settings.sql src/lib/types.ts src/lib/data/pivaSettings.ts tests/helpers/fakeSupabase.ts tests/data/pivaSettings.test.ts
git commit -m "feat: add piva_settings table and data layer"
```

---

### Task 2: Pure tax/contribution calculations

**Files:**
- Create: `src/lib/calculations/piva.ts`
- Test: `tests/calculations/piva.test.ts`

**Interfaces:**
- Consumes: `Transaction` type from `src/lib/types.ts` (fields `tipo`, `categoriaId`, `data`, `importo`, as read in Task 1's summary of existing code).
- Produces: `computeFatturatoAnnuo(transactions: Transaction[], categoriaFatturatoId: string, anno: number): number`, `computeAliquotaSostitutiva(dataApertura: string | null, today: Date, override: number | null): number`, `computeRedditoImponibile(fatturato: number, coefficienteRedditivita: number, contributiVersatiAnnoPrecedente: number): number`, `computeImpostaSostitutiva(redditoImponibile: number, aliquota: number): number`, `computeContributoSoggettivo(redditoImponibile: number, aliquotaContributoSoggettivo: number, minimaleContributivoAnnuo: number): number`, `computeContributoIntegrativo(fatturato: number, aliquotaContributoIntegrativo: number): number`, `computeTotaleDaAccantonare(impostaSostitutiva: number, contributoSoggettivo: number, contributoIntegrativo: number): number`, `computeQuotaMensileSuggerita(totale: number, today: Date): number` — all consumed by Task 5's page.

- [ ] **Step 1: Write the failing tests**

Create `tests/calculations/piva.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  computeFatturatoAnnuo,
  computeAliquotaSostitutiva,
  computeRedditoImponibile,
  computeImpostaSostitutiva,
  computeContributoSoggettivo,
  computeContributoIntegrativo,
  computeTotaleDaAccantonare,
  computeQuotaMensileSuggerita,
} from '@/lib/calculations/piva';
import type { Transaction } from '@/lib/types';

function tx(overrides: Partial<Transaction>): Transaction {
  return {
    id: 'x',
    tipo: 'income',
    importo: 0,
    data: '2026-01-01',
    categoriaId: null,
    accountId: null,
    goalId: null,
    descrizione: '',
    nota: null,
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('computeFatturatoAnnuo', () => {
  it('somma solo le entrate della categoria fatturato nell\'anno indicato', () => {
    const transactions = [
      tx({ tipo: 'income', categoriaId: 'cat-fatt', data: '2026-02-10', importo: 1000 }),
      tx({ tipo: 'income', categoriaId: 'cat-fatt', data: '2026-06-01', importo: 2000 }),
      tx({ tipo: 'income', categoriaId: 'cat-fatt', data: '2025-12-31', importo: 5000 }),
      tx({ tipo: 'income', categoriaId: 'cat-altro', data: '2026-03-01', importo: 999 }),
      tx({ tipo: 'expense', categoriaId: 'cat-fatt', data: '2026-03-01', importo: 50 }),
    ];

    expect(computeFatturatoAnnuo(transactions, 'cat-fatt', 2026)).toBe(3000);
  });
});

describe('computeAliquotaSostitutiva', () => {
  it('usa l\'override quando presente', () => {
    expect(computeAliquotaSostitutiva('2020-01-01', new Date('2026-06-01'), 15)).toBe(15);
  });

  it('ritorna 5 se sono passati meno di 5 anni dall\'apertura', () => {
    expect(computeAliquotaSostitutiva('2023-01-01', new Date('2026-06-01'), null)).toBe(5);
  });

  it('ritorna 15 se sono passati 5 anni o più dall\'apertura', () => {
    expect(computeAliquotaSostitutiva('2020-01-01', new Date('2026-06-01'), null)).toBe(15);
  });

  it('ritorna 15 se la data di apertura non è impostata', () => {
    expect(computeAliquotaSostitutiva(null, new Date('2026-06-01'), null)).toBe(15);
  });
});

describe('computeRedditoImponibile', () => {
  it('applica il coefficiente e deduce i contributi versati l\'anno precedente', () => {
    expect(computeRedditoImponibile(10000, 78, 500)).toBe(7300);
  });

  it('non va mai sotto zero', () => {
    expect(computeRedditoImponibile(100, 78, 500)).toBe(0);
  });
});

describe('computeImpostaSostitutiva', () => {
  it('applica l\'aliquota al reddito imponibile', () => {
    expect(computeImpostaSostitutiva(7300, 5)).toBe(365);
  });
});

describe('computeContributoSoggettivo', () => {
  it('applica l\'aliquota quando supera il minimale', () => {
    expect(computeContributoSoggettivo(10000, 10, 856)).toBe(1000);
  });

  it('usa il minimale quando il calcolo percentuale è sotto soglia', () => {
    expect(computeContributoSoggettivo(1000, 10, 856)).toBe(856);
  });
});

describe('computeContributoIntegrativo', () => {
  it('applica l\'aliquota al fatturato lordo', () => {
    expect(computeContributoIntegrativo(10000, 4)).toBe(400);
  });
});

describe('computeTotaleDaAccantonare', () => {
  it('somma imposta sostitutiva e i due contributi', () => {
    expect(computeTotaleDaAccantonare(365, 1000, 400)).toBe(1765);
  });
});

describe('computeQuotaMensileSuggerita', () => {
  it('divide il totale per i mesi rimanenti nell\'anno solare, incluso quello corrente', () => {
    // Giugno = 6 mesi rimanenti (giu, lug, ago, set, ott, nov, dic = 7 in realtà: verificare)
    expect(computeQuotaMensileSuggerita(1200, new Date('2026-01-15'))).toBe(100);
  });

  it('a dicembre resta un solo mese', () => {
    expect(computeQuotaMensileSuggerita(1200, new Date('2026-12-01'))).toBe(1200);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/calculations/piva.test.ts`
Expected: FAIL — `Cannot find module '@/lib/calculations/piva'`.

- [ ] **Step 3: Implement the calculations**

Create `src/lib/calculations/piva.ts`:

```ts
import { differenceInCalendarYears, parseISO } from 'date-fns';
import type { Transaction } from '../types';

export function computeFatturatoAnnuo(
  transactions: Transaction[],
  categoriaFatturatoId: string,
  anno: number
): number {
  return transactions
    .filter(
      (t) =>
        t.tipo === 'income' &&
        t.categoriaId === categoriaFatturatoId &&
        parseISO(t.data).getFullYear() === anno
    )
    .reduce((sum, t) => sum + t.importo, 0);
}

export function computeAliquotaSostitutiva(
  dataApertura: string | null,
  today: Date,
  override: number | null
): number {
  if (override !== null) return override;
  if (!dataApertura) return 15;

  const anniAttivita = differenceInCalendarYears(today, parseISO(dataApertura));
  return anniAttivita < 5 ? 5 : 15;
}

export function computeRedditoImponibile(
  fatturato: number,
  coefficienteRedditivita: number,
  contributiVersatiAnnoPrecedente: number
): number {
  const redditoLordo = (fatturato * coefficienteRedditivita) / 100;
  return Math.max(0, redditoLordo - contributiVersatiAnnoPrecedente);
}

export function computeImpostaSostitutiva(redditoImponibile: number, aliquota: number): number {
  return (redditoImponibile * aliquota) / 100;
}

export function computeContributoSoggettivo(
  redditoImponibile: number,
  aliquotaContributoSoggettivo: number,
  minimaleContributivoAnnuo: number
): number {
  return Math.max(
    (redditoImponibile * aliquotaContributoSoggettivo) / 100,
    minimaleContributivoAnnuo
  );
}

export function computeContributoIntegrativo(
  fatturato: number,
  aliquotaContributoIntegrativo: number
): number {
  return (fatturato * aliquotaContributoIntegrativo) / 100;
}

export function computeTotaleDaAccantonare(
  impostaSostitutiva: number,
  contributoSoggettivo: number,
  contributoIntegrativo: number
): number {
  return impostaSostitutiva + contributoSoggettivo + contributoIntegrativo;
}

export function computeQuotaMensileSuggerita(totale: number, today: Date): number {
  const mesiRimanenti = 12 - today.getMonth();
  return totale / mesiRimanenti;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/calculations/piva.test.ts`
Expected: PASS (12 tests). Note on the "quota mensile" test names: `getMonth()` is 0-indexed, so January (`getMonth() === 0`) leaves `12 - 0 = 12` months and December (`getMonth() === 11`) leaves `12 - 11 = 1` month — matching the two assertions above (1200/12=100, 1200/1=1200).

- [ ] **Step 5: Commit**

```bash
git add src/lib/calculations/piva.ts tests/calculations/piva.test.ts
git commit -m "feat: add pure P.IVA tax and contribution calculations"
```

---

### Task 3: `PivaSettingsForm` component

**Files:**
- Create: `src/app/piva/PivaSettingsForm.tsx`
- Test: `tests/PivaSettingsForm.test.tsx`

**Interfaces:**
- Consumes: `Category` type from `src/lib/types.ts` (fields `id`, `nome`, `tipo`, `archiviata`).
- Produces: `PivaSettingsFormValues` type and `PivaSettingsForm` component with props `{ categories: Category[]; initial: PivaSettingsFormValues | null; submitLabel: string; onSubmit: (values: PivaSettingsFormValues) => void }` — consumed by Task 5's page (a `PivaSettings` object from Task 1 satisfies `PivaSettingsFormValues` structurally, since it is a superset of the same fields).

- [ ] **Step 1: Write the failing tests**

Create `tests/PivaSettingsForm.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PivaSettingsForm } from '@/app/piva/PivaSettingsForm';

const categories = [
  { id: 'cat-fatt', nome: 'Compensi liberi professionali', tipo: 'income' as const, colore: null, archiviata: false },
  { id: 'cat-regalo', nome: 'Regali', tipo: 'income' as const, colore: null, archiviata: false },
  { id: 'cat-spesa', nome: 'Spesa', tipo: 'expense' as const, colore: null, archiviata: false },
];

describe('PivaSettingsForm', () => {
  it('disabilita il submit finché non si seleziona una categoria fatturato', () => {
    render(
      <PivaSettingsForm categories={categories} initial={null} submitLabel="Attiva gestione P.IVA" onSubmit={vi.fn()} />
    );

    expect(screen.getByText('Attiva gestione P.IVA')).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Categoria fatturato'), { target: { value: 'cat-fatt' } });

    expect(screen.getByText('Attiva gestione P.IVA')).not.toBeDisabled();
  });

  it('non mostra le categorie di spesa nel select', () => {
    render(
      <PivaSettingsForm categories={categories} initial={null} submitLabel="Attiva gestione P.IVA" onSubmit={vi.fn()} />
    );

    expect(screen.queryByText('Spesa')).not.toBeInTheDocument();
    expect(screen.getByText('Regali')).toBeInTheDocument();
  });

  it('invia i valori di default insieme alla categoria selezionata', () => {
    const onSubmit = vi.fn();
    render(
      <PivaSettingsForm categories={categories} initial={null} submitLabel="Attiva gestione P.IVA" onSubmit={onSubmit} />
    );

    fireEvent.change(screen.getByLabelText('Categoria fatturato'), { target: { value: 'cat-fatt' } });
    fireEvent.click(screen.getByText('Attiva gestione P.IVA'));

    expect(onSubmit).toHaveBeenCalledWith({
      dataApertura: null,
      categoriaFatturatoId: 'cat-fatt',
      coefficienteRedditivita: 78,
      aliquotaSostitutivaOverride: null,
      aliquotaContributoSoggettivo: 10,
      aliquotaContributoIntegrativo: 4,
      minimaleContributivoAnnuo: 0,
      contributiVersatiAnnoPrecedente: 0,
    });
  });

  it('precompila i campi quando riceve dei valori iniziali e li invia modificati', () => {
    const onSubmit = vi.fn();
    render(
      <PivaSettingsForm
        categories={categories}
        initial={{
          dataApertura: '2023-05-01',
          categoriaFatturatoId: 'cat-fatt',
          coefficienteRedditivita: 78,
          aliquotaSostitutivaOverride: 15,
          aliquotaContributoSoggettivo: 12,
          aliquotaContributoIntegrativo: 4,
          minimaleContributivoAnnuo: 856,
          contributiVersatiAnnoPrecedente: 300,
        }}
        submitLabel="Salva modifiche"
        onSubmit={onSubmit}
      />
    );

    expect(screen.getByLabelText('Minimale contributivo annuo')).toHaveValue(856);

    fireEvent.change(screen.getByLabelText('Minimale contributivo annuo'), { target: { value: '900' } });
    fireEvent.click(screen.getByText('Salva modifiche'));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ minimaleContributivoAnnuo: 900, aliquotaSostitutivaOverride: 15 })
    );
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/PivaSettingsForm.test.tsx`
Expected: FAIL — `Cannot find module '@/app/piva/PivaSettingsForm'`.

- [ ] **Step 3: Implement the component**

Create `src/app/piva/PivaSettingsForm.tsx`:

```tsx
'use client';

import { useState } from 'react';
import type { Category } from '@/lib/types';

export interface PivaSettingsFormValues {
  dataApertura: string | null;
  categoriaFatturatoId: string | null;
  coefficienteRedditivita: number;
  aliquotaSostitutivaOverride: number | null;
  aliquotaContributoSoggettivo: number;
  aliquotaContributoIntegrativo: number;
  minimaleContributivoAnnuo: number;
  contributiVersatiAnnoPrecedente: number;
}

const DEFAULTS: PivaSettingsFormValues = {
  dataApertura: null,
  categoriaFatturatoId: null,
  coefficienteRedditivita: 78,
  aliquotaSostitutivaOverride: null,
  aliquotaContributoSoggettivo: 10,
  aliquotaContributoIntegrativo: 4,
  minimaleContributivoAnnuo: 0,
  contributiVersatiAnnoPrecedente: 0,
};

const fieldClass =
  'rounded-[var(--radius-md)] border border-black/5 bg-surface-muted px-4 py-3 text-base outline-none focus-visible:border-brand';

export function PivaSettingsForm({
  categories,
  initial,
  submitLabel,
  onSubmit,
}: {
  categories: Category[];
  initial: PivaSettingsFormValues | null;
  submitLabel: string;
  onSubmit: (values: PivaSettingsFormValues) => void;
}) {
  const start = initial ?? DEFAULTS;

  const [dataApertura, setDataApertura] = useState(start.dataApertura ?? '');
  const [categoriaFatturatoId, setCategoriaFatturatoId] = useState<string | null>(
    start.categoriaFatturatoId
  );
  const [coefficienteRedditivita, setCoefficienteRedditivita] = useState(
    String(start.coefficienteRedditivita)
  );
  const [aliquotaOverride, setAliquotaOverride] = useState<'auto' | '5' | '15'>(
    start.aliquotaSostitutivaOverride === null
      ? 'auto'
      : (String(start.aliquotaSostitutivaOverride) as '5' | '15')
  );
  const [aliquotaSoggettivo, setAliquotaSoggettivo] = useState(
    String(start.aliquotaContributoSoggettivo)
  );
  const [aliquotaIntegrativo, setAliquotaIntegrativo] = useState(
    String(start.aliquotaContributoIntegrativo)
  );
  const [minimale, setMinimale] = useState(String(start.minimaleContributivoAnnuo));
  const [contributiVersati, setContributiVersati] = useState(
    String(start.contributiVersatiAnnoPrecedente)
  );

  const categorieFatturato = categories.filter((c) => !c.archiviata && c.tipo === 'income');

  const numeriValidi = [
    coefficienteRedditivita,
    aliquotaSoggettivo,
    aliquotaIntegrativo,
    minimale,
    contributiVersati,
  ].every((v) => v.trim() !== '' && !Number.isNaN(Number(v)));

  const isValid = categoriaFatturatoId !== null && numeriValidi;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;

    onSubmit({
      dataApertura: dataApertura.trim() === '' ? null : dataApertura,
      categoriaFatturatoId,
      coefficienteRedditivita: Number(coefficienteRedditivita),
      aliquotaSostitutivaOverride: aliquotaOverride === 'auto' ? null : Number(aliquotaOverride),
      aliquotaContributoSoggettivo: Number(aliquotaSoggettivo),
      aliquotaContributoIntegrativo: Number(aliquotaIntegrativo),
      minimaleContributivoAnnuo: Number(minimale),
      contributiVersatiAnnoPrecedente: Number(contributiVersati),
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 rounded-[var(--radius-lg)] bg-surface p-5 shadow-[var(--shadow-card)]"
    >
      <label className="flex flex-col gap-1.5 text-sm font-medium text-muted">
        Data apertura P.IVA (opzionale)
        <input
          aria-label="Data apertura"
          type="date"
          value={dataApertura}
          onChange={(e) => setDataApertura(e.target.value)}
          className={fieldClass}
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm font-medium text-muted">
        Categoria fatturato
        <select
          aria-label="Categoria fatturato"
          value={categoriaFatturatoId ?? ''}
          onChange={(e) => setCategoriaFatturatoId(e.target.value || null)}
          className={fieldClass}
        >
          <option value="">Seleziona una categoria</option>
          {categorieFatturato.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1.5 text-sm font-medium text-muted">
        Coefficiente di redditività (%)
        <input
          aria-label="Coefficiente di redditività"
          type="number"
          inputMode="decimal"
          value={coefficienteRedditivita}
          onChange={(e) => setCoefficienteRedditivita(e.target.value)}
          className={fieldClass}
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm font-medium text-muted">
        Aliquota imposta sostitutiva
        <select
          aria-label="Aliquota imposta sostitutiva"
          value={aliquotaOverride}
          onChange={(e) => setAliquotaOverride(e.target.value as 'auto' | '5' | '15')}
          className={fieldClass}
        >
          <option value="auto">Automatica (in base alla data apertura)</option>
          <option value="5">5% (fissa)</option>
          <option value="15">15% (fissa)</option>
        </select>
      </label>

      <label className="flex flex-col gap-1.5 text-sm font-medium text-muted">
        Aliquota contributo soggettivo (%)
        <input
          aria-label="Aliquota contributo soggettivo"
          type="number"
          inputMode="decimal"
          value={aliquotaSoggettivo}
          onChange={(e) => setAliquotaSoggettivo(e.target.value)}
          className={fieldClass}
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm font-medium text-muted">
        Aliquota contributo integrativo (%)
        <input
          aria-label="Aliquota contributo integrativo"
          type="number"
          inputMode="decimal"
          value={aliquotaIntegrativo}
          onChange={(e) => setAliquotaIntegrativo(e.target.value)}
          className={fieldClass}
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm font-medium text-muted">
        Minimale contributivo annuo
        <input
          aria-label="Minimale contributivo annuo"
          type="number"
          inputMode="decimal"
          value={minimale}
          onChange={(e) => setMinimale(e.target.value)}
          className={fieldClass}
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm font-medium text-muted">
        Contributi versati l&apos;anno precedente
        <input
          aria-label="Contributi versati l'anno precedente"
          type="number"
          inputMode="decimal"
          value={contributiVersati}
          onChange={(e) => setContributiVersati(e.target.value)}
          className={fieldClass}
        />
      </label>

      <button
        type="submit"
        disabled={!isValid}
        className="rounded-[var(--radius-md)] bg-brand py-3 text-sm font-semibold text-brand-foreground disabled:opacity-40"
      >
        {submitLabel}
      </button>
    </form>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/PivaSettingsForm.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/piva/PivaSettingsForm.tsx tests/PivaSettingsForm.test.tsx
git commit -m "feat: add PivaSettingsForm component"
```

---

### Task 4: `PivaDashboard` component

**Files:**
- Create: `src/app/piva/PivaDashboard.tsx`
- Test: `tests/PivaDashboard.test.tsx`

**Interfaces:**
- Consumes: `formatEuro` from `src/lib/format.ts`.
- Produces: `PivaDashboard` component with props `{ fatturatoAnnuo: number; impostaSostitutiva: number; contributoSoggettivo: number; contributoIntegrativo: number; totaleDaAccantonare: number; quotaMensileSuggerita: number; onModifica: () => void; onDisattiva: () => void }` — consumed by Task 5's page.

- [ ] **Step 1: Write the failing test**

Create `tests/PivaDashboard.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PivaDashboard } from '@/app/piva/PivaDashboard';

describe('PivaDashboard', () => {
  it('mostra tutte le cifre calcolate formattate in euro', () => {
    render(
      <PivaDashboard
        fatturatoAnnuo={10000}
        impostaSostitutiva={365}
        contributoSoggettivo={1000}
        contributoIntegrativo={400}
        totaleDaAccantonare={1765}
        quotaMensileSuggerita={147.08}
        onModifica={vi.fn()}
        onDisattiva={vi.fn()}
      />
    );

    expect(screen.getByText(/10\.000,00/)).toBeInTheDocument();
    expect(screen.getByText(/365,00/)).toBeInTheDocument();
    expect(screen.getByText(/1\.000,00/)).toBeInTheDocument();
    expect(screen.getByText(/400,00/)).toBeInTheDocument();
    expect(screen.getByText(/1\.765,00/)).toBeInTheDocument();
    expect(screen.getByText(/147,08/)).toBeInTheDocument();
  });

  it('chiama onModifica e onDisattiva al click dei rispettivi pulsanti', () => {
    const onModifica = vi.fn();
    const onDisattiva = vi.fn();
    render(
      <PivaDashboard
        fatturatoAnnuo={10000}
        impostaSostitutiva={365}
        contributoSoggettivo={1000}
        contributoIntegrativo={400}
        totaleDaAccantonare={1765}
        quotaMensileSuggerita={147.08}
        onModifica={onModifica}
        onDisattiva={onDisattiva}
      />
    );

    fireEvent.click(screen.getByText('Modifica impostazioni'));
    expect(onModifica).toHaveBeenCalled();

    fireEvent.click(screen.getByText('Disattiva gestione P.IVA'));
    expect(onDisattiva).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/PivaDashboard.test.tsx`
Expected: FAIL — `Cannot find module '@/app/piva/PivaDashboard'`.

- [ ] **Step 3: Implement the component**

Create `src/app/piva/PivaDashboard.tsx`:

```tsx
import { formatEuro } from '@/lib/format';

export function PivaDashboard({
  fatturatoAnnuo,
  impostaSostitutiva,
  contributoSoggettivo,
  contributoIntegrativo,
  totaleDaAccantonare,
  quotaMensileSuggerita,
  onModifica,
  onDisattiva,
}: {
  fatturatoAnnuo: number;
  impostaSostitutiva: number;
  contributoSoggettivo: number;
  contributoIntegrativo: number;
  totaleDaAccantonare: number;
  quotaMensileSuggerita: number;
  onModifica: () => void;
  onDisattiva: () => void;
}) {
  const righe: Array<{ label: string; value: number }> = [
    { label: 'Fatturato registrato quest’anno', value: fatturatoAnnuo },
    { label: 'Imposta sostitutiva stimata', value: impostaSostitutiva },
    { label: 'Contributo soggettivo stimato', value: contributoSoggettivo },
    { label: 'Contributo integrativo stimato', value: contributoIntegrativo },
  ];

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-[var(--radius-lg)] bg-brand p-7 text-brand-foreground shadow-[var(--shadow-hero)]">
        <p className="text-sm font-medium text-brand-foreground/75">Totale da accantonare</p>
        <p className="mt-1 text-5xl font-bold tabular-nums tracking-tight">
          {formatEuro(totaleDaAccantonare)}
        </p>
        <div className="mt-5 h-px bg-brand-foreground/15" />
        <p className="mt-5 text-sm text-brand-foreground/85">
          Quota mensile suggerita: <span className="font-semibold">{formatEuro(quotaMensileSuggerita)}</span>
        </p>
      </section>

      <section className="flex flex-col gap-2 rounded-[var(--radius-md)] bg-surface p-4 text-sm shadow-[var(--shadow-card)]">
        {righe.map((r) => (
          <div key={r.label} className="flex justify-between py-1">
            <span className="font-medium">{r.label}</span>
            <span className="tabular-nums">{formatEuro(r.value)}</span>
          </div>
        ))}
      </section>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={onModifica}
          className="rounded-[var(--radius-md)] bg-surface py-3 text-sm font-semibold text-foreground shadow-[var(--shadow-card)]"
        >
          Modifica impostazioni
        </button>
        <button
          type="button"
          onClick={onDisattiva}
          className="rounded-[var(--radius-md)] py-3 text-sm font-semibold text-danger"
        >
          Disattiva gestione P.IVA
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/PivaDashboard.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/piva/PivaDashboard.tsx tests/PivaDashboard.test.tsx
git commit -m "feat: add PivaDashboard component"
```

---

### Task 5: `/piva` page wiring and navigation entry

**Files:**
- Create: `src/app/piva/page.tsx`
- Modify: `src/app/NavBar.tsx`
- Test: `tests/PivaPage.test.tsx`

**Interfaces:**
- Consumes: `getPivaSettings`/`createPivaSettings`/`updatePivaSettings` (Task 1), `computeFatturatoAnnuo`/`computeAliquotaSostitutiva`/`computeRedditoImponibile`/`computeImpostaSostitutiva`/`computeContributoSoggettivo`/`computeContributoIntegrativo`/`computeTotaleDaAccantonare`/`computeQuotaMensileSuggerita` (Task 2), `PivaSettingsForm`/`PivaSettingsFormValues` (Task 3), `PivaDashboard` (Task 4), `getCategories` from `src/lib/data/categories.ts`, `getTransactions` from `src/lib/data/transactions.ts`, `createClient` from `src/lib/supabase/client.ts`.
- Produces: default-exported `PivaPage` component at route `/piva`; no other file depends on this one.

- [ ] **Step 1: Write the failing tests**

Create `tests/PivaPage.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PivaPage from '@/app/piva/page';

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({}),
}));

vi.mock('@/lib/data/pivaSettings', () => ({
  getPivaSettings: vi.fn(),
  createPivaSettings: vi.fn(),
  updatePivaSettings: vi.fn(),
}));

vi.mock('@/lib/data/categories', () => ({
  getCategories: vi.fn(),
}));

vi.mock('@/lib/data/transactions', () => ({
  getTransactions: vi.fn(),
}));

import { getPivaSettings, createPivaSettings, updatePivaSettings } from '@/lib/data/pivaSettings';
import { getCategories } from '@/lib/data/categories';
import { getTransactions } from '@/lib/data/transactions';

const categories = [
  { id: 'cat-fatt', nome: 'Compensi', tipo: 'income' as const, colore: null, archiviata: false },
];

const annoCorrente = new Date().getFullYear();

const transactions = [
  {
    id: 't1',
    tipo: 'income' as const,
    importo: 6000,
    data: `${annoCorrente}-02-10`,
    categoriaId: 'cat-fatt',
    accountId: null,
    goalId: null,
    descrizione: 'Fattura 1',
    nota: null,
    createdAt: `${annoCorrente}-02-10T00:00:00Z`,
  },
  {
    id: 't2',
    tipo: 'income' as const,
    importo: 4000,
    data: `${annoCorrente}-05-20`,
    categoriaId: 'cat-fatt',
    accountId: null,
    goalId: null,
    descrizione: 'Fattura 2',
    nota: null,
    createdAt: `${annoCorrente}-05-20T00:00:00Z`,
  },
];

describe('PivaPage', () => {
  it('mostra il form di attivazione quando non esistono impostazioni', async () => {
    vi.mocked(getPivaSettings).mockResolvedValue(null);
    vi.mocked(getCategories).mockResolvedValue(categories);
    vi.mocked(getTransactions).mockResolvedValue([]);
    vi.mocked(createPivaSettings).mockResolvedValue({
      id: '1',
      attivo: true,
      dataApertura: null,
      categoriaFatturatoId: 'cat-fatt',
      coefficienteRedditivita: 78,
      aliquotaSostitutivaOverride: null,
      aliquotaContributoSoggettivo: 10,
      aliquotaContributoIntegrativo: 4,
      minimaleContributivoAnnuo: 0,
      contributiVersatiAnnoPrecedente: 0,
    });

    render(<PivaPage />);

    await waitFor(() => {
      expect(screen.getByText('Attiva gestione P.IVA')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('Categoria fatturato'), { target: { value: 'cat-fatt' } });
    fireEvent.click(screen.getByText('Attiva gestione P.IVA'));

    await waitFor(() => {
      expect(createPivaSettings).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ attivo: true, categoriaFatturatoId: 'cat-fatt' })
      );
    });
  });

  it('mostra la dashboard con i totali calcolati quando la gestione è attiva', async () => {
    vi.mocked(getPivaSettings).mockResolvedValue({
      id: '1',
      attivo: true,
      dataApertura: null,
      categoriaFatturatoId: 'cat-fatt',
      coefficienteRedditivita: 78,
      aliquotaSostitutivaOverride: 5,
      aliquotaContributoSoggettivo: 10,
      aliquotaContributoIntegrativo: 4,
      minimaleContributivoAnnuo: 0,
      contributiVersatiAnnoPrecedente: 0,
    });
    vi.mocked(getCategories).mockResolvedValue(categories);
    vi.mocked(getTransactions).mockResolvedValue(transactions);

    render(<PivaPage />);

    // fatturato = 10000, reddito imponibile = 7800, imposta sostitutiva 5% = 390
    await waitFor(() => {
      expect(screen.getByText(/390,00/)).toBeInTheDocument();
    });
    // contributo soggettivo 10% di 7800 = 780
    expect(screen.getByText(/780,00/)).toBeInTheDocument();
    // contributo integrativo 4% di 10000 = 400
    expect(screen.getByText(/400,00/)).toBeInTheDocument();
  });

  it('disattiva la gestione P.IVA al click e torna al form', async () => {
    vi.mocked(getPivaSettings).mockResolvedValue({
      id: '1',
      attivo: true,
      dataApertura: null,
      categoriaFatturatoId: 'cat-fatt',
      coefficienteRedditivita: 78,
      aliquotaSostitutivaOverride: 5,
      aliquotaContributoSoggettivo: 10,
      aliquotaContributoIntegrativo: 4,
      minimaleContributivoAnnuo: 0,
      contributiVersatiAnnoPrecedente: 0,
    });
    vi.mocked(getCategories).mockResolvedValue(categories);
    vi.mocked(getTransactions).mockResolvedValue(transactions);
    vi.mocked(updatePivaSettings).mockResolvedValue({
      id: '1',
      attivo: false,
      dataApertura: null,
      categoriaFatturatoId: 'cat-fatt',
      coefficienteRedditivita: 78,
      aliquotaSostitutivaOverride: 5,
      aliquotaContributoSoggettivo: 10,
      aliquotaContributoIntegrativo: 4,
      minimaleContributivoAnnuo: 0,
      contributiVersatiAnnoPrecedente: 0,
    });

    render(<PivaPage />);

    await waitFor(() => {
      expect(screen.getByText('Disattiva gestione P.IVA')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Disattiva gestione P.IVA'));

    await waitFor(() => {
      expect(updatePivaSettings).toHaveBeenCalledWith(
        expect.anything(),
        '1',
        expect.objectContaining({ attivo: false })
      );
    });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/PivaPage.test.tsx`
Expected: FAIL — `Cannot find module '@/app/piva/page'`.

- [ ] **Step 3: Implement the page**

Create `src/app/piva/page.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getPivaSettings, createPivaSettings, updatePivaSettings } from '@/lib/data/pivaSettings';
import { getCategories } from '@/lib/data/categories';
import { getTransactions } from '@/lib/data/transactions';
import {
  computeFatturatoAnnuo,
  computeAliquotaSostitutiva,
  computeRedditoImponibile,
  computeImpostaSostitutiva,
  computeContributoSoggettivo,
  computeContributoIntegrativo,
  computeTotaleDaAccantonare,
  computeQuotaMensileSuggerita,
} from '@/lib/calculations/piva';
import { PivaSettingsForm, type PivaSettingsFormValues } from './PivaSettingsForm';
import { PivaDashboard } from './PivaDashboard';
import type { Category, PivaSettings, Transaction } from '@/lib/types';

export default function PivaPage() {
  const [settings, setSettings] = useState<PivaSettings | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState(false);

  async function refresh() {
    const supabase = createClient();
    const [s, cats, txs] = await Promise.all([
      getPivaSettings(supabase),
      getCategories(supabase),
      getTransactions(supabase),
    ]);
    setSettings(s);
    setCategories(cats);
    setTransactions(txs);
    setLoaded(true);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleSave(values: PivaSettingsFormValues) {
    const supabase = createClient();
    const input = { ...values, attivo: true };
    if (settings) {
      await updatePivaSettings(supabase, settings.id, input);
    } else {
      await createPivaSettings(supabase, input);
    }
    setEditing(false);
    await refresh();
  }

  async function handleDisattiva() {
    if (!settings) return;
    const supabase = createClient();
    await updatePivaSettings(supabase, settings.id, {
      attivo: false,
      dataApertura: settings.dataApertura,
      categoriaFatturatoId: settings.categoriaFatturatoId,
      coefficienteRedditivita: settings.coefficienteRedditivita,
      aliquotaSostitutivaOverride: settings.aliquotaSostitutivaOverride,
      aliquotaContributoSoggettivo: settings.aliquotaContributoSoggettivo,
      aliquotaContributoIntegrativo: settings.aliquotaContributoIntegrativo,
      minimaleContributivoAnnuo: settings.minimaleContributivoAnnuo,
      contributiVersatiAnnoPrecedente: settings.contributiVersatiAnnoPrecedente,
    });
    await refresh();
  }

  if (!loaded) return null;

  if (!settings || !settings.attivo || editing) {
    return (
      <main className="mx-auto flex max-w-md flex-col gap-6 p-5 pt-8">
        <h1 className="text-2xl font-bold">P.IVA</h1>
        <PivaSettingsForm
          categories={categories}
          initial={settings}
          submitLabel={settings ? 'Salva modifiche' : 'Attiva gestione P.IVA'}
          onSubmit={handleSave}
        />
      </main>
    );
  }

  const oggi = new Date();
  const anno = oggi.getFullYear();
  const fatturatoAnnuo = settings.categoriaFatturatoId
    ? computeFatturatoAnnuo(transactions, settings.categoriaFatturatoId, anno)
    : 0;
  const redditoImponibile = computeRedditoImponibile(
    fatturatoAnnuo,
    settings.coefficienteRedditivita,
    settings.contributiVersatiAnnoPrecedente
  );
  const aliquotaSostitutiva = computeAliquotaSostitutiva(
    settings.dataApertura,
    oggi,
    settings.aliquotaSostitutivaOverride
  );
  const impostaSostitutiva = computeImpostaSostitutiva(redditoImponibile, aliquotaSostitutiva);
  const contributoSoggettivo = computeContributoSoggettivo(
    redditoImponibile,
    settings.aliquotaContributoSoggettivo,
    settings.minimaleContributivoAnnuo
  );
  const contributoIntegrativo = computeContributoIntegrativo(
    fatturatoAnnuo,
    settings.aliquotaContributoIntegrativo
  );
  const totaleDaAccantonare = computeTotaleDaAccantonare(
    impostaSostitutiva,
    contributoSoggettivo,
    contributoIntegrativo
  );
  const quotaMensileSuggerita = computeQuotaMensileSuggerita(totaleDaAccantonare, oggi);

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 p-5 pt-8">
      <h1 className="text-2xl font-bold">P.IVA</h1>
      <PivaDashboard
        fatturatoAnnuo={fatturatoAnnuo}
        impostaSostitutiva={impostaSostitutiva}
        contributoSoggettivo={contributoSoggettivo}
        contributoIntegrativo={contributoIntegrativo}
        totaleDaAccantonare={totaleDaAccantonare}
        quotaMensileSuggerita={quotaMensileSuggerita}
        onModifica={() => setEditing(true)}
        onDisattiva={handleDisattiva}
      />
    </main>
  );
}
```

- [ ] **Step 4: Add the NavBar entry**

Modify `src/app/NavBar.tsx` — add the `Receipt` icon import and a new link:

```ts
import { Home, Target, BarChart3, Wallet, Tag, Receipt } from 'lucide-react';

const links = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/goals', label: 'Obiettivi', icon: Target },
  { href: '/history', label: 'Storico', icon: BarChart3 },
  { href: '/accounts', label: 'Conti', icon: Wallet },
  { href: '/categories', label: 'Categorie', icon: Tag },
  { href: '/piva', label: 'P.IVA', icon: Receipt },
];
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/PivaPage.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 6: Run the full suite and type-check**

Run: `npx vitest run`
Expected: PASS, all tests green.

Run: `npx tsc --noEmit`
Expected: no output (clean).

- [ ] **Step 7: Commit**

```bash
git add src/app/piva/page.tsx src/app/NavBar.tsx tests/PivaPage.test.tsx
git commit -m "feat: wire up the /piva page and navigation entry"
```

---

## After Task 5

The migration `supabase/migrations/0003_piva_settings.sql` still needs to be run manually against the live Supabase database before this feature works in production — same manual step as migrations `0001` and `0002`. Flag this to the user before merging/deploying.
