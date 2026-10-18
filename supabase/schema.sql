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
