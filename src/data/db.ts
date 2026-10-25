/**
 * Database access (Supabase). Server-only.
 * Every function returns an error message instead of throwing, so pages can
 * show a clear "database problem" notice rather than crashing.
 */
import { liveUsdToAud, type LiveFx } from "@/lib/fx";
import { DEFAULT_SETTINGS } from "@/lib/config";
import type { HoldingInput, WatchlistInput } from "@/lib/forms";
import type { RecheckUpdate } from "@/lib/freshness";
import { parseRegion } from "@/lib/region";
import { DEFAULT_HUNTER, HUNTER_SPORTS, hunterSearchName, parseHunterSport, type HunterConfig, type HunterSport } from "@/lib/hunter";
import type { CardValue, ScanHit } from "@/lib/scan";
import { db, dbConfigured } from "@/lib/supabase";
import { tbl } from "@/data/owner";
import type { CardIdentity, Holding, Settings, WatchlistEntry } from "@/lib/types";

export interface DbResult<T> {
  data: T;
  error: string | null;
}

const num = (v: unknown): number => Number(v);
const numOrNull = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));

function message(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) return String((e as { message: unknown }).message);
  return String(e);
}

// ---------- Settings ----------

export interface SettingsLoad {
  settings: Settings;
  source: "database" | "defaults";
  error: string | null;
  /** The rate saved in Settings — used whenever the live rate isn't available. */
  savedUsdToAud?: number;
  /** Live rate details when it is being used. */
  fx?: LiveFx | null;
}

/** Settings with today's live USD→AUD rate applied (falls back to your saved rate). */
export async function loadSettings(): Promise<SettingsLoad> {
  const [base, live] = await Promise.all([loadSavedSettings(), liveUsdToAud()]);
  const savedUsdToAud = base.settings.usdToAud;
  if (!live) return { ...base, savedUsdToAud, fx: null };
  return { ...base, savedUsdToAud, fx: live, settings: { ...base.settings, usdToAud: live.rate, fxIsManual: false } };
}

async function loadSavedSettings(): Promise<SettingsLoad> {
  if (!dbConfigured()) return { settings: DEFAULT_SETTINGS, source: "defaults", error: "Database not configured" };
  try {
    const { data, error } = await (await tbl("settings")).select("*").maybeSingle();
    if (error) throw error;
    if (!data) return { settings: DEFAULT_SETTINGS, source: "defaults", error: "Settings row missing — run supabase/schema.sql" };
    return {
      source: "database",
      error: null,
      settings: {
        usdToAud: num(data.usd_to_aud),
        fxIsManual: true,
        marketplaceFeeRate: num(data.marketplace_fee_rate),
        marketplaceFixedFeeUsd: num(data.marketplace_fixed_fee_usd),
        outboundShippingUsd: num(data.outbound_shipping_usd),
        importTaxRate: num(data.import_tax_rate),
        otherCostsUsd: num(data.other_costs_usd),
        minRoiPercent: num(data.min_roi_percent),
        minProfitUsd: num(data.min_profit_usd),
        inboundShippingMode: data.inbound_shipping_mode === "fixed" ? "fixed" : "ebay",
        inboundShippingFixedUsd:
          data.inbound_shipping_fixed_usd === undefined || data.inbound_shipping_fixed_usd === null
            ? 0
            : num(data.inbound_shipping_fixed_usd),
        buyerRegion: parseRegion(data.buyer_region),
        shipToCountry: data.ship_to_country ? String(data.ship_to_country) : null,
        shipToPostcode: data.ship_to_postcode ? String(data.ship_to_postcode) : null,
      },
    };
  } catch (e) {
    return { settings: DEFAULT_SETTINGS, source: "defaults", error: message(e) };
  }
}

export async function saveSettings(s: Settings): Promise<string | null> {
  try {
    const { error } = await (await tbl("settings"))
      .upsert({
        usd_to_aud: s.usdToAud,
        marketplace_fee_rate: s.marketplaceFeeRate,
        marketplace_fixed_fee_usd: s.marketplaceFixedFeeUsd,
        outbound_shipping_usd: s.outboundShippingUsd,
        import_tax_rate: s.importTaxRate,
        other_costs_usd: s.otherCostsUsd,
        min_roi_percent: s.minRoiPercent,
        min_profit_usd: s.minProfitUsd,
        inbound_shipping_mode: s.inboundShippingMode,
        inbound_shipping_fixed_usd: s.inboundShippingFixedUsd,
        buyer_region: s.buyerRegion,
        ship_to_country: s.shipToCountry,
        ship_to_postcode: s.shipToPostcode,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
    if (error) throw error;
    return null;
  } catch (e) {
    return message(e);
  }
}

// ---------- Watchlist ----------

export async function listWatchlist(): Promise<DbResult<WatchlistEntry[]>> {
  if (!dbConfigured()) return { data: [], error: "Database not configured" };
  try {
    const { data, error } = await (await tbl("watchlist")).select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return {
      error: null,
      data: (data ?? []).map((r) => ({
        id: String(r.id),
        createdAt: String(r.created_at),
        title: String(r.title),
        card: r.card as CardIdentity,
        askingPriceUsd: num(r.asking_price_usd),
        buyerShippingUsd: num(r.buyer_shipping_usd),
        expectedResaleUsd: numOrNull(r.expected_resale_usd),
        resaleBasis: String(r.resale_basis ?? "manual estimate"),
        targetPriceUsd: numOrNull(r.target_price_usd),
        listingUrl: r.listing_url ? String(r.listing_url) : null,
        note: r.note ? String(r.note) : null,
      })),
    };
  } catch (e) {
    return { data: [], error: message(e) };
  }
}

export async function insertWatchlist(w: WatchlistInput): Promise<string | null> {
  try {
    const { error } = await (await tbl("watchlist")).insert({
      title: w.title,
      card: w.card,
      asking_price_usd: w.askingPriceUsd,
      buyer_shipping_usd: w.buyerShippingUsd,
      expected_resale_usd: w.expectedResaleUsd,
      resale_basis: "manual estimate",
      target_price_usd: w.targetPriceUsd,
      listing_url: w.listingUrl,
      note: w.note,
    });
    if (error) throw error;
    return null;
  } catch (e) {
    return message(e);
  }
}

export async function deleteWatchlist(id: string): Promise<string | null> {
  try {
    const { error } = await (await tbl("watchlist")).delete().eq("id", id);
    if (error) throw error;
    return null;
  } catch (e) {
    return message(e);
  }
}

// ---------- Holdings (portfolio) ----------

export async function listHoldings(): Promise<DbResult<Holding[]>> {
  if (!dbConfigured()) return { data: [], error: "Database not configured" };
  try {
    const { data, error } = await (await tbl("holdings")).select("*").order("purchased_at", { ascending: false });
    if (error) throw error;
    return {
      error: null,
      data: (data ?? []).map((r) => {
        const value = numOrNull(r.estimated_value_usd);
        return {
          id: String(r.id),
          isDemo: false,
          title: String(r.title),
          card: r.card as CardIdentity,
          purchasePriceUsd: num(r.purchase_price_usd),
          purchaseCostsUsd: num(r.purchase_costs_usd),
          purchasedAt: String(r.purchased_at),
          estimatedValueUsd: value,
          // A value you typed yourself is not verified market data.
          valueConfidence: value === null ? "none" : "low",
          valueBasis: String(r.value_basis ?? "manual estimate"),
          note: r.note ? String(r.note) : null,
        } satisfies Holding;
      }),
    };
  } catch (e) {
    return { data: [], error: message(e) };
  }
}

export async function insertHolding(h: HoldingInput): Promise<string | null> {
  try {
    const { error } = await (await tbl("holdings")).insert({
      title: h.title,
      card: h.card,
      purchase_price_usd: h.purchasePriceUsd,
      purchase_costs_usd: h.purchaseCostsUsd,
      purchased_at: h.purchasedAt,
      estimated_value_usd: h.estimatedValueUsd,
      value_basis: "manual estimate",
      note: h.note,
    });
    if (error) throw error;
    return null;
  } catch (e) {
    return message(e);
  }
}

export async function deleteHolding(id: string): Promise<string | null> {
  try {
    const { error } = await (await tbl("holdings")).delete().eq("id", id);
    if (error) throw error;
    return null;
  } catch (e) {
    return message(e);
  }
}

// ---------- Single-item reads and updates (edit pages) ----------

export async function getWatchlistItem(id: string): Promise<DbResult<WatchlistEntry | null>> {
  const all = await listWatchlist();
  return { data: all.data.find((w) => w.id === id) ?? null, error: all.error };
}

export async function updateWatchlist(id: string, w: WatchlistInput): Promise<string | null> {
  try {
    const { error } = await (await tbl("watchlist"))
      .update({
        title: w.title,
        card: w.card,
        asking_price_usd: w.askingPriceUsd,
        buyer_shipping_usd: w.buyerShippingUsd,
        expected_resale_usd: w.expectedResaleUsd,
        target_price_usd: w.targetPriceUsd,
        listing_url: w.listingUrl,
        note: w.note,
      })
      .eq("id", id);
    if (error) throw error;
    return null;
  } catch (e) {
    return message(e);
  }
}

export async function getHolding(id: string): Promise<DbResult<Holding | null>> {
  const all = await listHoldings();
  return { data: all.data.find((h) => h.id === id) ?? null, error: all.error };
}

export async function updateHolding(id: string, h: HoldingInput): Promise<string | null> {
  try {
    const { error } = await (await tbl("holdings"))
      .update({
        title: h.title,
        card: h.card,
        purchase_price_usd: h.purchasePriceUsd,
        purchase_costs_usd: h.purchaseCostsUsd,
        purchased_at: h.purchasedAt,
        estimated_value_usd: h.estimatedValueUsd,
        note: h.note,
      })
      .eq("id", id);
    if (error) throw error;
    return null;
  } catch (e) {
    return message(e);
  }
}

// ---------- Card values (your value book) ----------


export interface CardValueRow extends CardValue {
  card: CardIdentity;
  note: string | null;
}

export async function listCardValues(): Promise<DbResult<CardValueRow[]>> {
  if (!dbConfigured()) return { data: [], error: "Database not configured" };
  try {
    const { data, error } = await (await tbl("card_values")).select("*").order("updated_at", { ascending: false });
    if (error) throw error;
    return {
      error: null,
      data: (data ?? []).map((r) => ({
        id: String(r.id),
        key: String(r.card_key),
        title: String(r.title),
        valueUsd: num(r.value_usd),
        updatedAt: String(r.updated_at),
        card: r.card as CardIdentity,
        note: r.note ? String(r.note) : null,
      })),
    };
  } catch (e) {
    return { data: [], error: message(e) };
  }
}

/**
 * Values for matching listings: your Card Values first, then automatic SportsCardsPro/PriceCharting
 * values for any card you haven't valued yourself. Your own value always wins.
 */
export async function cardValueMap(): Promise<{ map: Map<string, CardValue>; error: string | null }> {
  const [mine, auto] = await Promise.all([listCardValues(), listProviderValues()]);
  const map = new Map<string, CardValue>();
  for (const a of auto.data) {
    if (a.status !== "matched" || a.valueUsd === null) continue;
    // Parallel matched before the exact-parallel rule — don't trust it until it's looked up again.
    if (a.card?.parallel && new Date(a.fetchedAt).getTime() < Date.parse("2026-10-16T03:00:00Z")) continue;
    map.set(a.key, {
      id: `auto:${a.key}`,
      key: a.key,
      title: a.matchedName ?? "Price guide value",
      valueUsd: a.valueUsd,
      updatedAt: a.fetchedAt,
      source: a.site,
      matchedName: a.matchedName ?? undefined,
      graderSpecific: a.graderSpecific,
      salesVolume: a.salesVolume,
    });
  }
  for (const v of mine.data) map.set(v.key, { ...v, source: "you" });
  return { map, error: mine.error };
}

// ---------- Automatic values cache (SportsCardsPro / PriceCharting) ----------

export interface ProviderValueRow {
  key: string;
  /** pending = queued, not looked up yet (time ran out) — looked up on the next scan. */
  status: "matched" | "no_match" | "ambiguous" | "no_price" | "rejected" | "pending" | "setlist";
  site: "sportscardspro" | "pricecharting";
  productId: string | null;
  matchedName: string | null; // "Shohei Ohtani #US1 · Baseball Cards 2018 Topps Update"
  valueUsd: number | null;
  priceField: string | null;
  graderSpecific: boolean;
  salesVolume: number | null;
  detail: string | null;
  card: CardIdentity | null;
  fetchedAt: string;
}

export async function listProviderValues(): Promise<DbResult<ProviderValueRow[]>> {
  if (!dbConfigured()) return { data: [], error: "Database not configured" };
  try {
    const [{ data, error }, mineRejected] = await Promise.all([
      (await tbl("provider_values")).select("*").order("fetched_at", { ascending: false }).limit(5000),
      myRejectedKeys(),
    ]);
    if (error) throw error;
    return {
      error: null,
      data: (data ?? []).map((r: Record<string, unknown>) => ({
        key: String(r.card_key),
        // Shared guide values; a match YOU marked as wrong shows as rejected for you only.
        status: (mineRejected.has(String(r.card_key)) ? "rejected" : String(r.status)) as ProviderValueRow["status"],
        site: r.site === "pricecharting" ? "pricecharting" : "sportscardspro",
        productId: r.product_id ? String(r.product_id) : null,
        matchedName: r.matched_name ? String(r.matched_name) : null,
        valueUsd: numOrNull(r.value_usd),
        priceField: r.price_field ? String(r.price_field) : null,
        graderSpecific: r.grader_specific !== false,
        salesVolume: numOrNull(r.sales_volume),
        detail: r.detail ? String(r.detail) : null,
        card: (r.card as CardIdentity) ?? null,
        fetchedAt: String(r.fetched_at),
      })),
    };
  } catch (e) {
    // Table not created yet (one-time SQL) — behave as "no automatic values".
    return { data: [], error: message(e) };
  }
}

/** Queue cards to look up next scan (never overwrites a row that already exists). */
export async function queueProviderLookups(cards: { key: string; card: CardIdentity; site: string }[]): Promise<string | null> {
  if (cards.length === 0) return null;
  try {
    const { error } = await (await tbl("provider_values"))
      .upsert(
        cards.map((c) => ({ card_key: c.key, status: "pending", site: c.site, card: c.card, grader_specific: true, fetched_at: new Date().toISOString() })),
        { onConflict: "card_key", ignoreDuplicates: true },
      );
    if (error) throw error;
    return null;
  } catch (e) {
    return message(e);
  }
}

export async function saveProviderValue(v: Omit<ProviderValueRow, "fetchedAt">): Promise<string | null> {
  try {
    const { error } = await (await tbl("provider_values"))
      .upsert(
        {
          card_key: v.key,
          status: v.status,
          site: v.site,
          product_id: v.productId,
          matched_name: v.matchedName,
          value_usd: v.valueUsd,
          price_field: v.priceField,
          grader_specific: v.graderSpecific,
          sales_volume: v.salesVolume,
          detail: v.detail,
          card: v.card,
          fetched_at: new Date().toISOString(),
        },
        { onConflict: "card_key" },
      );
    if (error) throw error;
    return null;
  } catch (e) {
    return message(e);
  }
}

/** Cards whose automatic value this account marked as wrong (empty if the table isn't there yet). */
async function myRejectedKeys(): Promise<Set<string>> {
  try {
    const { data, error } = await (await tbl("value_rejections")).select("card_key");
    if (error) return new Set();
    return new Set((data ?? []).map((r: { card_key: unknown }) => String(r.card_key)));
  } catch {
    return new Set();
  }
}

/**
 * "This match is wrong" — stop using the automatic value for this card, for this account.
 * forEveryone (admins only): also stop it for all accounts.
 */
export async function rejectProviderValue(key: string, forEveryone = false): Promise<string | null> {
  try {
    const { error } = await (await tbl("value_rejections")).upsert({ card_key: key, created_at: new Date().toISOString() }, { onConflict: "user_id,card_key" });
    if (error) throw error;
    if (forEveryone) {
      const { error: e2 } = await (await tbl("provider_values")).update({ status: "rejected" }).eq("card_key", key);
      if (e2) throw e2;
    }
    return null;
  } catch (e) {
    return message(e);
  }
}

export async function upsertCardValue(input: {
  key: string;
  card: CardIdentity;
  title: string;
  valueUsd: number;
  note?: string | null;
}): Promise<string | null> {
  try {
    const { error } = await (await tbl("card_values"))
      .upsert(
        {
          card_key: input.key,
          card: input.card,
          title: input.title,
          value_usd: input.valueUsd,
          note: input.note ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,card_key" },
      );
    if (error) throw error;
    return null;
  } catch (e) {
    return message(e);
  }
}

export async function updateCardValueAmount(id: string, valueUsd: number): Promise<string | null> {
  try {
    const { error } = await (await tbl("card_values"))
      .update({ value_usd: valueUsd, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
    return null;
  } catch (e) {
    return message(e);
  }
}

/** Record the card you confirmed for a listing (all saved searches that found it). Non-fatal. */
export async function linkHitsToCard(itemId: string, key: string): Promise<void> {
  try {
    await (await tbl("scan_hits")).update({ card_key: key }).eq("item_id", itemId);
  } catch {
    // non-fatal: the value is saved either way
  }
}

export async function deleteCardValue(id: string): Promise<string | null> {
  try {
    const { error } = await (await tbl("card_values")).delete().eq("id", id);
    if (error) throw error;
    return null;
  } catch (e) {
    return message(e);
  }
}

// ---------- Saved searches ----------

export interface SavedSearch {
  id: string;
  name: string;
  query: string;
  market: "EBAY_US" | "EBAY_AU";
  category: "sportsCards" | "pokemon";
  format: "ALL" | "FIXED_PRICE" | "AUCTION" | "BEST_OFFER";
  maxPrice: number | null;
  excludeWords: string;
  /** Graded slabs only, ungraded (raw) only, or both. */
  grading: "any" | "graded" | "raw";
  active: boolean;
  lastRunAt: string | null;
  lastRunStatus: string | null;
  /** "hunter" = a hidden Profit Hunter search (query = sport code); "search" = yours. */
  kind: "search" | "hunter";
}

function mapSearch(r: Record<string, unknown>): SavedSearch {
  const fmt = String(r.format);
  return {
    id: String(r.id),
    name: String(r.name),
    query: String(r.query),
    market: r.market === "EBAY_AU" ? "EBAY_AU" : "EBAY_US",
    category: r.category === "pokemon" ? "pokemon" : "sportsCards",
    format: fmt === "ALL" || fmt === "AUCTION" || fmt === "BEST_OFFER" ? fmt : "FIXED_PRICE",
    maxPrice: numOrNull(r.max_price),
    excludeWords: typeof r.exclude_words === "string" ? r.exclude_words : "",
    grading: r.grading === "graded" || r.grading === "raw" ? r.grading : "any",
    active: Boolean(r.active),
    lastRunAt: r.last_run_at ? String(r.last_run_at) : null,
    lastRunStatus: r.last_run_status ? String(r.last_run_status) : null,
    kind: r.kind === "hunter" ? "hunter" : "search",
  };
}

export async function listSavedSearches(): Promise<DbResult<SavedSearch[]>> {
  if (!dbConfigured()) return { data: [], error: "Database not configured" };
  try {
    const { data, error } = await (await tbl("saved_searches")).select("*").order("created_at", { ascending: true });
    if (error) throw error;
    return { error: null, data: (data ?? []).map((r) => mapSearch(r)) };
  } catch (e) {
    return { data: [], error: message(e) };
  }
}

export async function insertSavedSearch(s: Omit<SavedSearch, "id" | "lastRunAt" | "lastRunStatus" | "active" | "kind">): Promise<string | null> {
  try {
    const { error } = await (await tbl("saved_searches")).insert({
      name: s.name,
      query: s.query,
      market: s.market,
      category: s.category,
      format: s.format,
      max_price: s.maxPrice,
      active: true,
      ...(s.excludeWords ? { exclude_words: s.excludeWords } : {}),
      ...(s.grading && s.grading !== "any" ? { grading: s.grading } : {}),
    });
    if (error) throw error;
    return null;
  } catch (e) {
    return message(e);
  }
}

export async function setSavedSearchExclude(id: string, excludeWords: string): Promise<string | null> {
  try {
    const { error } = await (await tbl("saved_searches")).update({ exclude_words: excludeWords }).eq("id", id);
    if (error) throw error;
    return null;
  } catch (e) {
    return message(e);
  }
}

export async function setSavedSearchActive(id: string, active: boolean): Promise<string | null> {
  try {
    const { error } = await (await tbl("saved_searches")).update({ active }).eq("id", id);
    if (error) throw error;
    return null;
  } catch (e) {
    return message(e);
  }
}

export async function deleteSavedSearch(id: string): Promise<string | null> {
  try {
    const { error } = await (await tbl("saved_searches")).delete().eq("id", id);
    if (error) throw error;
    return null;
  } catch (e) {
    return message(e);
  }
}

export async function markSearchRun(id: string, status: string): Promise<void> {
  try {
    await (await tbl("saved_searches")).update({ last_run_at: new Date().toISOString(), last_run_status: status }).eq("id", id);
  } catch {
    // non-fatal
  }
}

// ---------- Profit Hunter ----------

export async function loadHunterConfig(): Promise<{ config: HunterConfig; saved: boolean; error: string | null }> {
  if (!dbConfigured()) return { config: DEFAULT_HUNTER, saved: false, error: "Database not configured" };
  try {
    const { data, error } = await (await tbl("hunter_config")).select("*").maybeSingle();
    if (error) throw error;
    if (!data) return { config: DEFAULT_HUNTER, saved: false, error: null };
    const r = data as Record<string, unknown>;
    const sports = String(r.sports ?? "")
      .split(",")
      .map((x) => parseHunterSport(x.trim()))
      .filter((x): x is HunterSport => x !== null);
    return {
      saved: true,
      error: null,
      config: {
        enabled: Boolean(r.enabled),
        budget: numOrNull(r.budget) ?? DEFAULT_HUNTER.budget,
        minPrice: numOrNull(r.min_price) ?? 0,
        sports,
        includeAuctions: Boolean(r.include_auctions),
        minSales: numOrNull(r.min_sales) ?? 0,
        excludeWords: typeof r.exclude_words === "string" ? r.exclude_words : "",
        market: r.market === "EBAY_AU" ? "EBAY_AU" : "EBAY_US",
        minRoi: numOrNull(r.min_roi),
        minProfit: numOrNull(r.min_profit),
      },
    };
  } catch (e) {
    return { config: DEFAULT_HUNTER, saved: false, error: message(e) };
  }
}

/** Save the Hunter settings and make the hidden per-sport searches match them. */
export async function saveHunterConfig(c: HunterConfig): Promise<string | null> {
  try {
    const { error } = await (await tbl("hunter_config")).upsert(
      {
        enabled: c.enabled,
        budget: c.budget,
        min_price: c.minPrice,
        sports: c.sports.join(","),
        include_auctions: c.includeAuctions,
        min_sales: c.minSales,
        exclude_words: c.excludeWords,
        market: c.market,
        min_roi: c.minRoi,
        min_profit: c.minProfit,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    if (error) throw error;
    const all = await listSavedSearches();
    if (all.error) throw new Error(all.error);
    const mine = all.data.filter((x) => x.kind === "hunter");
    for (const sport of HUNTER_SPORTS) {
      const row = mine.find((x) => x.query === sport);
      const want = c.sports.includes(sport);
      if (!row && want) {
        const { error: e2 } = await (await tbl("saved_searches")).insert({
          name: hunterSearchName(sport),
          query: sport,
          market: c.market,
          category: sport === "Pokemon" ? "pokemon" : "sportsCards",
          format: c.includeAuctions ? "ALL" : "FIXED_PRICE",
          max_price: c.budget,
          active: c.enabled,
          kind: "hunter",
        });
        if (e2) throw e2;
      } else if (row) {
        const { error: e3 } = await (await tbl("saved_searches"))
          .update({ active: c.enabled && want, market: c.market, max_price: c.budget, format: c.includeAuctions ? "ALL" : "FIXED_PRICE" })
          .eq("id", row.id);
        if (e3) throw e3;
      }
    }
    return null;
  } catch (e) {
    return message(e);
  }
}

// ---------- Scan hits & runs ----------

export interface StoredHit extends ScanHit {
  id: string;
  createdAt: string;
  searchId: string;
  alerted: boolean;
  /** Last time the listing was confirmed on eBay (null = only when first found). */
  checkedAt: string | null;
  /** "ended" once eBay says it sold or ended. */
  status: string | null;
}

export async function existingItemIds(searchId: string, itemIds: string[]): Promise<Set<string>> {
  if (itemIds.length === 0) return new Set();
  const { data, error } = await (await tbl("scan_hits")).select("item_id").eq("search_id", searchId).in("item_id", itemIds);
  if (error) throw error;
  return new Set((data ?? []).map((r) => String(r.item_id)));
}

export async function insertHits(searchId: string, hits: (ScanHit & { alerted: boolean })[]): Promise<void> {
  if (hits.length === 0) return;
  const { error } = await (await tbl("scan_hits"))
    .upsert(
      hits.map((h) => ({
        search_id: searchId,
        item_id: h.itemId,
        title: h.title,
        url: h.url,
        image_url: h.imageUrl,
        is_auction: h.isAuction,
        ends_at: h.endsAt,
        price_usd: h.priceUsd,
        shipping_usd: h.shippingUsd,
        card_key: h.cardKey,
        value_usd: h.valueUsd,
        net_profit_usd: h.netProfitUsd,
        roi_percent: h.roiPercent,
        max_price_usd: h.maxPriceUsd,
        meets_criteria: h.meetsCriteria,
        alerted: h.alerted,
      })),
      { onConflict: "search_id,item_id", ignoreDuplicates: true },
    );
  if (error) throw error;
}

/**
 * Newest scan results. `scope` keeps your saved searches' results and the Profit Hunter's apart,
 * so hundreds of hunter listings an hour never push your own results out of the window.
 */
export async function listRecentHits(limit = 60, onlyDeals = false, scope?: "mine" | "hunter"): Promise<DbResult<StoredHit[]>> {
  if (!dbConfigured()) return { data: [], error: "Database not configured" };
  try {
    let q = (await tbl("scan_hits")).select("*").order("created_at", { ascending: false }).limit(limit);
    if (onlyDeals) q = q.eq("meets_criteria", true);
    if (scope) {
      const all = await listSavedSearches();
      if (all.error) throw new Error(all.error);
      const ids = all.data.filter((x) => (x.kind === "hunter") === (scope === "hunter")).map((x) => x.id);
      if (ids.length === 0) return { data: [], error: null };
      q = q.in("search_id", ids);
    }
    const { data, error } = await q;
    if (error) throw error;
    return {
      error: null,
      data: (data ?? []).map((r) => ({
        id: String(r.id),
        createdAt: String(r.created_at),
        searchId: String(r.search_id),
        alerted: Boolean(r.alerted),
        checkedAt: r.checked_at ? String(r.checked_at) : null,
        status: r.status ? String(r.status) : null,
        itemId: String(r.item_id),
        title: String(r.title),
        url: String(r.url),
        imageUrl: r.image_url ? String(r.image_url) : null,
        isAuction: Boolean(r.is_auction),
        endsAt: r.ends_at ? String(r.ends_at) : null,
        priceUsd: numOrNull(r.price_usd),
        shippingUsd: num(r.shipping_usd ?? 0),
        cardKey: r.card_key ? String(r.card_key) : null,
        valueUsd: numOrNull(r.value_usd),
        valueTitle: null,
        netProfitUsd: numOrNull(r.net_profit_usd),
        roiPercent: numOrNull(r.roi_percent),
        maxPriceUsd: numOrNull(r.max_price_usd),
        meetsCriteria: Boolean(r.meets_criteria),
      })),
    };
  } catch (e) {
    return { data: [], error: message(e) };
  }
}

/** Store the result of re-checking one eBay item (all saved searches that found it). */
export async function updateHitsForItem(itemId: string, u: RecheckUpdate): Promise<string | null> {
  const row: Record<string, unknown> = { checked_at: u.checkedAt, status: u.status };
  if (u.status === "live") {
    if (u.priceUsd !== undefined) row.price_usd = u.priceUsd;
    if (u.shippingUsd !== undefined) row.shipping_usd = u.shippingUsd;
    if (u.endsAt !== undefined) row.ends_at = u.endsAt;
    if (u.title !== undefined) row.title = u.title;
    if (u.imageUrl !== undefined) row.image_url = u.imageUrl;
    if (u.isAuction !== undefined) row.is_auction = u.isAuction;
  }
  try {
    const { error } = await (await tbl("scan_hits")).update(row).eq("item_id", itemId);
    if (error) throw error;
    return null;
  } catch (e) {
    return message(e);
  }
}

export async function markItemAlerted(itemId: string): Promise<void> {
  try {
    await (await tbl("scan_hits")).update({ alerted: true }).eq("item_id", itemId);
  } catch {
    // non-fatal
  }
}

export interface ScanRun {
  createdAt: string;
  trigger: string;
  searches: number;
  newListings: number;
  deals: number;
  emailed: number;
  error: string | null;
}

export async function recordScanRun(r: Omit<ScanRun, "createdAt">): Promise<void> {
  try {
    await (await tbl("scan_runs")).insert({
      trigger: r.trigger,
      searches: r.searches,
      new_listings: r.newListings,
      deals: r.deals,
      emailed: r.emailed,
      error: r.error,
    });
  } catch {
    // non-fatal
  }
}

export async function lastScanRuns(limit = 5): Promise<DbResult<ScanRun[]>> {
  if (!dbConfigured()) return { data: [], error: "Database not configured" };
  try {
    const { data, error } = await (await tbl("scan_runs")).select("*").order("created_at", { ascending: false }).limit(limit);
    if (error) throw error;
    return {
      error: null,
      data: (data ?? []).map((r) => ({
        createdAt: String(r.created_at),
        trigger: String(r.trigger),
        searches: num(r.searches),
        newListings: num(r.new_listings),
        deals: num(r.deals),
        emailed: num(r.emailed),
        error: r.error ? String(r.error) : null,
      })),
    };
  } catch (e) {
    return { data: [], error: message(e) };
  }
}

// ---------- Push notification subscriptions (one row per phone/browser) ----------

export interface PushSub {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  label: string | null;
  createdAt: string;
  lastOkAt: string | null;
  lastError: string | null;
}

export async function listPushSubscriptions(): Promise<DbResult<PushSub[]>> {
  if (!dbConfigured()) return { data: [], error: "Database not configured" };
  try {
    const { data, error } = await (await tbl("push_subscriptions")).select("*").order("created_at", { ascending: true });
    if (error) throw error;
    return {
      error: null,
      data: (data ?? []).map((r: Record<string, unknown>) => ({
        id: String(r.id),
        endpoint: String(r.endpoint),
        p256dh: String(r.p256dh),
        auth: String(r.auth),
        label: r.label ? String(r.label) : null,
        createdAt: String(r.created_at),
        lastOkAt: r.last_ok_at ? String(r.last_ok_at) : null,
        lastError: r.last_error ? String(r.last_error) : null,
      })),
    };
  } catch (e) {
    return { data: [], error: message(e) };
  }
}

export async function savePushSubscription(s: { endpoint: string; p256dh: string; auth: string; label: string | null }): Promise<string | null> {
  try {
    const { error } = await (await tbl("push_subscriptions"))
      .upsert({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth, label: s.label, last_error: null }, { onConflict: "endpoint" });
    if (error) throw error;
    return null;
  } catch (e) {
    return message(e);
  }
}

export async function deletePushSubscription(by: { id?: string; endpoint?: string }): Promise<string | null> {
  try {
    let q = (await tbl("push_subscriptions")).delete();
    if (by.id) q = q.eq("id", by.id);
    else if (by.endpoint) q = q.eq("endpoint", by.endpoint);
    else return "Nothing to remove.";
    const { error } = await q;
    if (error) throw error;
    return null;
  } catch (e) {
    return message(e);
  }
}

export async function markPushResult(id: string, ok: boolean, err: string | null): Promise<void> {
  try {
    await (await tbl("push_subscriptions"))
      .update(ok ? { last_ok_at: new Date().toISOString(), last_error: null } : { last_error: (err ?? "").slice(0, 300) })
      .eq("id", id);
  } catch {
    // non-fatal
  }
}

// ---------- Waitlist ----------

export interface WaitlistEntry {
  email: string;
  interests: string[];
  region: string | null;
  goals: string[];
  createdAt: string;
  /** When you sent them an invite (Admin page). */
  invitedAt: string | null;
}

/** Adds an email to the waitlist. Signing up twice is fine (kept once). */
export async function addToWaitlist(w: {
  email: string;
  interests: string[];
  region?: string | null;
  goals?: string[];
}): Promise<string | null> {
  if (!dbConfigured()) return "Database not configured";
  try {
    const row = { email: w.email, interests: w.interests.join(","), source: "login-page" };
    let { error } = await (await tbl("waitlist"))
      .upsert({ ...row, region: w.region ?? null, goals: (w.goals ?? []).join(",") }, { onConflict: "email", ignoreDuplicates: true });
    // Newer columns not added yet (one-time SQL) — still save the sign-up.
    if (error && /region|goals/.test(message(error))) {
      ({ error } = await (await tbl("waitlist")).upsert(row, { onConflict: "email", ignoreDuplicates: true }));
    }
    if (error) throw error;
    return null;
  } catch (e) {
    return message(e);
  }
}

export async function listWaitlist(): Promise<DbResult<WaitlistEntry[]>> {
  if (!dbConfigured()) return { data: [], error: "Database not configured" };
  try {
    const { data, error } = await (await tbl("waitlist")).select("*").order("created_at", { ascending: false }).limit(5000);
    if (error) throw error;
    return {
      error: null,
      data: (data ?? []).map((r: Record<string, unknown>) => ({
        email: String(r.email),
        interests: r.interests ? String(r.interests).split(",").filter(Boolean) : [],
        region: r.region ? String(r.region) : null,
        goals: r.goals ? String(r.goals).split(",").filter(Boolean) : [],
        createdAt: String(r.created_at),
        invitedAt: r.invited_at ? String(r.invited_at) : null,
      })),
    };
  } catch (e) {
    return { data: [], error: message(e) };
  }
}

// ---------- PSA slab checks (shared cache: a cert's details never change) ----------

export async function getCachedPsaCert(cert: string): Promise<{ data: import("@/lib/sales").PsaCert | null; fetchedAt: string | null; error: string | null }> {
  if (!dbConfigured()) return { data: null, fetchedAt: null, error: "Database not configured" };
  try {
    const { data, error } = await (await tbl("psa_certs")).select("*").eq("cert", cert).maybeSingle();
    if (error) throw error;
    if (!data) return { data: null, fetchedAt: null, error: null };
    const r = data as Record<string, unknown>;
    return { data: r.data as import("@/lib/sales").PsaCert, fetchedAt: String(r.fetched_at), error: null };
  } catch (e) {
    return { data: null, fetchedAt: null, error: message(e) };
  }
}

export async function savePsaCert(c: import("@/lib/sales").PsaCert): Promise<string | null> {
  try {
    const { error } = await (await tbl("psa_certs")).upsert({ cert: c.certNumber, data: c, fetched_at: new Date().toISOString() }, { onConflict: "cert" });
    if (error) throw error;
    return null;
  } catch (e) {
    return message(e);
  }
}

// ---------- Popular sets: daily price-guide download (your chosen sets only) ----------

export interface GuideSet {
  uid: string;
  host: "sportscardspro" | "pricecharting";
  name: string | null;
  rows: number | null;
  addedAt: string;
  downloadedAt: string | null;
  error: string | null;
}

export async function listGuideSets(): Promise<DbResult<GuideSet[]>> {
  if (!dbConfigured()) return { data: [], error: "Database not configured" };
  try {
    const { data, error } = await (await tbl("guide_sets")).select("*").order("added_at", { ascending: true });
    if (error) throw error;
    return {
      error: null,
      data: (data ?? []).map((r: Record<string, unknown>) => ({
        uid: String(r.uid),
        host: r.host === "pricecharting" ? "pricecharting" : "sportscardspro",
        name: r.name ? String(r.name) : null,
        rows: numOrNull(r.rows),
        addedAt: String(r.added_at),
        downloadedAt: r.downloaded_at ? String(r.downloaded_at) : null,
        error: r.error ? String(r.error) : null,
      })),
    };
  } catch (e) {
    return { data: [], error: message(e) };
  }
}

export async function addGuideSets(host: string, uids: string[]): Promise<string | null> {
  try {
    const { error } = await (await tbl("guide_sets"))
      .upsert(uids.map((uid) => ({ uid, host, added_at: new Date().toISOString() })), { onConflict: "uid", ignoreDuplicates: true });
    if (error) throw error;
    return null;
  } catch (e) {
    return message(e);
  }
}

export async function removeGuideSet(uid: string): Promise<string | null> {
  try {
    const r1 = await (await tbl("guide_prices")).delete().eq("set_uid", uid);
    if (r1.error) throw r1.error;
    const r2 = await (await tbl("guide_sets")).delete().eq("uid", uid);
    if (r2.error) throw r2.error;
    return null;
  } catch (e) {
    return message(e);
  }
}

export async function markGuideSet(uid: string, patch: { name?: string | null; rows?: number | null; error?: string | null; downloaded?: boolean }): Promise<void> {
  try {
    await (await tbl("guide_sets"))
      .update({
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.rows !== undefined ? { rows: patch.rows } : {}),
        error: patch.error ?? null,
        ...(patch.downloaded ? { downloaded_at: new Date().toISOString() } : {}),
      })
      .eq("uid", uid);
  } catch {
    // non-fatal
  }
}

/** Save downloaded prices (in chunks; Supabase handles ~1,000 rows per call comfortably). */
export async function saveGuidePrices(
  rows: { productId: string; setUid: string; consoleName: string; productName: string; numberNorm: string | null; prices: Record<string, number>; salesVolume: number | null }[],
): Promise<string | null> {
  try {
    const now = new Date().toISOString();
    for (let i = 0; i < rows.length; i += 1000) {
      const { error } = await (await tbl("guide_prices"))
        .upsert(
          rows.slice(i, i + 1000).map((r) => ({
            product_id: r.productId,
            set_uid: r.setUid,
            console_name: r.consoleName,
            product_name: r.productName,
            number_norm: r.numberNorm,
            prices: r.prices,
            sales_volume: r.salesVolume,
            updated_at: now,
          })),
          { onConflict: "product_id" },
        );
      if (error) throw error;
    }
    return null;
  } catch (e) {
    return message(e);
  }
}

/** Guide cards from your downloaded sets with these card numbers (normalised, e.g. "us1"). */
export async function guidePricesByNumber(
  numbers: string[],
): Promise<DbResult<{ productId: string; consoleName: string; productName: string; prices: Record<string, number>; salesVolume: number | null; numberNorm: string | null; updatedAt: string }[]>> {
  if (!dbConfigured() || numbers.length === 0) return { data: [], error: null };
  try {
    const out: { productId: string; consoleName: string; productName: string; prices: Record<string, number>; salesVolume: number | null; numberNorm: string | null; updatedAt: string }[] = [];
    const uniq = [...new Set(numbers)];
    for (let i = 0; i < uniq.length; i += 200) {
      const { data, error } = await (await tbl("guide_prices")).select("*").in("number_norm", uniq.slice(i, i + 200)).limit(5000);
      if (error) throw error;
      for (const r of (data ?? []) as Record<string, unknown>[])
        out.push({
          productId: String(r.product_id),
          consoleName: String(r.console_name),
          productName: String(r.product_name),
          prices: (r.prices as Record<string, number>) ?? {},
          salesVolume: numOrNull(r.sales_volume),
          numberNorm: r.number_norm ? String(r.number_norm) : null,
          updatedAt: String(r.updated_at),
        });
    }
    return { data: out, error: null };
  } catch (e) {
    return { data: [], error: message(e) };
  }
}

// ---------- Scheduled scans: which accounts to scan (system query, not tied to a signed-in person) ----------

/** Accounts with an active saved search or Profit Hunter search — the one waiting longest first. */
export async function listScanOwners(): Promise<DbResult<string[]>> {
  if (!dbConfigured()) return { data: [], error: "Database not configured" };
  try {
    const { data, error } = await db().from("saved_searches").select("user_id, last_run_at").eq("active", true);
    if (error) throw error;
    const oldest = new Map<string, number>();
    for (const r of (data ?? []) as { user_id?: unknown; last_run_at?: unknown }[]) {
      if (typeof r.user_id !== "string" || !r.user_id) continue;
      const t = typeof r.last_run_at === "string" ? Date.parse(r.last_run_at) || 0 : 0; // never run = first
      oldest.set(r.user_id, Math.min(oldest.get(r.user_id) ?? Infinity, t));
    }
    return { data: [...oldest.entries()].sort((a, b) => a[1] - b[1]).map(([id]) => id), error: null };
  } catch (e) {
    return { data: [], error: message(e) };
  }
}

/** Add this run's API calls to today's totals (per account, "shared" and "app"). Never fails a scan. */
export async function recordUsage(counts: Map<string, { ebay: number; guide: number }>): Promise<void> {
  if (!dbConfigured() || counts.size === 0) return;
  const day = new Date().toISOString().slice(0, 10);
  try {
    const { data } = await db().from("api_usage").select("scope, ebay_calls, guide_calls").eq("day", day);
    const before = new Map(((data ?? []) as { scope: string; ebay_calls: number; guide_calls: number }[]).map((r) => [r.scope, r]));
    const rows = [...counts.entries()].map(([scope, c]) => ({
      day,
      scope,
      ebay_calls: Number(before.get(scope)?.ebay_calls ?? 0) + c.ebay,
      guide_calls: Number(before.get(scope)?.guide_calls ?? 0) + c.guide,
      updated_at: new Date().toISOString(),
    }));
    await db().from("api_usage").upsert(rows, { onConflict: "day,scope" });
  } catch {
    // usage table not created yet — counts are only for the Admin page
  }
}

/** Saved searches you created yourself (the Profit Hunter's hidden searches don't count). */
export async function countOwnSavedSearches(): Promise<number> {
  const all = await listSavedSearches();
  return all.data.filter((x) => x.kind !== "hunter").length;
}

// ---------- Profiles: each account's email, for alerts and the Admin page (server key only) ----------

const profilesSeen = new Set<string>();

/** Remember an account's email (once per server instance; never fails a page). */
export async function recordProfile(userId: string, email: string): Promise<void> {
  if (!dbConfigured() || profilesSeen.has(userId)) return;
  try {
    const { error } = await db()
      .from("profiles")
      .upsert({ user_id: userId, email, last_seen_at: new Date().toISOString() }, { onConflict: "user_id" });
    if (!error) profilesSeen.add(userId);
  } catch {
    // profiles table not created yet — try again next time
  }
}

export async function profileEmail(userId: string): Promise<string | null> {
  if (!dbConfigured()) return null;
  try {
    const { data, error } = await db().from("profiles").select("email").eq("user_id", userId).maybeSingle();
    if (error || !data) return null;
    return typeof data.email === "string" ? data.email : null;
  } catch {
    return null;
  }
}

// ---------- Admin page (server key; callers check the viewer is an admin) ----------

export interface AccountRow {
  userId: string;
  email: string;
  createdAt: string;
  lastSeenAt: string | null;
  savedSearches: number;
  hunterOn: boolean;
}

export async function listAccounts(): Promise<DbResult<AccountRow[]>> {
  if (!dbConfigured()) return { data: [], error: "Database not configured" };
  try {
    const [p, ss, hc] = await Promise.all([
      db().from("profiles").select("user_id, email, created_at, last_seen_at").order("created_at", { ascending: true }),
      db().from("saved_searches").select("user_id, kind"),
      db().from("hunter_config").select("user_id, enabled"),
    ]);
    if (p.error) throw p.error;
    const searches = new Map<string, number>();
    for (const r of (ss.data ?? []) as { user_id: string; kind: string | null }[]) if (r.kind !== "hunter") searches.set(r.user_id, (searches.get(r.user_id) ?? 0) + 1);
    const hunter = new Set(((hc.data ?? []) as { user_id: string; enabled: boolean }[]).filter((r) => r.enabled).map((r) => r.user_id));
    return {
      error: null,
      data: ((p.data ?? []) as { user_id: string; email: string; created_at: string; last_seen_at: string | null }[]).map((r) => ({
        userId: r.user_id,
        email: r.email,
        createdAt: r.created_at,
        lastSeenAt: r.last_seen_at,
        savedSearches: searches.get(r.user_id) ?? 0,
        hunterOn: hunter.has(r.user_id),
      })),
    };
  } catch (e) {
    return { data: [], error: message(e) };
  }
}

/** Remember that you invited this email (adds it to the waitlist if it wasn't there). */
export async function markInvited(email: string): Promise<string | null> {
  try {
    const now = new Date().toISOString();
    const { data } = await db().from("waitlist").select("email").eq("email", email).maybeSingle();
    const { error } = data
      ? await db().from("waitlist").update({ invited_at: now }).eq("email", email)
      : await db().from("waitlist").insert({ email, interests: "", source: "admin-invite", invited_at: now });
    return error ? message(error) : null;
  } catch (e) {
    return message(e);
  }
}

export interface UsageRow {
  day: string;
  scope: string;
  ebayCalls: number;
  guideCalls: number;
}

export async function listUsage(days = 7): Promise<DbResult<UsageRow[]>> {
  if (!dbConfigured()) return { data: [], error: "Database not configured" };
  try {
    const since = new Date(Date.now() - (days - 1) * 86_400_000).toISOString().slice(0, 10);
    const { data, error } = await db().from("api_usage").select("*").gte("day", since).order("day", { ascending: false });
    if (error) throw error;
    return {
      error: null,
      data: ((data ?? []) as Record<string, unknown>[]).map((r) => ({
        day: String(r.day),
        scope: String(r.scope),
        ebayCalls: Number(r.ebay_calls ?? 0),
        guideCalls: Number(r.guide_calls ?? 0),
      })),
    };
  } catch (e) {
    return { data: [], error: message(e) };
  }
}

/** A new account agreed to the Terms of Use and Privacy Policy (when it chose its password). */
export async function recordTermsAccepted(userId: string, email: string): Promise<void> {
  if (!dbConfigured()) return;
  try {
    const now = new Date().toISOString();
    await db().from("profiles").upsert({ user_id: userId, email, terms_accepted_at: now, last_seen_at: now }, { onConflict: "user_id" });
  } catch {
    // profiles table / column not added yet — the account still works
  }
}
