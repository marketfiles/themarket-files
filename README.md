# Market Files — production website

**Markets • Money • History.** Live markets, futures, a holographic world globe of financial history,
the Market Time Machine (every date in market history), and Market Files AI research powered by Claude.
Free to read.

---

## The $0 launch

Everything below is free. You get a live site at `https://<project-name>.vercel.app`.

| Piece | Free option |
|---|---|
| Hosting | Vercel free plan (check its terms — the free plan is for personal/non-commercial use; move to Pro when Market Files earns money) |
| Code | GitHub free |
| Research box | **Google Programmable Search** (free, shows Google ads) — or plain Google links with no setup |
| Futures | **TradingView widgets** — prices, line charts and a link to the full TradingView chart for every contract; TradingView handles the data licensing |
| Stocks, yields, FX, crypto | Finnhub, FRED, Frankfurter, CoinGecko free tiers |
| Database | Supabase free tier (optional — the site runs on built-in content without it) |
| Newsletter | Beehiiv free tier (optional) |

**Steps**
1. Unzip, create a GitHub repository, and upload the contents of the `mf` folder.
2. Sign in to Vercel with GitHub → Add New → Project → pick the repository → Deploy. You now have a live URL.
3. (Free, 5 minutes) Get keys and add them in Vercel → Settings → Environment Variables, then Redeploy:
   - `FINNHUB_API_KEY` and `FRED_API_KEY` (free sign-ups) with `MARKET_DATA=live`
   - `GOOGLE_CSE_ID`: at programmablesearchengine.google.com create a search engine, turn on "Search the entire web", copy the Search engine ID
   - `SITE_URL` = your Vercel address
4. Optional later: Supabase (`DATABASE_URL`, then `npm run db:migrate` and `npm run db:seed`), Beehiiv, your own domain (~$10–20/yr),
   and `ANTHROPIC_API_KEY` if you ever want Market Files AI (Claude) instead of Google — it switches automatically.

---

## What's in this project

| Area | How it works |
|---|---|
| **Homepage experience** (`/`) | The approved design: globe hero, Markets Now terminal, futures, crypto, desks, archive, Time Machine, Crash Lab, newsstand, search. Served from `public/experience/market-files.js`, generated from the approved preview by `tools/build_experience.py`. |
| **Market Files Library** | `/#/library` — long-run history pages for any topic (gold, the Dow, bitcoin, oil, Treasury yields, the fed funds rate, inflation, or anything typed in), with benchmark milestones, the latest board value, every related Market Files record, and Deep Research prompts. With `FRED_API_KEY`, rates and inflation pages draw real annual data from `/api/series`. |
| **Blog** | `/blog` (indexable) and `/#/blog` (interactive, filter by desk). |
| **X accounts menu** | The X button in the top bar lists all six accounts. Put each profile photo in `public/pfp/` named by handle (e.g. `NowOnBTC.jpg`) and it appears automatically. |
| **Indexable pages** | Server-rendered for Google: `/files` (archive), `/files/[slug]` (every article, with Article schema), `/day/[date]` (every day file), plus `sitemap.xml` and `robots.txt`. |
| **Live market data** (`/api/quotes`) | Server-side providers, cached and shared by all visitors. API keys never reach the browser. |
| **Market Files AI** (`/api/ai`) | Claude via the Anthropic API, streaming, with **Quick** and **Deep research** modes (Deep uses `ANTHROPIC_MODEL_DEEP` and more web searches). Tools: Market Files archive search, date lookup, live board quotes, optional web search for current events. Rate-limited per visitor. |
| **Database** (`/api/tm`) | Postgres table of Market Time Machine events. Without a database the site serves the built-in content read-only. |
| **Editor** (`/admin`) | Password sign-in for the Market Files team. Unlocks the ✦ Editor button to add, edit and verify Time Machine events. |
| **Newsletter** (`/api/newsletter`) | The Daily File signups go to Beehiiv (or the database if Beehiiv isn't set up yet). |

## Market data sources

| Board section | Default source | Notes |
|---|---|---|
| U.S. indexes, sectors, world markets, commodities, dollar | **Finnhub** (free key) | Real-time index levels need paid index licenses, so tiles track the matching ETF and say so on the tile, e.g. "S&P 500 · SPY". Change any mapping in `lib/market/symbols.ts`. |
| Treasury yields | **FRED** (free key) | Daily. Foreign 10-year yields from FRED are monthly and labeled that way. |
| Currencies | **Frankfurter** (ECB reference rates, free) | Daily reference rates. |
| Crypto | **CoinGecko** (free; optional demo key) | Price, 24-hour change and market cap. |
| **Futures** (CME, CBOT, NYMEX, COMEX, ICE, Cboe) | **TradingView widgets** (free) | Tabs by sector with prices, % change and line charts; click any contract for its own chart; "Open in TradingView" links everywhere. Optional: your own licensed feed via `FUTURES_FEED_URL`. |

Anything without a live source shows **—**. The site never mixes demo numbers into live data.
Set `MARKET_DATA=simulated` to run the demo board locally without keys.

### Futures data
Exchange futures prices (CME Group, ICE, Cboe) require a data license to display publicly, including delayed data.
Typical routes: **Databento**, **Barchart OnDemand**, or **CME Group's own market-data licensing**. Once licensed, run a
small job that writes the latest front-month prices to a JSON endpoint and set `FUTURES_FEED_URL` (format documented in
`lib/market/quotes.ts`). The futures section, futures page, overnight signal, globe (CME Chicago) and Market Files AI all
pick it up automatically. TradingView links on every contract work immediately.

---

## Launch checklist (about an hour)

1. **Accounts** — GitHub, [Vercel](https://vercel.com), [Supabase](https://supabase.com) (or Neon),
   [Anthropic Console](https://console.anthropic.com) (Claude API key), [Finnhub](https://finnhub.io),
   [FRED](https://fred.stlouisfed.org/docs/api/api_key.html), [Beehiiv](https://beehiiv.com), and your domain.
2. **Database** — create a Supabase project, copy its connection string into `DATABASE_URL`, then run:
   ```bash
   npm install
   npm run db:migrate   # creates tables
   npm run db:seed      # loads the Market Time Machine inventory
   ```
3. **Deploy** — push this folder to GitHub, import it in Vercel, and add every variable from `.env.example`
   (Project → Settings → Environment Variables). Set `SITE_URL` to your domain and `MARKET_DATA=live`.
4. **Domain** — add it in Vercel → Domains and follow the DNS instructions.
5. **Editor** — set `ADMIN_PASSWORD` and a long random `ADMIN_SECRET`, visit `/admin`, sign in, and the ✦ Editor button appears.
6. **Search engines** — submit `https://YOUR-DOMAIN/sitemap.xml` in Google Search Console.

Local development:
```bash
cp .env.example .env.local   # fill in what you have
npm install
npm run dev                  # http://localhost:3000
```

## Costs to plan for
- **Claude API** — billed per token (and per web search if `AI_WEB_SEARCH=true`). Control spend with `AI_RATE_LIMIT`,
  the model settings, and a monthly spend limit in the Anthropic Console. Current prices: docs.claude.com → Pricing.
- **Market data** — Finnhub, FRED, Frankfurter and CoinGecko have free tiers; futures and real-time index levels are paid.
- **Hosting/database** — Vercel and Supabase both have free tiers that fit launch traffic.

## Updating the design
The approved preview is the design source. After changing it:
```bash
python3 tools/build_experience.py path/to/market-files.html
```
This regenerates the experience script, styles and page shell, applying the production swaps (live data, API-backed AI,
database and newsletter). Commit and push; Vercel redeploys.

## Before launch — editorial
- The 220 Time Machine events and 24 articles are marked **In review**. Verify each against primary sources, then mark
  them Verified in the editor.
- Replace illustrative image placeholders with licensed or public-domain archival images.
- Have a lawyer review the privacy policy, terms and financial disclaimer; add data-provider attributions they require.

## Notes
- Multi-instance hosting: the AI rate limiter is per server instance; for strict limits use a shared store (e.g. Upstash Redis) in `lib/ratelimit.ts`.
- The Claude model names live in environment variables, so upgrading models needs no code change.
- This build was prepared without network access, so it has not been through `npm install`/`next build` yet.
  Run `npm run build` once locally or on Vercel; if TypeScript flags anything, it will be small and local.
