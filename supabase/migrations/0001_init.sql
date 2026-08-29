create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nome text not null,
  saldo_attuale numeric not null default 0,
  conta_in_disponibile boolean not null default true,
  target_saldo numeric,
  created_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nome text not null,
  tipo text not null check (tipo in ('expense', 'income')),
  colore text,
  archiviata boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.budget_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
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
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
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

create policy "owner_full_access" on public.accounts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "owner_full_access" on public.categories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "owner_full_access" on public.budget_goals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "owner_full_access" on public.transactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
