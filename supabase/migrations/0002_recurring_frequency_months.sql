alter table public.budget_goals add column frequenza_mesi numeric;
update public.budget_goals set frequenza_mesi = frequenza_anni * 12 where frequenza_anni is not null;
alter table public.budget_goals drop column frequenza_anni;
