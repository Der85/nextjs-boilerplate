-- Der's Tracker — initial schema
-- Single-user personal tracker. RLS everywhere; all rows scoped to auth.uid().
-- Run in the Supabase SQL editor (or via the Supabase CLI) after creating the project.

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- Medications ---------------------------------------------------------------
create table if not exists public.medications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name        text not null,
  frequency   text not null check (frequency in ('daily', 'weekly')),
  dose_unit   text,
  days_per_unit numeric not null default 1,
  active      boolean not null default true,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

-- Providers per medication --------------------------------------------------
create table if not exists public.medication_providers (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  medication_id uuid not null references public.medications(id) on delete cascade,
  prescriber    text,
  pharmacy      text,
  contact       text,
  notes         text,
  unique (medication_id)
);

-- Reorder log (current stock is derived, not stored) ------------------------
create table if not exists public.medication_orders (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  medication_id  uuid not null references public.medications(id) on delete cascade,
  date_ordered   date,
  quantity       numeric,
  cost           numeric,
  pharmacy       text,
  date_collected date,
  notes          text,
  created_at     timestamptz not null default now()
);

-- Daily/weekly dose logs ----------------------------------------------------
create table if not exists public.medication_logs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  medication_id uuid not null references public.medications(id) on delete cascade,
  log_date      date not null default current_date,
  amount_taken  numeric not null default 0,
  unique (medication_id, log_date)
);

-- Weekly weight -------------------------------------------------------------
create table if not exists public.weight_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  log_date   date not null default current_date,
  weight_kg  numeric,
  unique (user_id, log_date)
);

-- Finance accounts ----------------------------------------------------------
create table if not exists public.finance_accounts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name         text not null,
  account_type text not null check (account_type in ('cash', 'investment', 'stock')),
  sort_order   int not null default 0,
  active       boolean not null default true
);

-- Monthly finance entries ---------------------------------------------------
create table if not exists public.finance_monthly_entries (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  account_id     uuid not null references public.finance_accounts(id) on delete cascade,
  month          date not null, -- always the 1st of the month
  balance        numeric,       -- balance, or share quantity for 'stock' accounts
  price_per_unit numeric,       -- only for 'stock' accounts
  unique (account_id, month)
);

-- Web Push subscriptions ----------------------------------------------------
create table if not exists public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);

-- Reminder de-dupe log ------------------------------------------------------
create table if not exists public.reminder_log (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  reminder_type text not null check (reminder_type in ('meds', 'weight', 'finance')),
  reminder_date date not null default current_date,
  sent_at       timestamptz not null default now(),
  unique (user_id, reminder_type, reminder_date)
);

-- ---------------------------------------------------------------------------
-- Helpful indexes
-- ---------------------------------------------------------------------------
create index if not exists idx_med_logs_med_date   on public.medication_logs (medication_id, log_date);
create index if not exists idx_med_orders_med       on public.medication_orders (medication_id);
create index if not exists idx_weight_logs_date     on public.weight_logs (user_id, log_date desc);
create index if not exists idx_finance_entries_acct on public.finance_monthly_entries (account_id, month desc);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.medications             enable row level security;
alter table public.medication_providers    enable row level security;
alter table public.medication_orders       enable row level security;
alter table public.medication_logs         enable row level security;
alter table public.weight_logs             enable row level security;
alter table public.finance_accounts        enable row level security;
alter table public.finance_monthly_entries enable row level security;
alter table public.push_subscriptions      enable row level security;
alter table public.reminder_log            enable row level security;

-- One policy per table: full access restricted to the owning user.
-- USING gates reads/updates/deletes; WITH CHECK gates inserts/updates.
do $$
declare
  t text;
  tables text[] := array[
    'medications', 'medication_providers', 'medication_orders', 'medication_logs',
    'weight_logs', 'finance_accounts', 'finance_monthly_entries',
    'push_subscriptions', 'reminder_log'
  ];
begin
  foreach t in array tables loop
    execute format('drop policy if exists %I on public.%I', t || '_owner_all', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)',
      t || '_owner_all', t
    );
  end loop;
end $$;

-- ===========================================================================
-- SEED DATA
-- ===========================================================================
-- Commented out: run this block yourself AFTER you've signed up, so that
-- auth.uid() resolves to your real user id. Uncomment and execute while
-- authenticated (e.g. via the SQL editor with your session, or wrap each
-- insert's user_id with your uid).
--
-- insert into public.medications (name, frequency, dose_unit, days_per_unit, sort_order) values
--   ('Medikinet', 'daily',  'tablet',  1, 1),
--   ('Ritalin',   'daily',  'tablet',  1, 2),
--   ('Gilenya',   'daily',  'capsule', 1, 3),
--   ('Wegovy',    'weekly', 'pen',     7, 4);
--
-- insert into public.finance_accounts (name, account_type, sort_order) values
--   ('Emergency Fund',               'cash',       1),
--   ('Current Account — Personal',   'cash',       2),
--   ('Current Account — Household',  'cash',       3),
--   ('Joint Investment',             'investment', 4),
--   ('MSFT Shares',                  'stock',      5);
