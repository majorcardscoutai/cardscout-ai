# CardHawk AI

A private trading-card investment dashboard. It compares asking prices with **verified sold prices**, works out profit after every cost, and scores each opportunity out of 100.

> **Status (Oct 2026):** sign-in is by account (email + password, invite only — Phase 6); each account's data is kept separate. Older note: your settings, watchlist and portfolio are saved in Supabase. Deal listings and sold comparisons are still clearly labelled **demonstration data** until Phase 3. Automatic scanning is **not** built yet.

## Your private keys (.env.local)

The app needs a file called `.env.local` in the project folder (never shared, never uploaded):

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SECRET_KEY=sb_secret_...
ADMIN_EMAILS=you@example.com         # Phase 6: your sign-in email (admin)
EBAY_CLIENT_ID=your-ebay-app-id        # Phase 3, Production keyset
EBAY_CLIENT_SECRET=your-ebay-cert-id
```

Create or edit it with `nano .env.local` (save: Ctrl+O, Enter; exit: Ctrl+X). Restart `npm run dev` after any change.
Database tables are created by pasting `supabase/schema.sql` into Supabase → SQL Editor → Run.

---

## Run it on your MacBook (first time)

### 1. Install the tools (one-off)

1. **Node.js 20 LTS or newer** – download the macOS installer from <https://nodejs.org> and run it.
2. Open **Terminal** (⌘ + Space → type "Terminal").
3. Check it worked:
   ```bash
   node -v    # should print v20.x or higher
   npm -v
   ```
4. (Recommended) Install **VS Code** from <https://code.visualstudio.com> to view and edit the code.

### 2. Put the project on your Mac

1. Download `cardscout-ai.zip` and double-click it to unzip.
2. Move the `cardscout-ai` folder somewhere sensible, e.g. `~/Projects/cardscout-ai`.
3. In Terminal:
   ```bash
   cd ~/Projects/cardscout-ai
   ```

### 3. Install and test

```bash
npm install        # downloads Next.js, React, Tailwind (takes 1–2 minutes)
npm test           # runs 51 tests: maths, forms, login and eBay handling
npm run dev        # starts the app
```

Open <http://localhost:3000> in your browser.

To stop the app, click in Terminal and press **Ctrl + C**.

### 4. View it on your iPhone (same Wi-Fi)

1. Find your Mac's local IP: **System Settings → Wi-Fi → Details → IP address** (e.g. `192.168.1.20`).
2. Run `npm run dev -- -H 0.0.0.0`
3. On your iPhone open `http://192.168.1.20:3000`.
4. If the page loads without styling, add your IP to `allowedDevOrigins` in `next.config.ts` and restart.

### 5. Check a production build (optional)

```bash
npm run build
npm start
```

---

## How the project is organised

```
cardscout-ai/
├── src/
│   ├── app/                    ← one folder per page (Next.js App Router)
│   │   ├── layout.tsx          ← shared frame: sidebar/mobile nav, fonts
│   │   ├── globals.css         ← Tailwind + colour tokens (dark theme)
│   │   ├── page.tsx            ← Overview
│   │   ├── scanner/page.tsx    ← Automatic Scanner (status + saved searches)
│   │   ├── analyse/page.tsx    ← Manual Scanner (live profit calculator)
│   │   ├── deals/page.tsx      ← Top Deals (filter + sort)
│   │   ├── deals/[id]/page.tsx ← Full assessment for one card
│   │   ├── watchlist/page.tsx
│   │   ├── portfolio/page.tsx
│   │   ├── settings/page.tsx
│   │   └── not-found.tsx
│   ├── components/             ← reusable UI pieces
│   │   ├── Nav.tsx             ← sidebar (desktop) / tab strip (iPhone)
│   │   ├── DealsTable.tsx      ← table on desktop, cards on mobile
│   │   ├── ProfitCalculator.tsx
│   │   ├── CardThumb.tsx       ← card image / placeholder
│   │   ├── Icons.tsx
│   │   └── ui.tsx              ← Money (USD + AUD), ScoreBadge, Panel, etc.
│   ├── lib/                    ← the "brain" – pure calculations, no UI, no data fetching
│   │   ├── types.ts            ← data shapes
│   │   ├── config.ts           ← YOUR SETTINGS: fees, FX rate, min ROI, demand tiers
│   │   ├── currency.ts         ← USD/AUD conversion & formatting
│   │   ├── profit.ts           ← net profit, ROI, max purchase price, opening offer
│   │   ├── valuation.ts        ← market value from sold comps + confidence
│   │   ├── scoring.ts          ← 100-point score
│   │   ├── analysis.ts         ← combines the above into one assessment
│   │   └── rows.ts
│   └── data/                   ← where data comes from
│       ├── source.ts           ← the ONLY place pages get data from
│       └── demo.ts             ← ⚠ made-up demonstration data
├── tests/                      ← automated tests for the maths
├── .env.example                ← template for secret keys (later phases)
├── PROGRESS.md                 ← completed features & to-do list
└── package.json
```

**The key idea:** data *acquisition* (`src/data`) is separate from *valuation and scoring* (`src/lib`). In Phase 3 we swap `demo.ts` for real eBay and sold-price sources inside `source.ts`; the maths and pages stay the same.

## Changing your settings

Use the **Settings** page — changes are saved to your database and used everywhere.
Collector demand tiers are still edited in `src/lib/config.ts` (`DEMAND_TIERS`).

## The formulas

```
Total acquisition cost = Purchase price + Import GST + Shipping to you + Other costs
Net profit            = Expected resale − Marketplace fees − Shipping to buyer − Total acquisition cost
ROI                   = Net profit ÷ Total acquisition cost × 100
Expected resale       = Estimated market value × confidence haircut (high 100%, medium 95%, low 90%)
```

Market value = recency-weighted median of exact-match **sold** prices from the last 120 days, with outliers removed and Best Offer sales at half weight. With fewer than 3 usable sales the value is shown as **missing** and the card is **not scored**.

## Security

- Secret keys go in `.env.local` (never committed, never sent to the browser).
- Only variables starting with `NEXT_PUBLIC_` are visible in browser code — never put secrets in those.
