# CardScout AI — Progress Log

## Phase 1 — Dashboard with demonstration data ✅ (verified running on Travis's MacBook, 10 Oct 2026)

### Done
- [x] Next.js + TypeScript + Tailwind project structure, dark financial theme, responsive (MacBook sidebar / iPhone tab strip)
- [x] Profit engine: net profit, ROI, import GST, fees, max purchase price for min ROI **and** min profit, opening offer
- [x] Valuation engine: sold-comps only, exact-match priority, 120-day window, recency weighting, outlier removal, Best Offer down-weighting, confidence rating, honest "insufficient data"
- [x] 100-point transparent scoring with confidence caps; unscored when no verified value; missing population flagged
- [x] Pages: Overview, Automatic Scanner (honest "Not running"), Manual Scanner (live calculator), Top Deals (filter/sort), Deal detail, Watchlist, Portfolio, Settings
- [x] All money shown in USD and AUD
- [x] Demo data labelled on every page; demo listings have no links
- [x] 24 automated tests on the maths (`npm test`)

### Verification notes
- Tests and strict type-check of the calculation modules pass.
- Every page was server-rendered successfully in a test harness (no runtime errors, no NaN/undefined values).
- Verified locally: `npm install`, `npm test` (24/24 pass) and `npm run dev` (Next.js 15.5, styling correct).
- Mac runs an older macOS: Node.js 20 is used; esbuild/tsx removed (needed macOS 12+) — tests compile with plain `tsc` instead.
- Not yet checked: `npm run build`, iPhone view, `npm audit` warnings (do NOT run `npm audit fix --force`).

## Phase 2 — Saved data, manual analysis, password 🟡 (live on Vercel; finishing touches next)

### Done
- [x] Supabase project created (Sydney region); tables `settings`, `watchlist`, `holdings` with Row Level Security on and no public policies (`supabase/schema.sql`)
- [x] Server-only database access with the secret key (`src/lib/supabase.ts`, `src/data/db.ts`); errors shown as a clear notice, never a crash
- [x] Editable Settings page saved to the database (fees, GST, FX rate, min ROI/profit)
- [x] Manual Scanner: exact card-details form + live profit/ROI/max price/opening offer → save to watchlist (AUD or USD entry, stored in USD)
- [x] Watchlist: real saved cards, recalculated with current settings, remove button
- [x] Portfolio: add / remove holdings, cost basis, unrealised gain
- [x] Password protection: login page + middleware on every page, 30-day httpOnly cookie, fails closed if APP_PASSWORD missing
- [x] Form validation module with tests; 35 unit tests total
- [x] End-to-end check against a fake database: save/add/remove flows, validation errors, login/logout, forged cookie blocked, database outage handled

### Still to do in Phase 2
- [x] Run on Mac with real Supabase — login works, watchlist row confirmed in Table Editor (10 Oct 2026)
- [x] Edit pages for watchlist and portfolio items (prefilled, validated, e2e-tested)
- [x] Code pushed to private GitHub repo `majorcardscoutai/cardscout-ai`; imported into Vercel with SUPABASE_URL, SUPABASE_SECRET_KEY, APP_PASSWORD; first deploy succeeded, sign-in screen live (10 Oct 2026)
- [ ] Sign in on the live .vercel.app address and confirm watchlist loads
- [ ] iPhone check over the internet + Add to Home Screen
- [x] `vercel.json` sets function region to Sydney (syd1), next to the Sydney database
- [x] Removed unused `src/components/ProfitCalculator.tsx`

Deployment notes:
- The Vercel CLI (`npx vercel`) does NOT work on this Mac — it needs esbuild, which requires macOS 12+. Deploy via GitHub instead.
- To publish changes: unzip the new version into ~/Projects/cardscout-ai, then `git add .` → `git commit -m "message"` → `git push`. Vercel rebuilds automatically.
- GitHub password prompt = the `ghp_` token (expires in 90 days), not the GitHub password.

Notes: resale values and holding values are **your estimates** (labelled as such) until verified sold data arrives in Phase 3. Investment scores stay demo-only until then.

## Phase 3 — Authorised data sources
- [ ] Apply for eBay Developers Program keys; Browse API for active listings (server-side only)
- [ ] Choose and connect an authorised sold-price source (confirm terms of use and cost first)
- [ ] Listing-URL analysis in Manual Scanner
- [ ] Title/item-specifics parser → exact CardIdentity
- [ ] Live FX rate
- [ ] Rate-limit handling, retries, error states

## Phase 4 — Automatic scanning
- [ ] Saved searches stored in DB
- [ ] Scheduled job (Vercel Cron) → search → de-duplicate → value → score → save
- [ ] Alerts (email first)
- [ ] Mark scanner as "Running" only after an end-to-end test with real data

## Phase 5 — Advanced
- [ ] AI image analysis (suggest identity for user confirmation)
- [ ] Population data from an authorised source
- [ ] Portfolio analytics (value over time, realised P/L)

## Open decisions
- Which sold-price source to use (eBay's own sold-item data access is restricted; options to evaluate in Phase 3)
- Default fee rate for the marketplace you'll resell on (eBay AU vs eBay US)

---

<sub>Footnote — possible future idea (deferred, not part of the current plan): opening CardScout AI to other users as a paid subscription. The current build keeps this feasible — Supabase supports user accounts and per-user data separation, Vercel hosting scales without changes, and the valuation/scoring engine is kept separate from data sources and screens. The deciding factor would be data-source licensing for commercial use (eBay API terms and any paid sold-price provider), not the code. Revisit only after the private tool is proven.</sub>
