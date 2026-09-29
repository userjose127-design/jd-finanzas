-- JD FINANZAS - ESQUEMA INICIAL DE SUPABASE
-- Ejecutar una sola vez desde Supabase Dashboard > SQL Editor.
-- Este script crea estructura y seguridad; no importa datos de localStorage.

create extension if not exists pgcrypto;

-- --------------------------------------------------------------------------
-- Perfiles: un perfil por usuario de Supabase Auth.
-- --------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Usuario',
  currency_symbol varchar(12) not null default '$',
  currency_code varchar(12) not null default 'USD',
  default_income numeric(12, 2) not null default 0 check (default_income >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- --------------------------------------------------------------------------
-- Quincenas e ingresos.
-- --------------------------------------------------------------------------
create table if not exists public.quincenas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  year smallint not null check (year between 2000 and 2200),
  month smallint not null check (month between 1 and 12),
  period smallint not null check (period in (1, 2)),
  created_at timestamptz not null default timezone('utc', now()),
  unique (user_id, year, month, period),
  unique (id, user_id)
);

create table if not exists public.incomes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  quincena_id uuid not null,
  title varchar(160) not null,
  amount numeric(12, 2) not null check (amount >= 0),
  income_date date,
  created_at timestamptz not null default timezone('utc', now()),
  foreign key (quincena_id, user_id)
    references public.quincenas(id, user_id) on delete cascade
);

create index if not exists incomes_user_id_idx on public.incomes(user_id);
create index if not exists incomes_quincena_id_idx on public.incomes(quincena_id);

-- --------------------------------------------------------------------------
-- Deudas generales y pagos de quincena.
-- --------------------------------------------------------------------------
create table if not exists public.debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title varchar(160) not null,
  creditor varchar(160) not null default 'Varios',
  total_amount numeric(12, 2) not null check (total_amount > 0),
  total_installments integer not null check (total_installments between 1 and 1200),
  paid_installments integer not null default 0 check (paid_installments >= 0),
  installment_amount numeric(12, 2) not null check (installment_amount >= 0),
  due_date_day smallint not null default 15 check (due_date_day between 1 and 31),
  quincena_target smallint not null default 1 check (quincena_target in (1, 2)),
  notes varchar(500) not null default '',
  category varchar(40) not null default 'Cuotas',
  created_at timestamptz not null default timezone('utc', now()),
  unique (id, user_id),
  check (paid_installments <= total_installments)
);

create index if not exists debts_user_id_idx on public.debts(user_id);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  quincena_id uuid not null,
  title varchar(160) not null,
  amount numeric(12, 2) not null check (amount >= 0),
  category varchar(40) not null default 'Otro',
  due_date date,
  paid boolean not null default false,
  linked_debt_id uuid,
  created_at timestamptz not null default timezone('utc', now()),
  foreign key (quincena_id, user_id)
    references public.quincenas(id, user_id) on delete cascade,
  foreign key (linked_debt_id)
    references public.debts(id) on delete set null
);

create index if not exists payments_user_id_idx on public.payments(user_id);
create index if not exists payments_quincena_id_idx on public.payments(quincena_id);
create index if not exists payments_due_date_idx on public.payments(user_id, due_date);

-- --------------------------------------------------------------------------
-- Planes Cashea y calendario de cuotas cada 14 días.
-- --------------------------------------------------------------------------
create table if not exists public.cashea_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title varchar(160) not null,
  merchant varchar(160) not null default '',
  total_amount numeric(12, 2) not null check (total_amount > 0),
  installment_count integer not null check (installment_count between 1 and 120),
  first_date date not null,
  notes varchar(500) not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  unique (id, user_id),
  check (round(total_amount * 100) >= installment_count)
);

create index if not exists cashea_plans_user_id_idx on public.cashea_plans(user_id);

create table if not exists public.cashea_installments (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null,
  installment_number integer not null check (installment_number between 1 and 120),
  due_date date not null,
  amount numeric(12, 2) not null check (amount > 0),
  paid boolean not null default false,
  paid_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  unique (plan_id, installment_number),
  foreign key (plan_id) references public.cashea_plans(id) on delete cascade
);

create index if not exists cashea_installments_due_date_idx
  on public.cashea_installments(plan_id, due_date);

-- --------------------------------------------------------------------------
-- Perfil automático al registrar un usuario en Supabase Auth.
-- --------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'userName', ''),
      nullif(new.raw_user_meta_data ->> 'display_name', ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Usuario'
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- --------------------------------------------------------------------------
-- Comprueba que un pago solo pueda vincularse a una deuda del mismo usuario.
-- --------------------------------------------------------------------------
create or replace function public.ensure_payment_debt_owner()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.linked_debt_id is not null and not exists (
    select 1
    from public.debts debt
    where debt.id = new.linked_debt_id
      and debt.user_id = new.user_id
  ) then
    raise exception 'La deuda vinculada no pertenece al usuario autenticado.';
  end if;
  return new;
end;
$$;

drop trigger if exists payments_debt_owner on public.payments;
create trigger payments_debt_owner
before insert or update of linked_debt_id, user_id on public.payments
for each row execute procedure public.ensure_payment_debt_owner();

-- --------------------------------------------------------------------------
-- Row Level Security: cada usuario solo puede acceder a sus propios datos.
-- --------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.quincenas enable row level security;
alter table public.incomes enable row level security;
alter table public.debts enable row level security;
alter table public.payments enable row level security;
alter table public.cashea_plans enable row level security;
alter table public.cashea_installments enable row level security;

-- Permisos mínimos para usuarios autenticados; no se expone escritura anónima.
revoke all on public.profiles from anon;
revoke all on public.quincenas from anon;
revoke all on public.incomes from anon;
revoke all on public.debts from anon;
revoke all on public.payments from anon;
revoke all on public.cashea_plans from anon;
revoke all on public.cashea_installments from anon;

grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.quincenas to authenticated;
grant select, insert, update, delete on public.incomes to authenticated;
grant select, insert, update, delete on public.debts to authenticated;
grant select, insert, update, delete on public.payments to authenticated;
grant select, insert, update, delete on public.cashea_plans to authenticated;
grant select, insert, update, delete on public.cashea_installments to authenticated;

-- Elimina políticas de una ejecución previa para que el script sea repetible.
drop policy if exists profiles_owner on public.profiles;
drop policy if exists quincenas_owner on public.quincenas;
drop policy if exists incomes_owner on public.incomes;
drop policy if exists debts_owner on public.debts;
drop policy if exists payments_owner on public.payments;
drop policy if exists cashea_plans_owner on public.cashea_plans;
drop policy if exists cashea_installments_owner on public.cashea_installments;

create policy profiles_owner on public.profiles
for all to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

create policy quincenas_owner on public.quincenas
for all to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy incomes_owner on public.incomes
for all to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy debts_owner on public.debts
for all to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy payments_owner on public.payments
for all to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy cashea_plans_owner on public.cashea_plans
for all to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy cashea_installments_owner on public.cashea_installments
for all to authenticated
using (
  exists (
    select 1
    from public.cashea_plans plan
    where plan.id = cashea_installments.plan_id
      and plan.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.cashea_plans plan
    where plan.id = cashea_installments.plan_id
      and plan.user_id = auth.uid()
  )
);

-- Fin del esquema inicial.
