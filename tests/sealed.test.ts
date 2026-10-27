import { test } from "node:test";
import assert from "node:assert/strict";
import { matchSealed, sealedFromTitle, sealedKey } from "../src/lib/sealed";
import { listingKey } from "../src/lib/scan";

const read = (t: string, sport?: "Pokemon") => sealedFromTitle(t, sport ? { sport } : {});

test("reads sealed Pokémon and sports products", () => {
  const a = read("Pokemon TCG Evolving Skies Booster Box Factory Sealed 36 Packs");
  assert.ok(a.ok);
  if (a.ok) assert.deepEqual(a.item, { category: "Pokemon", type: "Booster Box", set: "Evolving Skies", year: null, quantity: 1 });
  const b = read("Prismatic Evolutions Elite Trainer Box ETB Sealed", "Pokemon");
  assert.ok(b.ok && b.item.type === "Elite Trainer Box" && b.item.set === "Prismatic Evolutions");
  const c = read("Pokemon Center Surging Sparks Elite Trainer Box");
  assert.ok(c.ok && c.item.type === "Pokemon Center Elite Trainer Box");
  const d = read("2023 Topps Chrome Baseball Hobby Box Factory Sealed");
  assert.ok(d.ok && d.item.category === "MLB" && d.item.year === 2023 && d.item.set === "Topps Chrome" && d.item.type === "Hobby Box");
  const e = read("2023-24 Panini Prizm Basketball Blaster Box");
  assert.ok(e.ok && e.item.category === "NBA" && e.item.year === 2023 && e.item.type === "Blaster Box");
  const f = read("Pokemon 151 Booster Bundle x2");
  assert.ok(f.ok && f.item.quantity === 2 && f.item.type === "Booster Bundle");
  const g = read("2023 Topps Chrome Baseball Hobby Box case of 12");
  assert.ok(g.ok && g.item.quantity === 12);
});

test("never values breaks, opened, repacks, other languages or unclear cases", () => {
  for (const t of [
    "Pokemon Evolving Skies Booster Box BREAK spot",
    "2023 Topps Chrome Baseball Hobby Box random team break",
    "Pokemon Evolving Skies Booster Box EMPTY",
    "Pokemon Evolving Skies Booster Box Resealed?",
    "Pokemon Japanese VSTAR Universe Booster Box",
    "2023 Topps Chrome Baseball Hobby Box Case",
    "Pokemon Booster Box sealed",
    "Topps Chrome Baseball Hobby Box",
    "Charizard Evolving Skies PSA 10",
  ])
    assert.equal(read(t).ok, false, t);
});

const prod = (id: string, consoleName: string, productName: string, loose: number | undefined) => ({ id, consoleName, productName, prices: (loose ? { "loose-price": loose } : {}) as Record<string, number>, salesVolume: 52 });

test("matches the guide's sealed product exactly", () => {
  const r = read("Pokemon 151 Elite Trainer Box");
  assert.ok(r.ok);
  if (!r.ok) return;
  const list = [
    prod("1", "Pokemon Scarlet & Violet 151", "Elite Trainer Box", 9999),
    prod("2", "Pokemon Japanese Scarlet & Violet 151", "Elite Trainer Box", 5000),
    prod("3", "Pokemon Scarlet & Violet 151", "Booster Bundle", 4000),
  ];
  const m = matchSealed(r.item, list);
  assert.ok(m.ok && m.product.id === "1" && m.usd === 99.99);
  const hb = read("2023 Topps Chrome Baseball Hobby Box");
  assert.ok(hb.ok);
  if (!hb.ok) return;
  assert.ok(matchSealed(hb.item, [prod("9", "Baseball Cards 2023 Topps Chrome", "Hobby Box", 19269), prod("8", "Baseball Cards 2023 Topps Chrome Update", "Hobby Box", 15000)]).ok);
  assert.equal(matchSealed(hb.item, [prod("8", "Baseball Cards 2023 Topps Chrome Update", "Hobby Box", 15000)]).ok, false);
});

test("listing key: cards first, sealed products otherwise, with box count", () => {
  assert.match(listingKey("2018 Topps Update Shohei Ohtani #US1 PSA 10").key ?? "", /^mlb\|shohei ohtani/);
  const s = listingKey("Pokemon Evolving Skies Booster Box x3");
  assert.equal(s.units, 3);
  const r = read("Pokemon Evolving Skies Booster Box");
  assert.ok(r.ok);
  if (r.ok) assert.equal(s.key, sealedKey(r.item));
});

test("a protective case isn't a case of boxes", () => {
  const a = sealedFromTitle("2021 POKEMON SWORD & SHIELD EVOLVING SKIES SEALED BOOSTER BOX + ACRYLIC CASE");
  assert.ok(a.ok && a.item.quantity === 1 && a.item.type === "Booster Box");
  const b = sealedFromTitle("Pokémon SWSH Evolving Skies Elite Trainer Box Sealed Umbreon Art Sealed w/ Case");
  assert.ok(b.ok && b.item.quantity === 1);
  assert.equal(sealedFromTitle("Pokemon Evolving Skies Booster Box Case").ok, false);
  assert.equal(sealedFromTitle("Pokémon TCG Sealed Elite Trainer Box Lot - Evolving Skies + More").ok, false);
});
