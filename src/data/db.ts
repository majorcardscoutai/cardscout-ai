/**
 * Database access (Supabase). Server-only.
 * Every function returns an error message instead of throwing, so pages can
 * show a clear "database problem" notice rather than crashing.
 */
import { DEFAULT_SETTINGS } from "@/lib/config";
import type { HoldingInput, WatchlistInput } from "@/lib/forms";
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
}

export async function loadSettings(): Promise<SettingsLoad> {
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
