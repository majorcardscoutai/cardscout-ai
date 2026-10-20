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
- Fix 16 Oct 2026: Analyse now always pre-fills Expected resale, profit and ROI when the Scanner showed a value — it tries the listing's item specifics, then the title reading the Scanner uses. "Base Set"/"None" in item specifics = no parallel. Result note says the value is the price-guide market value; "Remember as my value" starts unticked for guide values (so they keep updating daily).
- 16 Oct 2026: rows without a value now say why (no exact match / no price for this grade / several matches / you rejected) with a tap-to-open "why?" listing the closest guide products. Apostrophes ignored when matching ("Bowman's Best" = "Bowmans Best"). Unmatched results saved before the fix are retried once (MATCHER_UPDATED_AT). 91 unit tests + e2e.

## Profit Hunter — built 16 Oct 2026
- New sidebar page under Top Deals (/hunter). Checks EVERY new graded listing (PSA/BGS/SGC/CGC) under your budget in Baseball / Basketball / Pokémon — newest 200 per sport per run, eBay US or AU, Buy It Now (auctions optional, last 24 h only), min price, exclude words.
- Each sport = hidden saved search (saved_searches.kind = 'hunter', query = MLB/NBA/Pokemon), so valuation, freshness re-checks, email + phone alerts, Wrong match? all reuse the scanner. Scanner page hides hunter searches/results; Top Deals includes them.
- Liquidity: hunter finds only shown/alerted when the price guide says the card sells ≥ "Minimum sales per year" (default 12); hidden ones counted on the page. Your own Card Values always pass.
- Runs every hour via .github/workflows/hunt.yml (/api/cron/scan?only=hunter, same CRON_SECRET), plus "Hunt now". Saved searches stay 3-hourly.
- Limits: price guide 1 lookup/sec → ~20 new cards valued per run; cache grows (daily refresh). eBay calls ≈ 72 searches + re-checks/day, well under 5,000. Next step for scale: SportsCardsPro daily CSV download of the whole guide.
- Hunter has its own Minimum ROI (%) and Minimum profit (US$) — blank = Settings rules. Used for Hunter finds, alerts and Top Deals; saved searches keep Settings' rules. Columns hunter_config.min_roi / min_profit.
- 16 Oct 2026 first live run: 655 listings checked, 9 valued. Added: "Why listings have no value" breakdown (title missing details / waiting / no match / no grade price), hunter-only runs value for ~42 s (≈35 cards), hunter listings not reached are back-filled next run, and hunter results are kept separate from your saved searches' results (so they can't push yours out of the 1,000-row window or miss re-checks).
- 16 Oct 2026 accuracy boost: vague graded titles are fetched once from eBay (item specifics: Year / Set / Card Number / Grade) — up to 40 per run (~1,000 eBay calls/day max). Cards not reached in time are queued in provider_values (status "pending") and looked up first next run. Breakdown shows example titles per reason. Next: improve title reading from those examples; SportsCardsPro per-set CSV download (link format from Subscriptions → API/Download — ask Travis).
- 16 Oct 2026 title reading (live breakdown: 91% of 935 listings unreadable — 717 "player not recognised"): players no longer need to be on a list (guessPlayer: strip years/numbers/grades/set/brand/parallel/team/city words, take first name-like run; still must match the guide's player + year + set + number exactly); Hunter passes its sport to the reader; card numbers like US1 / BCP-50 / "No. 49" without #; Pokémon series sets (Scarlet & Violet etc., specific set wins) and Pokémon no longer need a year. 96 unit tests + e2e. Expect "Waiting for a lookup" to grow — the 1/sec price-guide limit becomes the bottleneck → CSV download next.
- 16 Oct 2026 accuracy: parallels must match the guide EXACTLY ("Refractor" ≠ "Gold Refractor"; print-run numbers checked separately) — parallel values saved before the rule are ignored and redone. Colour parallels read in full (Emerald Refractor, Gold Wave Refractor, Silver Prizm). Full English Pokémon set list (Base Set → Phantasmal Flames; series names like XY only as fallback); "Rev Foil" = Reverse Holo; plain "Holo" isn't a Pokémon parallel; "1st Edition". Bowman/Topps sets imply baseball outside the Hunter. 97 unit tests + e2e.
- 19 Oct 2026 (weekend result: 1,000 live listings, 38 valued, 472 waiting, 404 unreadable — 1st real find: Blaine's Charmeleon 1st Ed CGC 9 +US$22.61): lookups now shared across grades of the same card (sameCardKey; one search prices PSA 9 + PSA 10…) and the most-listed cards go first; Hunter every 30 min (hunt.yml :07/:37); set-name fallback (matchBySetInTitle): titles with player/year/number/grade but an unknown or brand-only set ("Topps") search the guide and accept only the card whose own player AND set are in the title — cached a week (provider_values status "setlist"). 99 unit tests + e2e.
- CSV download findings (19 Oct): Legendary includes it. Per set: `https://www.sportscardspro.com/price-guide/download-custom?t=<token>&console-uids=G23347` (2018 Topps Update) → columns id, console-name, product-name, loose/cib/new/graded/box-only/manual-only/bgs-10/condition-9…18 prices ($ USD), retail-*, upc, sales-volume, genre, tcg-id, asin, epid, release-date (same as API). Without console-uids → PriceCharting video-game guide (124,410 rows), not cards. Asked Brady: whole-category parameter? multiple console-uids? list of uids / API field? → then build daily CSV import (guide_prices table, local matching, no 1/sec limit).
- NOTE: Travis pasted the FULL SportsCardsPro token in chat 19 Oct → treat as exposed; replace in Vercel when Brady issues a new one.
- Asked Brady (19 Oct) about a full price-guide CSV (docs say Retailer plan) + a new API token (most of the old one was visible in a screenshot) → when the new token arrives: replace SPORTSCARDSPRO_TOKEN in Vercel.
- **Profit Hunter SQL (one-time):** bottom of supabase/schema.sql (`alter table saved_searches add column kind …; create table hunter_config …`).
- 94 unit tests + e2e (hunter: setup/validation, hunt now, broad search URL, valuation + alert, hourly cron, sales filter, Top Deals, off, missing SQL).
- [ ] Deployed + SQL run + hunter turned on + first hourly run seen in GitHub Actions
- [ ] eBay §9.5 answer still needed before selling this feature

## Popular sets — daily price-guide download — built 20 Oct 2026
- SportsCardsPro (JJ Hendricks, 20 Oct): up to 5 console-uids per CSV request; no list of uids; downloads meant for particular sets, NOT whole-database downloads. So CardHawk only downloads sets Travis adds.
- Settings → "Popular sets": paste a set's "Download Price List" link → only host + console-uid kept (token in the link is never stored; downloads use SPORTSCARDSPRO_TOKEN). Max 60 sets. First download immediate; then every scan refreshes sets older than 24 h (≤5 uids/request, ≤3 requests/run, 12 s budget). New sets downloaded alone (to learn the set name); known ones batched, rows mapped back by console-name.
- Tables guide_sets + guide_prices (product id, set uid, console/product name, normalised number, prices in pennies, sales volume). Valuing checks these first (same pickProduct / matchBySetInTitle rules), instantly and even after the lookup time budget; everything else still uses API lookups.
- Hunter page: "Sets worth adding to Popular sets" (sets most common in listings still without a value) with "Find set ↗" links to the guide's search.
- **Popular sets SQL (one-time):** bottom of supabase/schema.sql (guide_sets, guide_prices + indexes).
- 107 unit tests + e2e scenario 19.
- [ ] Asked JJ: higher API rate limit (>1 call/sec) available for a commercial app?

## Recent sales & PSA slab check (Analyse) — built 19 Oct 2026
- Analyse (listing loaded) shows "Recent sales & slab check": links that open eBay SOLD listings (most recent first, exact card + grade, eBay US/AU), the SportsCardsPro/PriceCharting search for the card, and PSA Auction Prices; plus "sells ~N/yr" from the guide. Links only — nothing copied from websites (no scraping).
- PSA slab check: cert number from eBay item specifics ("Certification Number") → PSA Public API (GetByCertNumber, bearer PSA_API_TOKEN) → ✓ "Matches PSA's record" (with PSA's caveat: a real cert number on a fake slab is possible — check photos) / ⚠ mismatch (grade, card number, year, player) + PSA population. Shared cache table psa_certs (one PSA call per cert for ALL users; population refreshed after 30 days); only called when someone opens Analyse. Without a token: "verify on PSA" link. CGC: lookup link only.
- **PSA SQL (one-time):** bottom of supabase/schema.sql (`create table public.psa_certs …`).
- Setup: register/sign in at psacard.com → Public API → generate token → Vercel env PSA_API_TOKEN → redeploy.
- Fix 19 Oct: eBay keeps grader / grade / Certification Number for graded cards in "conditionDescriptors" (not item specifics) — mapItem now merges them into aspects (item specifics win on duplicates); non-PSA certs get a lookup link + "automatic checks are PSA only". 103 unit tests + e2e.
- [x] PSA_API_TOKEN added in Vercel (19 Oct 2026) — but PSA replies 403 "Access to this API is limited to approved customers." → [x] approval requested from PSA 19 Oct 2026 (awaiting reply). Until then the slab check shows the cert number + "Verify on PSA" link.
- [ ] **Licence check before charging users:** read PSA's API End User Agreement (commercial use, display of population data, daily call limit, caching) — same as eBay/SportsCardsPro.
- [ ] Later: in-app "last 5 sales" needs a licensed source — ask Brady (SportsCardsPro recent sales via API?) or apply for eBay Marketplace Insights (limited release). eBay Partner Network could earn commission on the eBay links.
- 102 unit tests + e2e (scenario 18).

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

## 20 Oct 2026 — fewer "no exact match" results (from the Hunter examples)
- Chrome/Prizm parallels: "Blue Refractor" now matches the guide's "[Blue]" (and "Silver Prizm" ↔ "[Silver]"). "Blue Wave" and plain "Refractor" still never match "Blue".
- Card numbers with a suffix ("#83-2", Topps 1983 inserts) are read in full.
- Print runs the guide leaves out of its name (Blue /150 ↔ "[Blue]") are accepted only when exactly one guide card fits and its name shows no number at all.
- One-letter spelling differences in first names ("Satchel" vs "Satchell" Paige) match; the surname must be exact, and short first names (Mike/Mark) must be exact.
- "T206" / "E90" style set codes are no longer read as card numbers.
- Unmatched cards saved before 20 Oct are re-checked once under the new rules (MATCHER_UPDATED_AT).
- "View on eBay ↗" on every listing (Top Deals, Profit Hunter, Scanner, Overview) and a button on Analyse with "Purchases are made on eBay — CardHawk doesn't sell cards." (src/components/EbayLink.tsx)
- Faster Profit Hunter (20 Oct 2026): quick "new listings" runs every 10 minutes (hunt-quick.yml at :07/:27/:47/:57, plus :17 outside the 3-hourly scan hours) — newest 100 per sport, up to 10 item-specifics lookups, no re-checks (~13 eBay calls max per run). Full sweep (newest 200, 40 lookups, re-checks) moved from every 30 minutes to hourly at :37 (hunt.yml). Endpoint: /api/cron/scan?only=hunter-quick. eBay calls/day stay about the same as before (~1,600 quick + ~1,000–2,000 full + scans).

## Phase 6 — user accounts (plan: Claude Docs "CardHawk AI — Phase 6 Plan: User Accounts", 20 Oct 2026)
Decisions (20 Oct): invite-only beta · email + password sign-in only · 5 saved searches per beta user · Popular sets managed by admin only. SportsCardsPro commercial use already approved (Brady, 15 Oct); eBay approval pending (Application Growth Check sent 20 Oct) — invite beta users only after eBay's OK.

### Step 1 — accounts and sign-in (built 20 Oct 2026)
- Supabase Auth via its REST API (src/lib/supabase-auth.ts — no new packages, server-side only, no browser keys). httpOnly cookies ch_at (access token) + ch_rt (refresh token), 30 days. Tokens checked with Supabase and cached 5 min; expired tokens refreshed in the middleware.
- Sign-in page: email + password; "Forgot password?" (/login/forgot → emailed link → /auth/reset to choose a new password, then signed in). Invite links will use the same page (step 6). No public sign-up.
- The old site password (APP_PASSWORD) still works alongside ("Use the old site password") until step 6.
- Admin = emails in ADMIN_EMAILS (Vercel env). Settings → Account shows who is signed in.
- Setup (Travis): Supabase → Authentication → Sign In / Providers: turn OFF "Allow new users to sign up"; URL Configuration: Site URL https://cardscout-ai.vercel.app + Redirect URL https://cardscout-ai.vercel.app/auth/reset; Users → Add user (Auto Confirm). Vercel: ADMIN_EMAILS.
- Note: Supabase's built-in email only sends to project team members and has a low hourly limit — fine for Travis; custom SMTP (e.g. Resend) needed before beta invites (step 6).
- 108 unit tests + e2e scenario 20.

### Step 2 — your data moves into your account (built 20 Oct 2026)
- Every per-user table (settings, hunter_config, saved_searches, scan_hits, scan_runs, watchlist, holdings, card_values, push_subscriptions) gets user_id; the one-time SQL (bottom of supabase/schema.sql, "Phase 6 step 2") gives all existing rows to your account and makes settings / Hunter one row per account and Card Values unique per account.
- src/data/owner.ts: tbl(table) filters every read/update/delete by the signed-in account and stamps inserts; scheduled scans run per account (runAsUser) — the cron endpoint loops over accounts with active searches.
- The old site password (APP_PASSWORD) is retired — sign in with your email. APP_PASSWORD can be deleted from Vercel.
- Order: run the SQL first, then publish (the SQL defaults new rows to your account so the old code keeps working in between).
- To do in step 4: "This match is wrong" (rejectProviderValue) currently rejects the shared guide value for everyone → make it per account; email alerts still go to ALERT_EMAIL → each account's own email; remove the user_id default set by the step 2 SQL before anyone else joins.
- 108 unit tests + e2e scenarios 8 (updated), 20, 21 (accounts are separate).

### Step 3 — database rules (built 20 Oct 2026)
- SQL (bottom of supabase/schema.sql, "Phase 6 step 3"): row-level security policy "<table>_own_rows" on the 9 per-account tables — signed-in accounts reach only rows with their own user_id; anon has no access; shared tables keep RLS on with no policies (server only).
- Pages and forms query per-account tables AS the signed-in person (SUPABASE_PUBLISHABLE_KEY + their access token — src/lib/supabase.ts userDb), so the database enforces separation even if the app had a bug. Shared tables and scheduled scans use the server key (with the user_id filter).
- Settings → Account shows "Database protection: on" (or "app only" until SUPABASE_PUBLISHABLE_KEY is set).
- Order: SQL → publish → add SUPABASE_PUBLISHABLE_KEY in Vercel → redeploy. (Adding the key before the SQL would hide your data until the SQL runs.)
- e2e scenario 22.

### Step 4 — per-account settings, Hunter, alerts (built 20 Oct 2026)
- New accounts start with default Settings and the Profit Hunter off (already true after step 2; checked in e2e 21).
- Alert emails go to each account's own sign-in email (profiles table, recorded when the account opens CardHawk); admins can redirect theirs with ALERT_EMAIL. Settings → Account shows where alerts go. Push alerts already go only to the account's own devices.
- NOTE: Resend only delivers to other people's addresses once a domain is verified in Resend and ALERT_FROM uses it — needed before beta users get email alerts (push works without it).
- "Wrong match?" is per account (value_rejections table); an admin's click also rejects the shared guide value for everyone. (A shared rejection can be overwritten if another account's lookup re-prices that card — personal rejections can't.)
- Attribution: every "SportsCardsPro value"/"PriceCharting value" label links to the source; push alerts name the guide; email footer already credits both.
- SQL (bottom of schema.sql, "Phase 6 step 4"): profiles, value_rejections (+ row-level security), and removes step 2's temporary user_id default.
- e2e scenario 23 (+ updated 11, 16, 17 expectations).

### Step 5 — scans for many accounts (built 20 Oct 2026)
- runScheduledScans (src/data/scanner.ts), called by the cron endpoint: Popular sets refresh once; Profit Hunter = ONE broad eBay search per sport + market + delivery address for everyone (widest budget, lowest min price, auctions if anyone wants them), then each account's own budget/min price/auctions/exclude words (fitsHunterInput); identical searches and listing look-ups are fetched once per run (rememberingEbay); accounts that waited longest go first and each gets a fair slice of the 50 s budget — anyone not reached goes first next run.
- 5 saved searches per account (src/lib/limits.ts; admins unlimited; Hunter's hidden searches don't count). Scanner shows "Saved searches (n of 5)".
- eBay and SportsCardsPro calls are counted per account, "shared" and "app" (lib/scan-context.ts) and added to api_usage per day after each scheduled run (Admin page in step 6). Page use (Analyse, live search) is counted as "app" only when it happens during a scheduled run's lifetime — mostly scheduled usage.
- SQL (bottom of schema.sql, "Phase 6 step 5"): api_usage.
- e2e scenario 24.

### Step 6 — Admin page, invites, delete my account (built 20 Oct 2026)
- /admin (admins only; "Admin" appears in the menu for admins): invite by email, accounts (joined, last seen, saved searches, Hunter on/off), waitlist with Invite / Resend invite / "Has an account", API usage for the last 7 days (per account, shared Hunter search, pages, daily totals), service status.
- Invites use Supabase's admin invite (server secret key) → email link → /auth/reset "Welcome! Choose a password" → signed in. waitlist.invited_at records it (non-waitlist emails are added with source "admin-invite").
- Settings → Account → "Delete my account" (type DELETE): deletes the Supabase user; every per-account table cascades. Admin accounts can't delete themselves there.
- Now admin-only: the waitlist (moved from Settings to Admin) and its CSV download, Popular sets (Settings panel + add/remove/refresh).
- SQL (bottom of schema.sql, "Phase 6 step 6"): waitlist.invited_at.
- e2e scenario 25 (+ admin sessions in 14, 15, 19).

### Beta launch checklist (before the first invite)
- [ ] eBay's written OK (§9.5 / §8.1.2 — Application Growth Check sent 20 Oct).
- [ ] Domain bought; verified in Resend (DNS records); ALERT_FROM = alerts@<domain> in Vercel.
- [ ] Supabase → Authentication → Emails → SMTP Settings: Resend (host smtp.resend.com, port 465, user "resend", password = a Resend API key, sender noreply@<domain>) — so invite and password emails reach anyone.
- [ ] Supabase → Authentication → URL Configuration: Site URL + /auth/reset redirect on the new domain (if the address changes).
- [ ] Replace the exposed SportsCardsPro token (Brady).
- [ ] Terms of use + privacy policy page (Phase 7, before charging; good practice before beta).

## Graded / raw filter on the Automatic Scanner (20 Oct 2026)
- "Graded or raw" on Search eBay now: Both / Graded only / Ungraded (raw) only. eBay filters by its trading-card condition (conditionIds 2750 Graded, 4000 Ungraded); listings that slip through are checked again (eBay condition → Professional Grader/Grade item specifics → grader name in the title).
- Saved with the search (saved_searches.grading) and used by every scan; the saved-search list shows "Graded only" / "Raw only".
- SQL (bottom of schema.sql): saved_searches.grading. 109 unit tests + e2e scenario 26.
