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
