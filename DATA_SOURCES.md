# CardHawk AI — Data Sources (licensing & cost note for Phase 3)

> **Scope:** private, personal use only.
> Anything commercial — see the subscription footnote at the bottom of `PROGRESS.md` — requires **every licence below to be re-checked** under stricter commercial/redistribution terms before any data is shown to other users.

## Golden rule

**Always use each site's official API or data product.**
Never scrape pages a provider didn't offer, and never redistribute data they didn't licence.
The risk is in **how** data is obtained, not **which** site it comes from.

---

## eBay

| | |
|---|---|
| Access | eBay Developers Program (free to join) |
| Cost | $0 to join; most APIs free within rate limits |
| Use for | **Live listings** (Browse API) |
| Catch | **Sold prices** sit in the restricted *Marketplace Insights* API. Developers report being **denied** access and told it is for major partners only. |

**Plan:** use eBay for active listings. If sold-price access is denied, take sold values from PriceCharting instead. Data acquisition is kept separate from valuation (`src/data/source.ts`), so swapping the source is painless.

## PriceCharting — likely our workhorse for values

| | |
|---|---|
| Access | Official paid subscription; top **"Legendary"** tier unlocks the **API + daily CSV download** |
| Coverage | Pokémon on PriceCharting; baseball/basketball on SportsCardsPro (separate site and subscription). Graded values per grade, incl. PSA 10 and BGS 10 |
| Pricing model | Flat subscription (not pay-per-request), predictable |
| Cost | **Corrected 11 Oct 2026:** Legendary is listed at **US$49/month** (≈ A$75/month); only Legendary includes the API. The cheaper Collector tier (US$6/month) has **no** API. Sports cards (baseball, basketball) live on the sister site **SportsCardsPro**, which needs its own paid subscription for API access — price not confirmed. |
| Catch | API/CSV provide **current values per grade/condition**; individual historic sales are not in the API. |

**Implication for the valuation engine:** PriceCharting values arrive pre-aggregated rather than as individual sold comps, so the engine will need a "provider value" input path alongside sold comps, with confidence rated accordingly.

## PSA

| | |
|---|---|
| Access | Official **PSA Public API** — free with a PSA account (OAuth2) |
| Use for | **Cert verification** — look up a slab by its certificate number |
| Catch | **Population counts by grade are NOT in the free public API.** Real population data only comes via third-party providers, which cost money and have greyer licensing. |

**Plan:** use the free PSA API for cert checks now. Treat full population data as a later, separate problem (Phase 5 territory). Until then the app keeps showing population as "missing" — never estimated.

---

## Other options checked (13 Oct 2026)

| Source | Covers | Graded | Cost | Verdict |
|---|---|---|---|---|
| Scrydex API | Pokémon + other TCGs (no sports) | Yes (PSA, BGS, CGC…) | from US$29/month | Pokémon-only option |
| eBay Marketplace Insights | eBay sold items | — | Free | Restricted; individuals report being denied. Worth a free request anyway |
| Third-party scrapers (e.g. Apify actors for SportsCardsPro / Card Ladder) | Various | Various | Various | **Not used** — they scrape sites without permission |
| Asking prices from active listings | — | — | Free | **Not used** — asking price ≠ market value |

## Summary

- **Realistic paid cost:** US$49/month for PriceCharting Legendary (Pokémon), plus a SportsCardsPro subscription for sports cards (price to confirm). Earlier "tens of dollars a year" estimate was wrong. eBay and PSA basic APIs are free.
- **Free alternative for now:** enter your own resale estimate from eBay's sold listings in the Manual Scanner — already supported.
- **Deferred / harder / costlier:** eBay sold-price access (Marketplace Insights) and PSA population data.

## TODO before Phase 3

- [ ] Confirm SportsCardsPro API price and whether one subscription covers both sites; confirm terms of use (personal use, API limits, caching)
- [ ] Apply for eBay developer keys and confirm whether our app is granted Marketplace Insights
- [ ] Decide eBay AU vs eBay US resale fee assumptions (`src/lib/config.ts`)
- [ ] Create a PSA account and test a cert lookup

---

*Noted 2026-10-10. All figures are indicative and must be verified on each provider's own site before relying on them.*


## Exchange rate (USD → AUD)
- **Source:** Frankfurter (frankfurter.dev) — free, no API key, European Central Bank reference rates, updated once per working day.
- **Use:** converting A$ prices and showing A$ figures. Cached for 6 hours. If it's unavailable or returns an implausible number, the backup rate in Settings is used and the app says so.
- **Note:** ECB reference rates are mid-market; your bank/PayPal conversion will be slightly worse. Allow for that in your minimum profit.
