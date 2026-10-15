"use server";

/**
 * Server actions — run on the server when you submit a form.
 * Each one: validate input → write to the database → refresh the page.
 * Results are passed back in the URL (?saved=… or ?error=…).
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  deleteHolding,
  deleteWatchlist,
  insertHolding,
  insertWatchlist,
  loadSettings,
  saveSettings,
  deleteCardValue,
  deleteSavedSearch,
  insertSavedSearch,
  setSavedSearchActive,
  setSavedSearchExclude,
  updateCardValueAmount,
  updateHolding,
  updateWatchlist,
  linkHitsToCard,
  upsertCardValue,
} from "@/data/db";
import { runAllScans } from "@/data/scanner";
import { cardKey } from "@/lib/cardKey";
import { excludeWordsText, parseExcludeWords } from "@/lib/exclude";
import { itemIdFromUrl } from "@/lib/ebay/parse";
import {
  parseCardValueForm,
  parseHoldingForm,
  parseNumber,
  parseSavedSearchForm,
  parseSettingsForm,
  parseWatchlistForm,
  toUsd,
} from "@/lib/forms";

const UUID = /^[0-9a-f-]{36}$/i;

function back(path: string, key: "saved" | "error", value: string): never {
  redirect(`${path}?${key}=${encodeURIComponent(value)}`);
}

export async function saveSettingsAction(formData: FormData) {
  const parsed = parseSettingsForm(formData);
  if (!parsed.ok) back("/settings", "error", parsed.error);
  const error = await saveSettings(parsed.value);
  if (error && /inbound_shipping/.test(error)) {
    back("/settings", "error", "Your database needs a quick update first: run the 'parcel locker' SQL from supabase/schema.sql in Supabase → SQL Editor.");
  }
  if (error) back("/settings", "error", `Couldn't save: ${error}`);
  revalidatePath("/", "layout");
  back("/settings", "saved", "Settings saved.");
}

export async function addWatchlistAction(formData: FormData) {
  const { settings } = await loadSettings();
  const parsed = parseWatchlistForm(formData, settings.usdToAud);
  if (!parsed.ok) back("/analyse", "error", parsed.error);
  const error = await insertWatchlist(parsed.value);
  if (error) back("/analyse", "error", `Couldn't save: ${error}`);
  let remembered = "";
  if (formData.get("rememberValue") === "on" && parsed.value.expectedResaleUsd) {
    const key = cardKey(parsed.value.card);
    if (key) {
      const e = await upsertCardValue({ key, card: parsed.value.card, title: parsed.value.title, valueUsd: parsed.value.expectedResaleUsd });
      if (!e) remembered = " Value saved to your card values.";
    }
  }
  revalidatePath("/", "layout");
  back("/watchlist", "saved", `Added ${parsed.value.card.player} to your watchlist.${remembered}`);
}

export async function removeWatchlistAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!UUID.test(id)) back("/watchlist", "error", "Invalid item.");
  const error = await deleteWatchlist(id);
  if (error) back("/watchlist", "error", `Couldn't remove: ${error}`);
  revalidatePath("/", "layout");
  back("/watchlist", "saved", "Removed from watchlist.");
}

export async function addHoldingAction(formData: FormData) {
  const { settings } = await loadSettings();
  const parsed = parseHoldingForm(formData, settings.usdToAud);
  if (!parsed.ok) back("/portfolio", "error", parsed.error);
  const error = await insertHolding(parsed.value);
  if (error) back("/portfolio", "error", `Couldn't save: ${error}`);
  revalidatePath("/", "layout");
  back("/portfolio", "saved", `Added ${parsed.value.card.player} to your portfolio.`);
}

export async function removeHoldingAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!UUID.test(id)) back("/portfolio", "error", "Invalid item.");
  const error = await deleteHolding(id);
  if (error) back("/portfolio", "error", `Couldn't remove: ${error}`);
  revalidatePath("/", "layout");
  back("/portfolio", "saved", "Removed from portfolio.");
}

export async function updateWatchlistAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!UUID.test(id)) back("/watchlist", "error", "Invalid item.");
  const { settings } = await loadSettings();
  const parsed = parseWatchlistForm(formData, settings.usdToAud);
  if (!parsed.ok) back(`/watchlist/${id}/edit`, "error", parsed.error);
  const error = await updateWatchlist(id, parsed.value);
  if (error) back(`/watchlist/${id}/edit`, "error", `Couldn't save: ${error}`);
  revalidatePath("/", "layout");
  back("/watchlist", "saved", `Updated ${parsed.value.card.player}.`);
}

export async function updateHoldingAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!UUID.test(id)) back("/portfolio", "error", "Invalid item.");
  const { settings } = await loadSettings();
  const parsed = parseHoldingForm(formData, settings.usdToAud);
  if (!parsed.ok) back(`/portfolio/${id}/edit`, "error", parsed.error);
  const error = await updateHolding(id, parsed.value);
  if (error) back(`/portfolio/${id}/edit`, "error", `Couldn't save: ${error}`);
  revalidatePath("/", "layout");
  back("/portfolio", "saved", `Updated ${parsed.value.card.player}.`);
}

/** Manual Scanner: turn a pasted eBay link into /analyse?item=…&market=… */
export async function loadListingAction(formData: FormData) {
  const raw = String(formData.get("listingUrl") ?? "").trim();
  const id = itemIdFromUrl(raw);
  if (!id) back("/analyse", "error", "That doesn't look like an eBay listing link. It should contain /itm/ and a long number.");
  const market = /ebay\.com\.au/i.test(raw) ? "EBAY_AU" : "EBAY_US";
  redirect(`/analyse?item=${id}&market=${market}`);
}

// ---------- Card values ----------

export async function addCardValueAction(formData: FormData) {
  // When opened from a scan result ("Add value"), keep the listing title so errors don't lose the prefill,
  // and go back to the scanner afterwards so the new value shows straight away.
  const from = String(formData.get("from") ?? "").slice(0, 200);
  const returnTo = formData.get("returnTo") === "/scanner" ? "/scanner" : "/values";
  const errPath = from ? `/values?from=${encodeURIComponent(from)}&error=` : "/values?error=";
  function fail(msg: string): never {
    redirect(`${errPath}${encodeURIComponent(msg)}#add`);
  }
  const { settings } = await loadSettings();
  const parsed = parseCardValueForm(formData, settings.usdToAud);
  if (!parsed.ok) fail(parsed.error);
  const key = cardKey(parsed.value.card);
  if (!key) fail("Some card details are missing.");
  const error = await upsertCardValue({ key, ...parsed.value });
  if (error) fail(`Couldn't save: ${error}`);
  // You've confirmed what card this listing is — remember that for the listing itself,
  // so it matches even when its title alone isn't clear enough.
  const item = String(formData.get("item") ?? "");
  if (/^\d{9,15}$/.test(item)) await linkHitsToCard(item, key);
  revalidatePath("/", "layout");
  back(returnTo, "saved", `Saved your value for ${parsed.value.title}.`);
}

export async function updateCardValueAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!UUID.test(id)) back("/values", "error", "Invalid item.");
  const { settings } = await loadSettings();
  const n = parseNumber(String(formData.get("value") ?? ""), "Value", { min: 0.01 });
  if (!n.ok || n.value === null) back("/values", "error", n.ok ? "Value is required." : n.error);
  const currency = formData.get("currency") === "AUD" ? "AUD" : "USD";
  const error = await updateCardValueAmount(id, toUsd(n.value, currency, settings.usdToAud));
  if (error) back("/values", "error", `Couldn't save: ${error}`);
  revalidatePath("/", "layout");
  back("/values", "saved", "Value updated.");
}

export async function deleteCardValueAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!UUID.test(id)) back("/values", "error", "Invalid item.");
  const error = await deleteCardValue(id);
  if (error) back("/values", "error", `Couldn't remove: ${error}`);
  revalidatePath("/", "layout");
  back("/values", "saved", "Value removed.");
}

// ---------- Saved searches & scanning ----------

export async function addSavedSearchAction(formData: FormData) {
  const parsed = parseSavedSearchForm(formData);
  if (!parsed.ok) back("/scanner", "error", parsed.error);
  const error = await insertSavedSearch(parsed.value);
  if (error && /exclude_words/.test(error))
    back("/scanner", "error", "Exclude words need a one-time database update — run the Phase 5 SQL in Supabase (see PROGRESS.md), then save again.");
  if (error) back("/scanner", "error", `Couldn't save: ${error}`);
  revalidatePath("/", "layout");
  back("/scanner", "saved", `Saved search "${parsed.value.name}". It will be checked on every scan.`);
}

export async function updateSavedSearchExcludeAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!UUID.test(id)) back("/scanner", "error", "Invalid item.");
  const words = excludeWordsText(parseExcludeWords(String(formData.get("x") ?? "")));
  const error = await setSavedSearchExclude(id, words);
  if (error && /exclude_words/.test(error))
    back("/scanner", "error", "Exclude words need a one-time database update — run the Phase 5 SQL in Supabase (see PROGRESS.md), then try again.");
  if (error) back("/scanner", "error", `Couldn't update: ${error}`);
  revalidatePath("/", "layout");
  back("/scanner", "saved", words ? `Now hiding listings containing: ${words}.` : "Exclude words cleared.");
}

export async function toggleSavedSearchAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!UUID.test(id)) back("/scanner", "error", "Invalid item.");
  const active = formData.get("active") === "true";
  const error = await setSavedSearchActive(id, active);
  if (error) back("/scanner", "error", `Couldn't update: ${error}`);
  revalidatePath("/", "layout");
  back("/scanner", "saved", active ? "Search resumed." : "Search paused.");
}

export async function deleteSavedSearchAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!UUID.test(id)) back("/scanner", "error", "Invalid item.");
  const error = await deleteSavedSearch(id);
  if (error) back("/scanner", "error", `Couldn't remove: ${error}`);
  revalidatePath("/", "layout");
  back("/scanner", "saved", "Saved search removed.");
}

export async function scanNowAction() {
  const r = await runAllScans("manual");
  revalidatePath("/", "layout");
  if (r.errors.length) back("/scanner", "error", `Scan finished with problems: ${r.errors.join("; ")}`);
  back(
    "/scanner",
    "saved",
    `Scan done: ${r.searches} search${r.searches === 1 ? "" : "es"}, ${r.newListings} new listing${r.newListings === 1 ? "" : "s"}, ${r.deals} deal${r.deals === 1 ? "" : "s"}${r.emailed ? `, ${r.emailed} emailed` : ""}${r.pushed ? `, sent to ${r.pushed} phone${r.pushed === 1 ? "" : "s"}` : ""}${r.rechecked ? `, ${r.rechecked} re-checked${r.ended ? ` (${r.ended} sold/ended)` : ""}` : ""}.`,
  );
}
