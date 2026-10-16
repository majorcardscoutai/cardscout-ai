# CardHawk AI (formerly CardScout AI) — Progress Log

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

## Phase 2 — Saved data, manual analysis, password ✅ (complete 11 Oct 2026)

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

### Finishing items
- [x] Run on Mac with real Supabase — login works, watchlist row confirmed in Table Editor (10 Oct 2026)
- [x] Edit pages for watchlist and portfolio items (prefilled, validated, e2e-tested)
- [x] Code pushed to private GitHub repo `majorcardscoutai/cardscout-ai`; imported into Vercel with SUPABASE_URL, SUPABASE_SECRET_KEY, APP_PASSWORD; first deploy succeeded, sign-in screen live (10 Oct 2026)
- [x] Live at https://cardscout-ai.vercel.app — update "Edit buttons and Sydney region" deployed via git push, status Ready (11 Oct 2026)
- [x] Signed in on the live address; watchlist + Edit confirmed working
- [x] iPhone: signed in over the internet, added to Home Screen
- [x] `vercel.json` sets function region to Sydney (syd1), next to the Sydney database
- [x] Removed unused `src/components/ProfitCalculator.tsx`

Deployment notes:
- The Vercel CLI (`npx vercel`) does NOT work on this Mac — it needs esbuild, which requires macOS 12+. Deploy via GitHub instead.
- To publish changes: unzip the new version into ~/Projects/cardscout-ai, then `git add .` → `git commit -m "message"` → `git push`. Vercel rebuilds automatically.
- GitHub password prompt = the `ghp_` token (expires in 90 days), not the GitHub password.

Notes: resale values and holding values are **your estimates** (labelled as such) until verified sold data arrives in Phase 3. Investment scores stay demo-only until then.

## Phase 3 — Authorised data sources (started 11 Oct 2026)
- [x] Registered at developer.ebay.com (Individual) — approved 13 Oct 2026
- [x] Clear "can't search yet" message when eBay keys are missing; sidebar note updated for Phase 3
- [x] eBay Browse API client built (`src/lib/ebay/client.ts`): OAuth client-credentials token with caching, get item by legacy ID, newest-listing search, AUD→USD, shipping to AU, de-duplication, 401 refresh, 429/404/timeout/bad-key messages
- [x] Listing → card-details suggester (`src/lib/ebay/parse.ts`): item specifics first, title fallback, reports missing fields instead of guessing; Pokémon X/Y numbering handled
- [x] Manual Scanner: paste eBay link → listing panel (image, price, shipping, seller, risk flags) + prefilled analysis form
- [x] Scanner page: live "Search eBay now" (US or AU site, category, max price, BIN/auction) with Analyse links; results clearly labelled unvalued
- [x] 51 unit tests (16 eBay) + e2e checks against a fake eBay
- [x] Deployed "eBay connection" (commit 0ad0e41) — Vercel build Ready, 11 Oct 2026. eBay features show "not connected" until keys are added.
- [x] Production keyset created; Marketplace Account Deletion exemption granted (keyset was disabled until then); EBAY_CLIENT_ID / EBAY_CLIENT_SECRET added to Vercel (Production) — live eBay search verified on cardscout-ai.vercel.app, 13 Oct 2026
- [x] 'Analyse' prefill verified on a real listing (2018 Topps Now #210 Ohtani PSA 10); profit maths hand-checked: net US$61.64, ROI 10.6%, max price US$458 — 13 Oct 2026
- [x] Parcel-locker shipping setting (Settings → Shipping to you): eBay quoted shipping or fixed US$ per card; applied when a listing is loaded. DB columns added in Supabase; deployed and switched on (parcel locker, US$0) — 13 Oct 2026. 52 unit tests + e2e.
- [x] Scanner Type filter: added "Best Offer (accepts offers)" — eBay buyingOptions:{BEST_OFFER}
- [ ] Idea: show auction end time / hide early auctions (current bid of US$1 isn't meaningful)
- [ ] Choose and connect an authorised sold-price source (confirm terms of use and cost first)
- [x] Live FX rate (14 Oct 2026)
- [ ] Rate-limit handling, retries, error states

## Phase 4 — Automatic scanning 🟡 (code complete 13 Oct 2026; awaiting setup + first real scheduled run)
- [x] Card Values book (`card_values`): your value per exact card; normalised card key (`src/lib/cardKey.ts`) — parallel/grade/print run must match, incomplete cards never match
- [x] Values auto-fill expected resale in Analyse; "Remember this resale" checkbox when saving to watchlist; /values page (add, update, remove, age shown)
- [x] Live search shows profit/ROI + "meets your rules" for valued cards; "Save search" from any search
- [x] Saved searches (`saved_searches`) with pause/resume/remove; "Scan now" button
- [x] Scan engine (`src/data/scanner.ts`, `src/lib/scan.ts`): eBay → de-duplicate per search (`scan_hits` unique) → value → score → save; run log (`scan_runs`)
- [x] Alerts: email via Resend for new listings meeting your rules; auctions only within 24h of ending; max 15 per email
- [x] `/api/cron/scan` protected by CRON_SECRET (401 otherwise; closed if unset); excluded from password middleware
- [x] Schedule: GitHub Actions every 3h (`.github/workflows/scan.yml`) + Vercel daily cron backup (Hobby plan only allows daily)
- [x] Scanner shows "running" only if a *scheduled* scan ran in the last 4h — manual scans don't count
- [x] 61 unit tests + e2e (values, prefill, saved searches, scan, dedupe, email, pause, cron auth, middleware)
- [x] Phase 4 tables created in Supabase; CRON_SECRET (Vercel + GitHub secret), RESEND_API_KEY, ALERT_EMAIL added; token given `workflow` scope; deployed
- [x] First real manual scan (13 Oct 2026): saved search "shohei ohtani bowman" → 50 new listings stored, 0 deals (broad search; few cards valued yet)
- [x] First scheduled run via GitHub Actions (manual "Run workflow") — Success, 13 s, 13 Oct 2026. Runner pinned to ubuntu-24.04 (ubuntu-latest moves to 26 on 19 Oct)
- [x] Scan results re-priced on display with current Card Values + Settings (`revalueHit`) — values added after a scan now count; deals filter and Overview count use the re-priced results; "card details unclear" shown separately from "no value saved"; Overview status lines updated. 64 unit tests + e2e
- [x] Fix: eBay search results carry no item specifics, so titles without "baseball"/"NBA" never matched. Sport now inferred from known player or a single team name; stored results are re-read with the current parser on display. 65 unit tests + e2e. Deployed and verified live with FS-1 Ohtani PSA 10 value, 13 Oct 2026
- [ ] First real alert email (needs a valued card to appear in a scan)

### Mobile app — decided 13 Oct 2026
- Decision: stay with the home-screen (PWA) version for now — free, already on the phone, does the job. No App Store.
- If email alerts get missed once deals flow, add web push notifications to the site first (no Apple Developer account, no $99/yr, no App Store review). Preferred over a native app.
- Native/App Store routes noted if ever needed: Capacitor wrapper (~2–4 weeks, $99/yr Apple account, review may reject "just a website"); full React Native rebuild (~2–3 months). Both reopen the data-licensing question and Apple's 15–30% cut if opened to other users — tied to the SportsCardsPro answer.

### Multi-user access — possible future task (noted 13 Oct 2026)
- Can also be done on its own (one trusted friend) before Phase 6; it's the first build step of Phase 6.
- Travis wants the option to give a trusted friend their own access to the site.
- Current limitation: site uses a single shared password, not real accounts — can't give separate per-person logins today; sharing the password means sharing all of Travis's own data (settings, watchlist, Card Values).
- Future change: replace the shared password with proper Supabase Auth accounts, each user with their own separate data. Estimated ~half a day of work, not a rebuild.
- Travis plans to pay the SportsCardsPro monthly licence regardless of their reply. Before enabling other users, confirm the plan's terms allow showing its data to people other than the subscriber (some plans are single-user/personal only), and check eBay API terms for multi-user use. If both allow it, multi-user access can proceed whenever he wants.

### Next session (agreed 13 Oct 2026)
- [x] "Add value" on scan + live-search results → Card Values form prefilled from the title (missing fields listed, never guessed), returns to the Scanner after saving — 14 Oct 2026
- [x] Fix: "Add value" on a listing with an unclear title now links that listing to the card you confirm (scan_hits.card_key), so it gets priced — previously the value saved but the listing couldn't match. 68 unit tests + e2e — 14 Oct 2026
- [x] Auction filter: auctions with >24h left hidden from scan results and the Overview deal count (toggle "Show them"); ended auctions dropped — 14 Oct 2026. 67 unit tests + e2e
- [x] Live FX rate: USD→AUD from Frankfurter (ECB reference rates, free, no key), cached 6h; sanity-checked (0.8–3); Settings rate kept as backup when unavailable; shown on Overview + Settings. 71 unit tests + e2e. Deployed and verified live — 14 Oct 2026

### Update 14 Oct 2026 — Top Deals, exclude words, phone notifications
- [x] Top Deals is real: live scan deals re-priced with today's values/settings/FX, ranked (profit, ROI, newest, price), de-duplicated across searches; early/ended auctions and excluded titles hidden; "Close to your rules" list (within 15% of max price, shows your max for a Best Offer). Overview shows the best 4 live deals; all demo data removed from Overview/Top Deals (demo deal page retired; scoring engine kept for when sold data arrives)
- [x] Exclude words per search and per saved search (whole words, case/accents ignored); also hides earlier stored results
- [x] Phone notifications (Web Push): service worker, app manifest + icons (Home Screen install), Settings → Phone notifications (turn on per device, device list, test button), sent after each scan with the same deals as the email; dead devices removed automatically. Encryption verified byte-for-byte against the RFC 8291 example; VAPID token verified. No new npm packages (Node crypto)
- 78 unit tests + e2e (deals, exclude words, push setup/test/scan alert/cleanup, missing-table message)

**"Phase 5 SQL" (one-time, Supabase → SQL Editor):**
```sql
alter table public.saved_searches add column if not exists exclude_words text not null default '';
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  label text,
  created_at timestamptz not null default now(),
  last_ok_at timestamptz,
  last_error text
);
alter table public.push_subscriptions enable row level security;
```

**Notification keys (one-time, on the Mac):**
```
node -e "const e=require('crypto').createECDH('prime256v1');e.generateKeys();console.log('VAPID_PUBLIC_KEY='+e.getPublicKey('base64url'));console.log('VAPID_PRIVATE_KEY='+e.getPrivateKey('base64url'))"
```
Add both to Vercel → Settings → Environment Variables (Production), then redeploy. Never paste the private key into chat or browser code. If the keys are ever changed, every device must turn notifications on again.

**iPhone:** needs iOS 16.4+. Remove the old CardScout Home Screen icon, open the site in Safari → Share → Add to Home Screen, open it from the new icon → Settings → Turn on notifications → Allow → Send test notification.
- [x] Phone notifications verified on Travis's iPhone (test notification received after re-adding the Home Screen icon) — 14 Oct 2026


### Renamed to CardHawk AI — 14 Oct 2026
- Why: "CardScout" clashes — cardscoutai.com (2025, "Buy Smart, Sell Even Better"), cardscout.cards (paid sports-card app with eBay pricing), cardscout.co (TCGPlayer extension). Quick checks found no card-space product named CardHawk.
- Changed: app name, logo (CH), Home Screen icons/manifest, emails, push notifications, Instagram launch images (@CARDHAWK.AI).
- Not changed yet (on purpose): GitHub repo, local folder, Vercel URL (cardscout-ai.vercel.app), package name — rename alongside buying the domain so the scheduled scan isn't broken.
- [ ] Check CardHawk: domains (cardhawk.com.au / cardhawkai.com.au / .au / .com), Instagram handle, trade marks (IP Australia, USPTO, WIPO)
- [x] Logo: Option A (hawk, wings spread, gripping a card marked $) — in-app logo (src/components/HawkLogo.tsx), Home Screen/app icons, Instagram posts + profile picture — 14 Oct 2026
- [ ] Later: move to own domain; rename Vercel project/repo; update APP_URL + scan.yml URL

## Phase 5 — Advanced
- [ ] AI image analysis (suggest identity for user confirmation)
- [ ] Population data from an authorised source
- [ ] Portfolio analytics (value over time, realised P/L)

## Phase 6 — Go commercial (noted 13 Oct 2026)
Turn the private tool into a subscription website with individual paid logins. The code is the smaller part (~1–2 weeks); the licensing, business setup and legal responsibility are the larger 80% and are mostly decisions/paperwork, not code.

Build work
- [ ] Real user accounts via Supabase Auth, replacing the single shared password (~half a day) — see "Multi-user access" above
- [ ] Tenant separation: each user only ever sees their own data (settings, watchlist, Card Values, saved searches, scan results), enforced with row-level security
- [ ] Payments/subscriptions (e.g. Stripe): monthly fees, cancellations, access cut off when payment stops
- [ ] Per-user email alerts: verify a sending domain in Resend (free tier only sends to the account owner's address)
- [ ] Hosting: Vercel Hobby is for non-commercial use — move to a paid plan before charging; check Supabase plan limits
- Overall build estimate ~1–2 weeks, not a rebuild — the engine is already separate from the screens and data sources

Go-to-market requirements (the hard 80%)
- [ ] Data licensing (the real gatekeeper): a personal SportsCardsPro plan is not the same as a commercial licence to show their prices to paying customers — confirm commercial terms, price, and whether they allow it at all. Same check for eBay API terms.
- [ ] Business setup: terms of service, privacy policy, secure handling of customers' personal data and payments, GST registration once turnover requires it (Australia), support and liability when the site breaks
- [ ] Honesty rules become a legal matter: never fabricate sold prices or population figures; always label confidence and what is verified vs estimated — customers are paying for and relying on these numbers

Extra revenue: eBay Partner Network (affiliate) — noted 14 Oct 2026
- [ ] Join the eBay Partner Network (free; eBay AU supported). Pick payout currency carefully — can't be changed after applying. Check the collectibles commission rate and per-sale cap on the rate card before relying on it.
- [ ] Switch scanner/Analyse "view on eBay" links to affiliate links: send the campaign ID to the Browse API so eBay returns `itemAffiliateWebUrl`; fall back to the normal link when it's missing (~15 min)
- Earns a % of sales when users click through and buy (24 h window; 10 days to win an auction after bidding). Own purchases generally don't count — check the partner agreement — so only worthwhile once other people use the platform. Also strengthens the relationship with eBay when asking about commercial data use.

Brand & name (14 Oct 2026)
- Trade mark searches for "CardScout" (IP Australia, USPTO, WIPO) — no matches found by Travis.
- cardscoutai.com is taken (owner/use unchecked); cardscoutai.com.au available — needs an ABN (+ ideally "CardScout AI" business name with ASIC). Consider cardscoutai.au too.
- [ ] Get ABN → register business name → register cardscoutai.com.au (and .au)
- [ ] Later (before launch): consider filing own trade mark (software/app class); optional attorney clearance search

Recommended order: get real market-value data sorted and proven first → run privately (maybe with one friend) → switch on subscriptions only once Travis would happily pay for it himself.

## Worldwide: buyer region — built 16 Oct 2026
- Settings → "Where you buy from": Australia / United States / Rest of the world (+ country for RoW, optional US ZIP). Drives eBay shipping quotes (X-EBAY-C-ENDUSERCTX country/zip), the tax line label (Import GST / Sales tax / Import tax-VAT, rate still user-set), import risk flags, and A$ display (Australia only; others see US$). Overview shows "Buying from" for non-AU. Alert emails follow it.
- Waitlist asks "Where are you based?" (AU / US / Rest of world); shown in Settings and the CSV (based_in). Sign-ups still save if the region column isn't added yet.
- **Region SQL (one-time):** `alter table public.settings add column if not exists buyer_region text not null default 'AU'; alter table public.settings add column if not exists ship_to_country text; alter table public.settings add column if not exists ship_to_postcode text; alter table public.waitlist add column if not exists region text;`
- Still Australia-flavoured / later for paying users: per-user region (Phase 6 accounts), eBay UK/CA/DE sites, local currencies other than A$/US$, live FX for other currencies.
- Waitlist also asks "What's your main goal?" (tick any): Collecting / Investing / Flipping / Card business — counts shown in Settings → Waitlist, `goals` column in CSV. SQL adds `alter table public.waitlist add column if not exists goals text not null default '';`
- 83 unit tests + e2e. [x] Deployed; waitlist goal question confirmed live 16 Oct 2026 (confirm SQL run)

## Waitlist — built 15 Oct 2026
- Sign-in page now has "Join the waitlist" under the password box: email + optional NBA/MLB/Pokémon, hidden bot trap, duplicates ignored, consent line. Settings → Waitlist shows sign-ups and a CSV download (/api/waitlist, login only). 81 unit tests + e2e.
- **Waitlist SQL (one-time):** see bottom of supabase/schema.sql (`create table public.waitlist …`, RLS on).
- [x] Deployed + SQL run; waitlist + promo video verified live in a private window, 15 Oct 2026
- Promo video (15 s, muted loop) shown on the sign-in page above the waitlist: public/media/cardhawk-promo.mp4 + poster; /media/ excluded from the login check.
- Note: the sign-in page is the public link to share (e.g. Instagram bio) until there's a separate landing page/domain.

## eBay commercial use — checked 15 Oct 2026
- Read eBay API License Agreement (version dated 3 Sep 2025). Default Browse API limit 5,000 calls/day; higher via Application Growth Check.
- Needs eBay's written OK before charging users: §9.5 (no using eBay Content, alone or with third-party info, "to suggest or model prices for items listed on eBay Site" — max price / opening offer / value comparison may be caught) and §8.1.2 (eBay Content in a Public Display not combined with non-eBay Content).
- Must fix now (applies to personal use too): §8.1.3 — displayed listing info no more than 6 hours older than eBay. Plan: refresh deals with getItem on each scan; hide/flag listings not refreshed within 6h.
- Developer support activated (15 Oct). AI support chat could not open a ticket. Question posted publicly on the eBay Developer Forums (15 Oct) — awaiting eBay staff reply.
- [ ] eBay answer on §9.5 / §8.1.2 / paid subscriptions
- [ ] Join eBay Partner Network (may give a better support route)
- [x] 6-hour freshness fix built (15 Oct 2026): each scan re-checks up to 60 valued listings on eBay (getItem; 40 s budget), updates price/shipping/end time, marks sold/ended (404, out of stock, auction over); pages show only listings found or re-checked in the last 6 hours (older hidden with a note); a re-checked listing that newly qualifies (e.g. price drop) alerts once. 80 unit tests + e2e.
  - **Freshness SQL (one-time):** `alter table public.scan_hits add column if not exists checked_at timestamptz; alter table public.scan_hits add column if not exists status text not null default 'live';`
  - [x] Deployed + SQL run; verified live 15 Oct 2026: "11 re-checked (4 sold/ended)" on first scan

## Automatic values (SportsCardsPro / PriceCharting) — built 16 Oct 2026
- Each scan looks up cards from new listings (then recent results) in SportsCardsPro (sports) or PriceCharting (Pokémon), max 25 s per scan, 1 call/second. Results cached in `provider_values`: matched values refresh daily; no-match retried weekly.
- Only exact matches are used: same sport, player, year, set, card number and parallel (base ≠ Gold etc.), print run must be confirmed; two equally good matches = no value. Grade picks the price field (PSA/BGS/CGC/SGC 10 are grader-specific; 7–9.5 are any grader).
- Your own Card Values always win. "Wrong match?" on Scanner/Deals/Card Values stops that automatic value for good. Values tagged "SportsCardsPro"/"PriceCharting" with attribution links on pages and in alert emails (required by their terms).
- Analyse page fills Expected resale from the price guide when you have no value of your own.
- Settings → Market values → Test connection (looks up 2018 Topps Update Ohtani #US1 PSA 10).
- **Automatic values SQL (one-time):** see bottom of supabase/schema.sql (`create table public.provider_values …`, RLS on). Scans keep working without it but show "run the one-time SQL update".
- 89 unit tests + e2e (fake SportsCardsPro: matching, parallel guard, cache, own value wins, wrong match, bad token, missing table).
- [x] Deployed; Test connection ✓ 16 Oct 2026 (Ohtani #US1 PSA 10 = US$524.52)
- [ ] SQL run + first scan shows "X of Y cards valued automatically"
- Fix 16 Oct 2026: live searches on the Scanner page now look up the cards shown (max 15 s; rest next search). Title reader knows ~90 sets, most specific first ("Bowman's Best" ≠ "Bowman"); sports matches need the exact set name (Panini ignored); Japanese/promo Pokémon never used for English cards. 90 unit tests + e2e.

## Next major feature (after automatic values): Profit Hunter — noted 16 Oct 2026
- New sidebar page: scan ALL new listings in chosen categories under a budget (not specific cards), value each via the SportsCardsPro daily price-guide download, flag anything clearing min ROI/profit; alerts as usual.
- Safeguards: high-confidence matches only, graded-first, show matched card, skip low sales-volume cards; scan every 30–60 min. Needs eBay §9.5 answer before selling it. ~1–2 days build.

## Open decisions
- Sold-price source: **decided 11 Oct 2026 — Option A (free) for now.** Travis enters resale estimates from eBay sold listings manually. Revisit paid PriceCharting/SportsCardsPro (US$49+/month) after a few weeks of real use.
- Default fee rate for the marketplace you'll resell on (eBay AU vs eBay US)
- Automatic market values: SportsCardsPro replied 15 Oct 2026 (Brady Haugh) — **commercial use approved**: Legendary subscription (US$50/mo) until CardHawk revenue reaches US$1,000/mo, with attribution (logo or text link to their product page); above that, formal Commercial Agreement at 8% of top-line revenue. Keep this email as written permission.
  - API: token param `t`; /api/product (id or q) and /api/products (q, 20 results); 1 call/sec; prices in pennies; caching allowed (purge if subscription ends); CSV full guide daily (Legendary). Fields: loose=ungraded, cib=7/7.5, new=8/8.5, graded=9, box-only=9.5, manual-only=PSA 10, bgs-10, condition-17=CGC 10, condition-18=SGC 10; sales-volume = units/yr. Grades 7–9.5 are not grader-specific.
  - [x] Confirmed by Brady 16 Oct 2026: one Legendary subscription covers BOTH SportsCardsPro and PriceCharting; the US$1,000/mo threshold and 8% share use TOTAL revenue (subscriptions + affiliate etc.); prices may be used in email and push alerts (with attribution).
  - [x] Subscribed (Legendary) + SPORTSCARDSPRO_TOKEN added to Vercel, 16 Oct 2026
  - [x] Automatic values built 16 Oct 2026 — see "Automatic values" section below

---

<sub>The earlier subscription footnote is now Phase 6 above.</sub>

## Updating the live app (Travis's Mac) — always give these with each zip
- Project folder: `~/Projects/cardscout-ai` (GitHub majorcardscoutai/cardscout-ai, auto-deploys to Vercel)
- Unzip: `cd ~/Downloads && Z=$(ls -t cardhawk-ai*.zip | head -1) && echo "Zip: $Z" && ditto -x -k "$Z" ~/Projects && cd ~/Projects/cardscout-ai && <grep check for a new file/line>`
- Publish: `cd ~/Projects/cardscout-ai && git add -A && git commit -m "<what changed>" && git push`
