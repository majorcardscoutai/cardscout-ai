-- CardScout AI — database tables (Phase 2)
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
