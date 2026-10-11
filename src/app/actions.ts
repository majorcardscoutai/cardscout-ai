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
  updateHolding,
  updateWatchlist,
} from "@/data/db";
import { itemIdFromUrl } from "@/lib/ebay/parse";
import { parseHoldingForm, parseSettingsForm, parseWatchlistForm } from "@/lib/forms";

const UUID = /^[0-9a-f-]{36}$/i;

function back(path: string, key: "saved" | "error", value: string): never {
  redirect(`${path}?${key}=${encodeURIComponent(value)}`);
}

export async function saveSettingsAction(formData: FormData) {
  const parsed = parseSettingsForm(formData);
  if (!parsed.ok) back("/settings", "error", parsed.error);
  const error = await saveSettings(parsed.value);
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
  revalidatePath("/", "layout");
  back("/watchlist", "saved", `Added ${parsed.value.card.player} to your watchlist.`);
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
