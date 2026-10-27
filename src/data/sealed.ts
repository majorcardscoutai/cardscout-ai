import { sealedEnabled } from "@/lib/categories";
import type { ProviderProduct } from "@/lib/provider";
import { getProduct, providerConfigured, searchProducts } from "@/lib/provider-client";
import type { CardValue } from "@/lib/scan";
import { SEALED_PRODUCT_NAMES, matchSealed, sealedFromTitle, sealedKey, sealedQuery, type SealedItem } from "@/lib/sealed";
import type { Sport } from "@/lib/types";
import { guideSealedProducts, listProviderValues, saveProviderValue, type ProviderValueRow } from "./db";
import { needsLookup } from "./provider";

export interface SealedFill {
  looked: number;
  matched: number;
  local: number;
  pending: number;
  newValues: Map<string, CardValue>;
  error: string | null;
}

/**
 * Value the sealed products (booster boxes, hobby boxes…) in these listing titles: your downloaded
 * Popular sets first (instant), then a price-guide search (about one a second) until `deadline`.
 * Results are cached like card values, so every page and scan uses them.
 */
export async function fillSealedValues(titles: string[], mineKeys: Set<string>, deadline: number, hint: { sport?: Sport } = {}): Promise<SealedFill> {
  const out: SealedFill = { looked: 0, matched: 0, local: 0, pending: 0, newValues: new Map(), error: null };
  if (!providerConfigured() || !sealedEnabled()) return out;
  const items = new Map<string, SealedItem>();
  for (const t of titles) {
    const r = sealedFromTitle(t, hint);
    if (r.ok) items.set(sealedKey(r.item), r.item);
  }
  if (items.size === 0) return out;
  const cached = await listProviderValues();
  if (cached.error) return out;
  const byKey = new Map(cached.data.map((r) => [r.key, r]));
  const todo = [...items.entries()].filter(([key]) => !mineKeys.has(key) && needsLookup(byKey.get(key)));
  if (todo.length === 0) return out;

  const local = (await guideSealedProducts(SEALED_PRODUCT_NAMES)).data.map(
    (p): ProviderProduct => ({ id: p.productId, productName: p.productName, consoleName: p.consoleName, prices: p.prices, salesVolume: p.salesVolume }),
  );

  const save = async (key: string, item: SealedItem, row: Pick<ProviderValueRow, "status" | "productId" | "matchedName" | "valueUsd" | "salesVolume" | "detail">) => {
    const full = { key, site: item.category === "Pokemon" ? ("pricecharting" as const) : ("sportscardspro" as const), priceField: "loose-price", graderSpecific: true, card: null, ...row };
    await saveProviderValue(full);
    out.looked++;
    if (row.status === "matched" && row.valueUsd !== null) {
      out.matched++;
      out.newValues.set(key, {
        id: `auto:${key}`, key, title: row.matchedName ?? item.type, valueUsd: row.valueUsd, updatedAt: new Date().toISOString(),
        source: full.site, matchedName: row.matchedName ?? undefined, graderSpecific: true, salesVolume: row.salesVolume,
      });
    }
  };
  const fromProduct = (p: ProviderProduct, usd: number | null) => ({
    status: usd !== null ? ("matched" as const) : ("no_price" as const),
    productId: p.id,
    matchedName: `${p.productName} · ${p.consoleName}`,
    valueUsd: usd,
    salesVolume: p.salesVolume,
    detail: usd !== null ? null : "The price guide has no sealed price for this product yet.",
  });

  for (const [key, item] of todo) {
    const here = matchSealed(item, local);
    if (here.ok) {
      await save(key, item, { ...fromProduct(here.product, here.usd), detail: here.usd !== null ? "From your Popular sets download" : "The price guide has no sealed price for this product yet." });
      out.local++;
      continue;
    }
    if (Date.now() > deadline) {
      out.pending++;
      continue;
    }
    const site = item.category === "Pokemon" ? "pricecharting" : "sportscardspro";
    const found = await searchProducts(site, sealedQuery(item));
    if (!found.ok) {
      out.error = found.error;
      if (found.code === 429 || found.code === 401 || found.code === 403) break;
      continue;
    }
    const m = matchSealed(item, found.data);
    if (!m.ok) {
      await save(key, item, { status: m.reason, productId: null, matchedName: null, valueUsd: null, salesVolume: null, detail: m.detail });
      continue;
    }
    let product = m.product;
    let usd = m.usd;
    if (Object.keys(product.prices).length === 0 && Date.now() < deadline) {
      const got = await getProduct(site, product.id);
      if (got.ok) {
        product = got.data;
        const pennies = product.prices["loose-price"];
        usd = pennies && pennies > 0 ? Math.round(pennies) / 100 : null;
      }
    }
    await save(key, item, fromProduct(product, usd));
  }
  return out;
}
