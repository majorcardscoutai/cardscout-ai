# CardScout AI — Data Sources (licensing & cost note for Phase 3)

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
| Coverage | Sports cards and Pokémon |
| Pricing model | Flat subscription (not pay-per-request), predictable |
| Cost | Modest annual subscription — on the order of **tens of dollars per year**. **Confirm the exact figure on their site before committing.** |
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

## Summary

- **Realistic paid cost for a solid private v1:** roughly one PriceCharting Legendary subscription (tens of dollars a year). eBay and PSA basic APIs are free.
- **Deferred / harder / costlier:** eBay sold-price access (Marketplace Insights) and PSA population data.

## TODO before Phase 3

- [ ] Confirm PriceCharting's exact price and terms of use (personal use, API limits, caching)
- [ ] Apply for eBay developer keys and confirm whether our app is granted Marketplace Insights
- [ ] Decide eBay AU vs eBay US resale fee assumptions (`src/lib/config.ts`)
- [ ] Create a PSA account and test a cert lookup

---

*Noted 2026-10-10. All figures are indicative and must be verified on each provider's own site before relying on them.*
