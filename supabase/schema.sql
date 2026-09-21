-- =========================================================
--  APS QUOTE CALCULATOR — CLOUD SCHEMA
--  ---------------------------------------------------------
--  Run this once in Supabase → SQL Editor → New query → Run.
--
--  DESIGN NOTES
--
--  Why a database and not a shared Google Drive folder:
--  Drive is file storage. Two people saving at the same moment
--  would race, and the app had to merge files by hand. A database
--  gives us real rows, real permissions and an updated_at column
--  that makes "who wins" a decision the database makes, not a
--  guess the browser makes.
--
--  One row per quote. The quote body is JSONB rather than thirty
--  columns because a quote's shape is the app's business, not the
--  database's — materials and services are variable-length lists
--  that would otherwise need three child tables. Only the fields
--  we actually query or sort on are lifted out as columns.
--
--  Site photos live inside the JSONB body as data URLs. They are
--  compressed client-side to ~1600px JPEG before saving, so a
--  quote stays in the tens-to-hundreds of KB rather than tens of
--  MB. Moving them to Supabase Storage is the natural next step
--  if quotes grow.
-- =========================================================

-- ---------------------------------------------------------
--  0. Helping hands
-- ---------------------------------------------------------

-- updated_at is maintained by the database, never by the client.
-- A browser with a wrong clock must not be able to convince the
-- server that its edit is the newest one.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------
--  1. Quotes
-- ---------------------------------------------------------
create table if not exists public.quotes (
  -- The human-facing quote number, e.g. 'PW-2026-001'. This is
  -- the primary key because that is what the app already uses as
  -- its identity, and it is what staff read out over the phone.
  id          text        primary key,

  -- The quote body: customer, labour, materials, services, totals,
  -- sitePhotos. Stored whole so the app can round-trip a quote
  -- without the database needing to understand it.
  body        jsonb       not null default '{}'::jsonb,

  -- Lifted out of body for listing and ordering in the Saved
  -- quotes view, so that screen does not have to download every
  -- quote's full body just to show a list.
  customer_name text,
  quote_date    timestamptz,

  -- Populated from the signed-in user. Used by the row-level
  -- security policy below, and tells you who took the job.
  created_by  uuid        references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists quotes_updated_at_idx on public.quotes (updated_at desc);
create index if not exists quotes_created_by_idx on public.quotes (created_by);

drop trigger if exists quotes_touch_updated_at on public.quotes;
create trigger quotes_touch_updated_at
  before update on public.quotes
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------
--  2. Shared company settings and price list
--  ---------------------------------------------------------
--  These are deliberately ONE row each, keyed by a fixed id.
--  Company details and the master price list must look the same
--  on every phone — if they were per-user, two staff would quote
--  the same job at different rates.
-- ---------------------------------------------------------
create table if not exists public.company_settings (
  id          text        primary key default 'default',
  body        jsonb       not null default '{}'::jsonb,
  updated_by  uuid        references auth.users (id) on delete set null,
  updated_at  timestamptz not null default now()
);

create table if not exists public.price_list (
  id          text        primary key default 'default',

  -- { serviceCatalogue, serviceRates, serviceUnits }
  body        jsonb       not null default '{}'::jsonb,

  updated_by  uuid        references auth.users (id) on delete set null,
  updated_at  timestamptz not null default now()
);

drop trigger if exists company_settings_touch_updated_at on public.company_settings;
create trigger company_settings_touch_updated_at
  before update on public.company_settings
  for each row execute function public.touch_updated_at();

drop trigger if exists price_list_touch_updated_at on public.price_list;
create trigger price_list_touch_updated_at
  before update on public.price_list
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------
--  3. Row-level security
--  ---------------------------------------------------------
--  With no policy at all, these tables are invisible to the
--  public anon key — which is the safe default. The policies
--  below then say: any signed-in member of staff may read and
--  write. The anon key alone gets nothing.
--
--  This is the difference from the Drive design, where the
--  function had to run with --no-verify-jwt because staff had no
--  login, leaving every quote readable by anyone who knew the URL.
-- ---------------------------------------------------------
alter table public.quotes           enable row level security;
alter table public.company_settings enable row level security;
alter table public.price_list       enable row level security;

drop policy if exists quotes_staff_read on public.quotes;
create policy quotes_staff_read on public.quotes
  for select to authenticated using (true);

drop policy if exists quotes_staff_insert on public.quotes;
create policy quotes_staff_insert on public.quotes
  for insert to authenticated with check (true);

drop policy if exists quotes_staff_update on public.quotes;
create policy quotes_staff_update on public.quotes
  for update to authenticated using (true) with check (true);

drop policy if exists quotes_staff_delete on public.quotes;
create policy quotes_staff_delete on public.quotes
  for delete to authenticated using (true);

drop policy if exists company_settings_staff on public.company_settings;
create policy company_settings_staff on public.company_settings
  for all to authenticated using (true) with check (true);

drop policy if exists price_list_staff on public.price_list;
create policy price_list_staff on public.price_list
  for all to authenticated using (true) with check (true);

-- ---------------------------------------------------------
--  4. The single-row defaults
-- ---------------------------------------------------------
insert into public.company_settings (id, body)
values ('default', '{}'::jsonb)
on conflict (id) do nothing;

insert into public.price_list (id, body)
values ('default', '{}'::jsonb)
on conflict (id) do nothing;

-- ---------------------------------------------------------
--  5. Seed the shared price list from the app's built-in rates
--  ---------------------------------------------------------
--  Without this the first run would start with an empty price
--  list and every service would fall back to R350. This copies
--  the rates the app already ships with, so the cloud copy
--  starts out matching the built-in defaults.
--
--  Safe to re-run: it only writes when the row is still empty.
-- ---------------------------------------------------------
update public.price_list
set body = jsonb_build_object(
  'serviceRates', jsonb_build_object(
    'Repair leaking pipes', 450,
    'Install new water pipes', 650,
    'Dig trench for water or sewer pipe', 550,
    'Backfill trench', 400,
    'Compact or stamp ground', 350,
    'Remove paving', 450,
    'Repair concrete', 550,
    'Repair tiles', 450,
    'Clean work area', 250,
    'Jackhammer hire', 750,
    'Ground compactor hire', 650,
    'Excavator hire', 1800
  )
)
where id = 'default'
  and body = '{}'::jsonb;

-- ---------------------------------------------------------
--  6. Check it worked
-- ---------------------------------------------------------
--  Expect three tables, all with rowsecurity = true.
select
  tablename,
  rowsecurity as rls_enabled
from pg_tables
where schemaname = 'public'
  and tablename in ('quotes', 'company_settings', 'price_list')
order by tablename;
