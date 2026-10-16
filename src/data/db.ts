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
import type { CardValue, ScanHit } from "@/lib/scan";
import { db, dbConfigured } from "@/lib/supabase";
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
    const { data, error } = await db().from("settings").select("*").eq("id", 1).maybeSingle();
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
    const { error } = await db()
      .from("settings")
      .upsert({
        id: 1,
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
      });
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
    const { data, error } = await db().from("watchlist").select("*").order("created_at", { ascending: false });
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
    const { error } = await db().from("watchlist").insert({
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
    const { error } = await db().from("watchlist").delete().eq("id", id);
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
    const { data, error } = await db().from("holdings").select("*").order("purchased_at", { ascending: false });
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
    const { error } = await db().from("holdings").insert({
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
    const { error } = await db().from("holdings").delete().eq("id", id);
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
    const { error } = await db()
      .from("watchlist")
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
    const { error } = await db()
      .from("holdings")
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
    const { data, error } = await db().from("card_values").select("*").order("updated_at", { ascending: false });
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
    map.set(a.key, {
      id: `auto:${a.key}`,
      key: a.key,
      title: a.matchedName ?? "Price guide value",
      valueUsd: a.valueUsd,
      updatedAt: a.fetchedAt,
      source: a.site,
      matchedName: a.matchedName ?? undefined,
      graderSpecific: a.graderSpecific,
    });
  }
  for (const v of mine.data) map.set(v.key, { ...v, source: "you" });
  return { map, error: mine.error };
}

// ---------- Automatic values cache (SportsCardsPro / PriceCharting) ----------

export interface ProviderValueRow {
  key: string;
  status: "matched" | "no_match" | "ambiguous" | "no_price" | "rejected";
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
    const { data, error } = await db().from("provider_values").select("*").order("fetched_at", { ascending: false }).limit(5000);
    if (error) throw error;
    return {
      error: null,
      data: (data ?? []).map((r: Record<string, unknown>) => ({
        key: String(r.card_key),
        status: String(r.status) as ProviderValueRow["status"],
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

export async function saveProviderValue(v: Omit<ProviderValueRow, "fetchedAt">): Promise<string | null> {
  try {
    const { error } = await db()
      .from("provider_values")
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

/** "This match is wrong" — stop using the automatic value for this card. */
export async function rejectProviderValue(key: string): Promise<string | null> {
  try {
    const { error } = await db().from("provider_values").update({ status: "rejected" }).eq("card_key", key);
    if (error) throw error;
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
    const { error } = await db()
      .from("card_values")
      .upsert(
        {
          card_key: input.key,
          card: input.card,
          title: input.title,
          value_usd: input.valueUsd,
          note: input.note ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "card_key" },
      );
    if (error) throw error;
    return null;
  } catch (e) {
    return message(e);
  }
}

export async function updateCardValueAmount(id: string, valueUsd: number): Promise<string | null> {
  try {
    const { error } = await db()
      .from("card_values")
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
    await db().from("scan_hits").update({ card_key: key }).eq("item_id", itemId);
  } catch {
    // non-fatal: the value is saved either way
  }
}

export async function deleteCardValue(id: string): Promise<string | null> {
  try {
    const { error } = await db().from("card_values").delete().eq("id", id);
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
  active: boolean;
  lastRunAt: string | null;
  lastRunStatus: string | null;
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
    active: Boolean(r.active),
    lastRunAt: r.last_run_at ? String(r.last_run_at) : null,
    lastRunStatus: r.last_run_status ? String(r.last_run_status) : null,
  };
}

export async function listSavedSearches(): Promise<DbResult<SavedSearch[]>> {
  if (!dbConfigured()) return { data: [], error: "Database not configured" };
  try {
    const { data, error } = await db().from("saved_searches").select("*").order("created_at", { ascending: true });
    if (error) throw error;
    return { error: null, data: (data ?? []).map((r) => mapSearch(r)) };
  } catch (e) {
    return { data: [], error: message(e) };
  }
}

export async function insertSavedSearch(s: Omit<SavedSearch, "id" | "lastRunAt" | "lastRunStatus" | "active">): Promise<string | null> {
  try {
    const { error } = await db().from("saved_searches").insert({
      name: s.name,
      query: s.query,
      market: s.market,
      category: s.category,
      format: s.format,
      max_price: s.maxPrice,
      active: true,
      ...(s.excludeWords ? { exclude_words: s.excludeWords } : {}),
    });
    if (error) throw error;
    return null;
  } catch (e) {
    return message(e);
  }
}

export async function setSavedSearchExclude(id: string, excludeWords: string): Promise<string | null> {
  try {
    const { error } = await db().from("saved_searches").update({ exclude_words: excludeWords }).eq("id", id);
    if (error) throw error;
    return null;
  } catch (e) {
    return message(e);
  }
}

export async function setSavedSearchActive(id: string, active: boolean): Promise<string | null> {
  try {
    const { error } = await db().from("saved_searches").update({ active }).eq("id", id);
    if (error) throw error;
    return null;
  } catch (e) {
    return message(e);
  }
}

export async function deleteSavedSearch(id: string): Promise<string | null> {
  try {
    const { error } = await db().from("saved_searches").delete().eq("id", id);
    if (error) throw error;
    return null;
  } catch (e) {
    return message(e);
  }
}

export async function markSearchRun(id: string, status: string): Promise<void> {
  try {
    await db().from("saved_searches").update({ last_run_at: new Date().toISOString(), last_run_status: status }).eq("id", id);
  } catch {
    // non-fatal
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
  const { data, error } = await db().from("scan_hits").select("item_id").eq("search_id", searchId).in("item_id", itemIds);
  if (error) throw error;
  return new Set((data ?? []).map((r) => String(r.item_id)));
}

export async function insertHits(searchId: string, hits: (ScanHit & { alerted: boolean })[]): Promise<void> {
  if (hits.length === 0) return;
  const { error } = await db()
    .from("scan_hits")
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

export async function listRecentHits(limit = 60, onlyDeals = false): Promise<DbResult<StoredHit[]>> {
  if (!dbConfigured()) return { data: [], error: "Database not configured" };
  try {
    let q = db().from("scan_hits").select("*").order("created_at", { ascending: false }).limit(limit);
    if (onlyDeals) q = q.eq("meets_criteria", true);
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
    const { error } = await db().from("scan_hits").update(row).eq("item_id", itemId);
    if (error) throw error;
    return null;
  } catch (e) {
    return message(e);
  }
}

export async function markItemAlerted(itemId: string): Promise<void> {
  try {
    await db().from("scan_hits").update({ alerted: true }).eq("item_id", itemId);
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
    await db().from("scan_runs").insert({
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
    const { data, error } = await db().from("scan_runs").select("*").order("created_at", { ascending: false }).limit(limit);
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
    const { data, error } = await db().from("push_subscriptions").select("*").order("created_at", { ascending: true });
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
    const { error } = await db()
      .from("push_subscriptions")
      .upsert({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth, label: s.label, last_error: null }, { onConflict: "endpoint" });
    if (error) throw error;
    return null;
  } catch (e) {
    return message(e);
  }
}

export async function deletePushSubscription(by: { id?: string; endpoint?: string }): Promise<string | null> {
  try {
    let q = db().from("push_subscriptions").delete();
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
    await db()
      .from("push_subscriptions")
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
    let { error } = await db()
      .from("waitlist")
      .upsert({ ...row, region: w.region ?? null, goals: (w.goals ?? []).join(",") }, { onConflict: "email", ignoreDuplicates: true });
    // Newer columns not added yet (one-time SQL) — still save the sign-up.
    if (error && /region|goals/.test(message(error))) {
      ({ error } = await db().from("waitlist").upsert(row, { onConflict: "email", ignoreDuplicates: true }));
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
    const { data, error } = await db().from("waitlist").select("*").order("created_at", { ascending: false }).limit(5000);
    if (error) throw error;
    return {
      error: null,
      data: (data ?? []).map((r: Record<string, unknown>) => ({
        email: String(r.email),
        interests: r.interests ? String(r.interests).split(",").filter(Boolean) : [],
        region: r.region ? String(r.region) : null,
        goals: r.goals ? String(r.goals).split(",").filter(Boolean) : [],
        createdAt: String(r.created_at),
      })),
    };
  } catch (e) {
    return { data: [], error: message(e) };
  }
}
