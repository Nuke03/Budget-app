-- 0016_icone_categorie.sql
-- Dopo la 0015. Icona facoltativa per ogni categoria: categories.icona, null o uno degli id dell'elenco
-- (lo stesso di src/lib/categoryIcons.ts).
-- Lanciare a mano, una volta. Idempotente: add column if not exists, il controllo si ricrea.
-- Rollback: in fondo al file.
begin;

alter table public.categories add column if not exists icona text null;

alter table public.categories drop constraint if exists categories_icona_check;
alter table public.categories add constraint categories_icona_check check (
  icona is null or icona in (
    'carrello', 'casa', 'auto', 'benzina', 'bus', 'bolletta', 'telefono', 'wifi',
    'salute', 'farmacia', 'svago', 'ristorante', 'caffe', 'regalo', 'vestiti', 'animali',
    'sport', 'viaggio', 'studio', 'lavoro', 'tasse', 'banca', 'bambini', 'altro'
  )
);

commit;

-- ROLLBACK (solo se serve; perde le icone scelte):
-- alter table public.categories drop constraint if exists categories_icona_check;
-- alter table public.categories drop column if exists icona;
