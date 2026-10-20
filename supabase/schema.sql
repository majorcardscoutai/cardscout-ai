-- CardHawk AI — database tables (Phase 2)
-- Paste this whole file into Supabase → SQL Editor → New query → Run.
-- Safe to run more than once.

-- 1. Settings: a single row holding your profit assumptions
create table if not exists public.settings (
  id integer primary key default 1 check (id = 1),
  usd_to_aud numeric not null default 1.5,
  marketplace_fee_rate numeric not null default 0.1325,
  marketplace_fixed_fee_usd numeric not null default 0.4,
  outbound_shipping_usd numeric not null default 5,
  import_tax_rate numeric not null default 0.1,
  other_costs_usd numeric not null default 2,
  min_roi_percent numeric not null default 20,
  min_profit_usd numeric not null default 25,
  updated_at timestamptz not null default now()
);
insert into public.settings (id) values (1) on conflict (id) do nothing;

-- 2. Watchlist: cards you are tracking (from the Manual Scanner)
create table if not exists public.watchlist (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  title text not null,
  card jsonb not null,               -- exact card identity (player, set, number, parallel, grade…)
  asking_price_usd numeric not null,
  buyer_shipping_usd numeric not null default 0,
  expected_resale_usd numeric,       -- your own estimate until real sold data arrives (Phase 3)
  resale_basis text not null default 'manual estimate',
  target_price_usd numeric,
  listing_url text,
  note text
);

-- 3. Holdings: cards you own (Portfolio)
create table if not exists public.holdings (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  title text not null,
  card jsonb not null,
  purchase_price_usd numeric not null,
  purchase_costs_usd numeric not null default 0,
  purchased_at date not null default current_date,
  estimated_value_usd numeric,
  value_basis text not null default 'manual estimate',
  note text
);

-- Security: switch on Row Level Security with NO public policies.
-- That means the public "publishable" key can read/write nothing.
-- Only the app's server, using the secret key, can access these tables.
alter table public.settings enable row level security;
alter table public.watchlist enable row level security;
alter table public.holdings enable row level security;

-- Update 13 Oct 2026: parcel-locker shipping setting (safe to run more than once)
alter table public.settings add column if not exists inbound_shipping_mode text not null default 'ebay';
alter table public.settings add column if not exists inbound_shipping_fixed_usd numeric not null default 0;

-- Update 13 Oct 2026 (Phase 4): card values, saved searches, scan results. Safe to run more than once.
create table if not exists public.card_values (
  id uuid primary key default gen_random_uuid(),
  card_key text not null unique,
  card jsonb not null,
  title text not null,
  value_usd numeric not null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.saved_searches (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  query text not null,
  market text not null default 'EBAY_US',
  category text not null default 'sportsCards',
  format text not null default 'FIXED_PRICE',
  max_price numeric,
  active boolean not null default true,
  last_run_at timestamptz,
  last_run_status text
);

create table if not exists public.scan_hits (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  search_id uuid not null references public.saved_searches(id) on delete cascade,
  item_id text not null,
  title text not null,
  url text not null,
  image_url text,
  is_auction boolean not null default false,
  ends_at timestamptz,
  price_usd numeric,
  shipping_usd numeric,
  card_key text,
  value_usd numeric,
  net_profit_usd numeric,
  roi_percent numeric,
  max_price_usd numeric,
  meets_criteria boolean not null default false,
  alerted boolean not null default false,
  unique (search_id, item_id)
);

create table if not exists public.scan_runs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  trigger text not null,
  searches int not null default 0,
  new_listings int not null default 0,
  deals int not null default 0,
  emailed int not null default 0,
  error text
);

alter table public.card_values enable row level security;
alter table public.saved_searches enable row level security;
alter table public.scan_hits enable row level security;
alter table public.scan_runs enable row level security;

-- ---------- Phase 5 (14 Oct 2026): exclude words + push notifications ----------
alter table public.saved_searches add column if not exists exclude_words text not null default '';

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  label text,
  created_at timestamptz not null default now(),
  last_ok_at timestamptz,
  last_error text
);
alter table public.push_subscriptions enable row level security;

-- ---------- 15 Oct 2026: listing freshness (eBay licence §8.1.3) ----------
alter table public.scan_hits add column if not exists checked_at timestamptz;
alter table public.scan_hits add column if not exists status text not null default 'live';

-- ---------- 15 Oct 2026: waitlist (public sign-up on the login page) ----------
create table if not exists public.waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  interests text not null default '',
  source text,
  created_at timestamptz not null default now()
);
alter table public.waitlist enable row level security;

-- ---------- 16 Oct 2026: buyer region (worldwide) ----------
alter table public.settings add column if not exists buyer_region text not null default 'AU';
alter table public.settings add column if not exists ship_to_country text;
alter table public.settings add column if not exists ship_to_postcode text;
alter table public.waitlist add column if not exists region text;
alter table public.waitlist add column if not exists goals text not null default '';

-- ---------- 16 Oct 2026: automatic values cache (SportsCardsPro / PriceCharting) ----------
create table if not exists public.provider_values (
  card_key text primary key,
  status text not null,              -- matched | no_match | ambiguous | no_price | rejected
  site text not null,                -- sportscardspro | pricecharting
  product_id text,
  matched_name text,
  value_usd numeric,
  price_field text,
  grader_specific boolean not null default true,
  sales_volume numeric,
  detail text,
  card jsonb,
  fetched_at timestamptz not null default now()
);
alter table public.provider_values enable row level security;

-- ---------- 16 Oct 2026: Profit Hunter ----------
alter table public.saved_searches add column if not exists kind text not null default 'search';
create table if not exists public.hunter_config (
  id int primary key default 1,
  enabled boolean not null default false,
  budget numeric not null default 300,
  min_price numeric not null default 20,
  sports text not null default 'MLB,NBA,Pokemon',
  include_auctions boolean not null default false,
  min_sales integer not null default 12,
  exclude_words text not null default 'lot, reprint, custom, digital, proxy, break',
  market text not null default 'EBAY_US',
  updated_at timestamptz not null default now()
);
alter table public.hunter_config enable row level security;
alter table public.hunter_config add column if not exists min_roi numeric;
alter table public.hunter_config add column if not exists min_profit numeric;

-- ---------- 19 Oct 2026: PSA slab checks (shared cache; a cert's details never change) ----------
create table if not exists public.psa_certs (
  cert text primary key,
  data jsonb not null,
  fetched_at timestamptz not null default now()
);
alter table public.psa_certs enable row level security;

-- ---------- 20 Oct 2026: Popular sets — daily price-guide download (your chosen sets only) ----------
create table if not exists public.guide_sets (
  uid text primary key,
  host text not null default 'sportscardspro',
  name text,
  rows integer,
  added_at timestamptz not null default now(),
  downloaded_at timestamptz,
  error text
);
create table if not exists public.guide_prices (
  product_id text primary key,
  set_uid text not null,
  console_name text not null,
  product_name text not null,
  number_norm text,
  prices jsonb not null default '{}'::jsonb,
  sales_volume integer,
  updated_at timestamptz not null default now()
);
create index if not exists guide_prices_number_norm on public.guide_prices (number_norm);
create index if not exists guide_prices_set_uid on public.guide_prices (set_uid);
alter table public.guide_sets enable row level security;
alter table public.guide_prices enable row level security;

-- ---------- 20 Oct 2026: Phase 6 step 2 — each account's own data ----------
-- Moves everything that's yours (settings, Hunter, searches, finds, watchlist, portfolio, your Card Values,
-- phones) into your account. Run it once, AFTER creating your account in Authentication → Users.
-- Safe to run again. Shared data (price-guide values, PSA certs, Popular sets, waitlist) is untouched.
do $$
declare
  uid uuid;
  n int;
  t text;
begin
  select count(*) into n from auth.users;
  if n <> 1 then
    raise exception 'This step expects exactly one account (yours) — found %. Ask Claude before running it.', n;
  end if;
  select id into uid from auth.users;

  foreach t in array array['settings','hunter_config','saved_searches','scan_hits','scan_runs','watchlist','holdings','card_values','push_subscriptions']
  loop
    execute format('alter table public.%I add column if not exists user_id uuid references auth.users(id) on delete cascade', t);
    execute format('update public.%I set user_id = %L where user_id is null', t, uid);
    -- Until step 4, anything still written without an account goes to yours (removed when other people join).
    execute format('alter table public.%I alter column user_id set default %L', t, uid);
    execute format('alter table public.%I alter column user_id set not null', t);
    execute format('create index if not exists %I on public.%I (user_id)', t || '_user_id_idx', t);
  end loop;

  -- Settings and Profit Hunter: one row per account (was a single row with id 1).
  alter table public.settings drop constraint if exists settings_id_check;
  create sequence if not exists public.settings_id_seq start 1000;
  alter table public.settings alter column id set default nextval('public.settings_id_seq');
  create sequence if not exists public.hunter_config_id_seq start 1000;
  alter table public.hunter_config alter column id set default nextval('public.hunter_config_id_seq');
  if not exists (select 1 from pg_constraint where conname = 'settings_user_id_key') then
    alter table public.settings add constraint settings_user_id_key unique (user_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'hunter_config_user_id_key') then
    alter table public.hunter_config add constraint hunter_config_user_id_key unique (user_id);
  end if;

  -- Card Values: each account has its own (two people can value the same card differently).
  alter table public.card_values drop constraint if exists card_values_card_key_key;
  if not exists (select 1 from pg_constraint where conname = 'card_values_user_card_key') then
    alter table public.card_values add constraint card_values_user_card_key unique (user_id, card_key);
  end if;
end $$;

-- ---------- 20 Oct 2026: Phase 6 step 3 — database rules (row-level security) ----------
-- Each signed-in account can only read and change rows with its own user_id. The server's secret key
-- (scheduled scans) is unaffected. Shared tables keep row-level security on with NO rules, so only the
-- server can reach them. Run once; safe to run again.
do $$
declare
  t text;
begin
  foreach t in array array['settings','hunter_config','saved_searches','scan_hits','scan_runs','watchlist','holdings','card_values','push_subscriptions']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_own_rows', t);
    execute format('create policy %I on public.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t || '_own_rows', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
  foreach t in array array['waitlist','provider_values','psa_certs','guide_sets','guide_prices']
  loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;
grant usage, select on sequence public.settings_id_seq, public.hunter_config_id_seq to authenticated;

-- ---------- 20 Oct 2026: Phase 6 step 4 — per-account alerts and "wrong match" ----------
-- profiles: each account's email (for its alert emails; written by the server).
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz
);
alter table public.profiles enable row level security;
drop policy if exists profiles_own_row on public.profiles;
create policy profiles_own_row on public.profiles for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.profiles from anon;

-- value_rejections: "Wrong match?" now only affects the account that clicked it (admins: everyone).
create table if not exists public.value_rejections (
  user_id uuid not null references auth.users(id) on delete cascade,
  card_key text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, card_key)
);
alter table public.value_rejections enable row level security;
drop policy if exists value_rejections_own_rows on public.value_rejections;
create policy value_rejections_own_rows on public.value_rejections for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
grant select, insert, update, delete on public.value_rejections to authenticated;
revoke all on public.value_rejections from anon;

-- Remove step 2's temporary "new rows belong to Travis" default — every row now names its account.
do $$
declare
  t text;
begin
  foreach t in array array['settings','hunter_config','saved_searches','scan_hits','scan_runs','watchlist','holdings','card_values','push_subscriptions']
  loop
    execute format('alter table public.%I alter column user_id drop default', t);
  end loop;
end $$;
