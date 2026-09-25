-- Gastos compartidos entre tutores con saldo.
-- Ejecutar completo en el SQL Editor. Es idempotente. Requiere haber ejecutado antes
-- activity_attribution.sql (usa la función set_created_by()).
--
--  * pets.expense_split: 'none' (cada uno lleva los suyos, por defecto) o 'equal' (a partes iguales).
--  * expenses: guarda quién lo creó (created_by, created_by_name). Cuando la mascota reparte los gastos
--    a partes iguales, sus gastos los ven TODOS sus tutores (solo el autor puede modificarlos o borrarlos).
--  * expense_settlements: pagos entre tutores ("Pedro te pagó $18.500") que reducen el saldo.

alter table public.pets add column if not exists expense_split text not null default 'none';
alter table public.pets drop constraint if exists pets_expense_split_check;
alter table public.pets add constraint pets_expense_split_check check (expense_split in ('none', 'equal'));

alter table public.expenses add column if not exists created_by uuid;
alter table public.expenses add column if not exists created_by_name text;
drop trigger if exists set_created_by_ins on public.expenses;
create trigger set_created_by_ins before insert on public.expenses for each row execute function public.set_created_by();
drop trigger if exists set_created_by_upd on public.expenses;
create trigger set_created_by_upd before update on public.expenses for each row execute function public.set_created_by();

-- Los gastos anteriores ya tenían dueño (user_id): se completa el autor.
update public.expenses e
   set created_by = e.user_id,
       created_by_name = (select nullif(trim(p.name), '') from public.profiles p where p.id = e.user_id)
 where e.created_by is null;

-- Ver los gastos de una mascota que reparte a partes iguales (además de los propios).
drop policy if exists "Split expenses visible to pet tutors" on public.expenses;
create policy "Split expenses visible to pet tutors" on public.expenses
  for select to public
  using (
    pet_id is not null
    and pet_accessible(pet_id)
    and exists (select 1 from public.pets p where p.id = expenses.pet_id and p.expense_split = 'equal')
  );

-- Pagos entre tutores.
create table if not exists public.expense_settlements (
  id              uuid primary key default gen_random_uuid(),
  pet_id          uuid not null references public.pets(id) on delete cascade,
  amount          numeric not null check (amount > 0),
  date            date not null default current_date,
  note            text,
  -- Relativo a quien lo registra: 'paid' = yo le pagué al otro tutor; 'received' = el otro me pagó a mí.
  direction       text not null default 'paid' check (direction in ('paid', 'received')),
  created_by      uuid,
  created_by_name text,
  created_at      timestamptz not null default now()
);
alter table public.expense_settlements add column if not exists direction text not null default 'paid';
alter table public.expense_settlements drop constraint if exists expense_settlements_direction_check;
alter table public.expense_settlements add constraint expense_settlements_direction_check check (direction in ('paid', 'received'));
create index if not exists expense_settlements_pet_idx on public.expense_settlements (pet_id, date desc);

drop trigger if exists set_created_by_ins on public.expense_settlements;
create trigger set_created_by_ins before insert on public.expense_settlements for each row execute function public.set_created_by();
drop trigger if exists set_created_by_upd on public.expense_settlements;
create trigger set_created_by_upd before update on public.expense_settlements for each row execute function public.set_created_by();

alter table public.expense_settlements enable row level security;

drop policy if exists "Tutors view settlements" on public.expense_settlements;
create policy "Tutors view settlements" on public.expense_settlements
  for select to public using (pet_accessible(pet_id));

drop policy if exists "Editors add settlements" on public.expense_settlements;
create policy "Editors add settlements" on public.expense_settlements
  for insert to public with check (pet_editor(pet_id));

drop policy if exists "Authors delete settlements" on public.expense_settlements;
create policy "Authors delete settlements" on public.expense_settlements
  for delete to public using (created_by = auth.uid());
