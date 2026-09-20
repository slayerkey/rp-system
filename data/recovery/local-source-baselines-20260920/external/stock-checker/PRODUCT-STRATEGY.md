# Stream Deck Finance Dashboard — Product Strategy & Build Plan

> Research-backed strategy for building the premium finance dashboard on the Elgato Stream Deck Marketplace.
> Date: 2026-06-29. Sources are listed at the bottom. Items I could not verify directly are flagged **[inferred]** or **[unverified]**.

---

## 0. A note on research confidence

The three competitor listings were fetched, but Elgato's Marketplace renders price, star rating, and reviews via JavaScript, so those fields did not come through static fetch. What I **could** verify per listing: developer, version, last-updated date, file size, OS/device support. Pricing norms, API terms, and trader behavior below are sourced from independent searches. Where a claim rests on inference rather than a fetched fact, it is marked.

**Before building, three things must be confirmed by a human visiting the pages logged-in:** (1) actual price of each competitor, (2) their star ratings + review text, (3) whether "Stocks" by exension is free. These change the opportunity score materially.

---

## 1. Executive Summary

The Stream Deck finance category is **shallow, fragmented, and visually weak**. The existing products each solve one slice (a ticker, a clock, a local tracker) and none deliver a cohesive, premium, glanceable *dashboard*. That is the gap.

The single biggest strategic decision is not features — it is **the data layer**. Real-time exchange data carries display-licensing fees and most free API tiers forbid commercial redistribution. The product that wins is the one that solves data legally and cheaply while *looking* like Bloomberg on a key.

**Recommendation: build it, but build it as "Bring-Your-Own-Key + optional hosted tier," priced as a one-time premium purchase ($11.99–$14.99).** The BYO-key model sidesteps the redistribution licensing trap that will otherwise either bankrupt the margins or get the plugin pulled. Crypto ships in the *same* plugin (crypto data is cheap and redistribution-friendly; splitting it is a mistake).

**Opportunity Score: 7 / 10** (see Section 4 for the math). Strong gap and willingness-to-pay; capped by data-licensing friction and a small absolute market (Stream Deck owners ∩ active market-watchers).

---

## 2. Market Validation

**Demand signals (verified):**
- Multiple independent stock-ticker plugins exist on the Marketplace and on GitHub (Simple Stock Ticker, Stonks, simple-stock-ticker, plus the three you named). When several developers independently build the same category for free, there is real demand — and no one has consolidated it into a paid premium product.
- Elgato actively merchandises a **Finance** category, meaning the storefront itself expects finance buyers.
- Elgato's maker terms pay **70%+ of each sale to the maker**, and paid plugins commonly sit at **$4–$10+** price points. A premium finance tool can credibly anchor above that band.

**Demand caveats:**
- Total addressable market = people who own a Stream Deck **and** watch markets during the day. That is a niche-within-a-niche. This is a "high willingness-to-pay, modest volume" product, not a mass hit. Model revenue accordingly (Section 11).

**Conclusion:** Validated as a real, monetizable niche with no dominant premium incumbent. Green light on demand; the risk is execution + data licensing, not whether anyone wants it.

---

## 3. Competitor Analysis

| Product | Maker | Verified facts | What it does well | Where it falls short |
|---|---|---|---|---|
| **Stocks** | exension | v1.2.1, updated **Aug 2024**, 14 MB, SD 4.1+, Mac+Win | Established, cross-platform, longest-lived | **Stale (no update in ~2 yrs)** [inferred abandonment risk]; no visible dashboard/portfolio positioning |
| **Stock Status** | derTom | v1, released **Jun 26 2026**, 20.7 MB, **Windows-only**, dial support, no profiles | Genuinely good feature set: dial-to-change-timeframe, line chart vs. matrix, 24h split-session chart, portfolio P/L, auto-shrink text, ISIN support, privacy-first/local | **Requires manual Node.js install** (huge onboarding wall — see reviews risk); **Windows only**; brand-new (v1, no track record); local Node process = setup friction + perceived bloat |
| **Trading Clocks** | FCAN | v1.0.3.1, updated **Apr 2026**, **467 KB**, Mac+Win, dial support | Tiny, focused, elegant: market-session clocks, 15+ exchanges, session color-coding, candle band timer | **Not a data product at all** — shows *time*, not prices. Complementary, not competitive. Proves appetite for "market awareness at a glance." |

**Synthesis of the field:**
- **No one owns "dashboard."** Each is a tool, not a command center.
- **Onboarding is a weak point** (Stock Status's Node.js requirement is a self-described wart it's already racing to fix).
- **Cross-platform + zero-setup** is unclaimed premium territory.
- **Visual polish is the universal soft spot** — these are functional, not beautiful. The brief's instinct is right: a true *premium typographic dashboard* has no incumbent.
- **Trading Clocks shows the "glanceable market state" instinct sells** — fold that capability in rather than compete with it.

---

## 4. Opportunity Score: 7 / 10

| Factor | Score (1–5) | Note |
|---|---|---|
| Market gap / differentiation | 5 | No premium dashboard exists |
| Willingness to pay | 4 | Traders pay for tools; one-time $12 is trivial to them |
| Daily usage / retention | 4 | Market-watchers glance constantly during sessions |
| Absolute market size | 2 | Stream Deck ∩ active traders is small |
| Build feasibility | 4 | SDK is mature; data licensing is the hard part |
| Defensibility / moat | 3 | Copyable features; moat is polish + brand + data-handling |
| **Weighted overall** | **~7/10** | Strong niche play, capped by TAM + licensing friction |

---

## 5. Target Audience

**Primary (build for these): the "active market-watcher" — day traders + swing traders.**
- Highest daily glance frequency → highest retention → best reviews.
- Already own multi-key/XL decks and dials; will use compact data-dense layouts.
- Willing to pay; price-insensitive at $12.
- They want: live price, % change, pre/after-hours, the indices (SPX/NDX/DJI/VIX), market open/close countdown, their few key tickers, and *fast* refresh.

**Secondary: crypto holders.** Cheap to serve (crypto data is redistribution-friendly and abundant), high emotional check-frequency, 24/7 usage smooths the "markets closed" dead time. Bundle them in.

**Tertiary / halo: finance creators & streamers.** They put the deck *on camera*. If it looks premium, it markets itself. Design the "Pro/On-Stream" theme for them — they are unpaid distribution.

**Explicitly NOT the primary target: pure long-term buy-and-hold investors.** They check monthly, churn, and won't value real-time. Serve them as a side benefit, don't design for them.

---

## 6. Product Positioning

**Name direction:** lead with "command center / dashboard," not "ticker."
- Top pick: **"Market Command Center"** or **"Ticker Pro — Market Command Center."**
- Alternatives: "Market Pulse," "Trading Desk," "Live Market Dashboard."
- Avoid "Stocks/Stock Status/Stock Ticker" — those names are taken and read as commodity utilities.

**One-line positioning:**
> *"Your trading desk, condensed onto your Stream Deck. Live prices, indices, crypto, and market timing — beautiful enough to put on stream, fast enough to trade by."*

**The wedge vs. each competitor:** cross-platform + zero-setup + genuinely premium visuals + stocks *and* crypto in one + market-timing built in (the Trading Clocks idea, absorbed).

---

## 7. Feature Priority Matrix

Tiers = build order. "Value" and "Effort" are relative.

### Tier 1 — MVP / table stakes (must ship at launch)
| Feature | Value | Effort | Notes |
|---|---|---|---|
| Live price + daily % + abs change per key | ★★★★★ | M | Color-coded green/red; auto-shrink text (match Stock Status) |
| Pre-market / after-hours display | ★★★★★ | M | Top trader request; differentiator vs. basic tickers |
| Major indices keys (SPX, NDX, DJI, VIX) | ★★★★★ | S | Cheap, high-glance value |
| Crypto in same plugin (BTC/ETH/SOL/custom) | ★★★★★ | M | Redistribution-friendly data; fills closed-market hours |
| Market open/close + countdown | ★★★★ | S | Absorbs the Trading Clocks value prop |
| Configurable refresh interval | ★★★★ | S | Also a rate-limit safety valve |
| BYO-API-key onboarding wizard | ★★★★★ | M | The legal + cost moat (Section 9) |
| Cross-platform (Mac + Windows), no Node.js | ★★★★★ | M | Beats Stock Status's biggest weakness |

### Tier 2 — premium differentiators (1–2 updates post-launch)
| Feature | Value | Effort |
|---|---|---|
| Mini sparkline on key (intraday) | ★★★★★ | M |
| Portfolio key: holdings → total value + P/L | ★★★★ | M |
| Dial support: twist=timeframe, press=cycle view | ★★★★ | M |
| Top movers / gainers / losers key | ★★★ | M |
| Price alerts (above/below, % move, 52w breakout) | ★★★★ | M |
| Themes (Dark, Minimal, "On-Stream Pro", color accents) | ★★★★ | S |
| Multi-page / watchlist profiles | ★★★ | M |

### Tier 3 — depth / power-user (later, demand-gated)
Earnings countdown • Fear & Greed Index • economic calendar (CPI/FOMC/jobs) • analyst ratings • 52w hi/lo, volume, mkt cap, P/E, dividend • Gold/Oil/Treasury yields/DXY/forex • RSI/MACD/VWAP overlays • news headlines.

**Deliberately deprioritized:** heavy technical indicators (RSI/MACD/VWAP) on a 72×72px key are mostly unreadable — glanceability beats completeness. Offer 1–2 as a sparkline annotation at most. This is the discipline most "kitchen-sink" competitors lack.

---

## 8. Crypto Decision

**Build crypto INTO the same plugin. One product.** Reasoning:
1. Crypto market data is abundant, cheap, and **redistribution-friendly** (CoinGecko/CoinMarketCap/CoinPaprika tiers) vs. equity data's exchange-display fees.
2. 24/7 crypto fills the dead hours when equities are closed → daily usage and retention go *up*.
3. Many target users hold both. Two products = double the friction, half the perceived value.
4. Marketing: "stocks **and** crypto, one beautiful dashboard" is a stronger listing than either alone.

Do **not** build wallet-connection / on-chain portfolio tracking at launch (security surface + scope creep). Watchlist + manual-holdings P/L is enough.

---

## 9. API Recommendation & the Licensing Reality

**This is the make-or-break section.**

**The trap:** Real-time US equity quotes are exchange-licensed. Most free API tiers (e.g., Finnhub free) **explicitly forbid commercial use / redistribution**. If you ship a *paid* plugin that pipes real-time quotes from your own central key to thousands of buyers, you are redistributing licensed data to end users — that requires a (often expensive) display license and will otherwise get the plugin pulled or you fined.

**The escape hatch — Bring Your Own Key (BYO):**
- The **user** signs up for a free/cheap API key (Finnhub, Twelve Data, Alpaca, etc.) and pastes it into the plugin.
- The user becomes the licensee; the plugin is just a client. This is exactly the legal posture of "display to the licensee's own authenticated use," and it's how local/open-source tickers stay clean.
- Bonus: it pushes rate-limit and data-cost burden onto each user's own free tier — your hosting cost is ~zero.
- Cost of BYO: onboarding friction. **Solve it with a great wizard** (one-click "Get a free key" deep links, paste-and-validate, clear copy). This is *less* friction than Stock Status's "install Node.js."

**Recommended data architecture (hybrid):**
1. **Equities/ETFs/indices:** BYO-key. Default provider **Twelve Data** (stocks+forex+crypto+indices in one API, generous free tier ~800 req/day) or **Finnhub** (60 req/min free, good fundamentals). Support 2–3 providers so users aren't locked to one rate limit.
2. **Crypto:** ship a **bundled default key** to a redistribution-friendly source (CoinGecko/CoinMarketCap free tier) so crypto works *out of the box* with zero setup — the instant-gratification moment. Allow BYO override for heavy users.
3. **Market hours / countdown:** computed locally from exchange calendars (no API needed). Zero cost, zero latency — same approach Trading Clocks uses (467 KB total).
4. **Optional future "Pro hosted" tier:** if you later want true zero-setup equities, license proper *derived/display* data (Databento has derived-use redistribution licenses; or a delayed-data feed which is far cheaper to license) and offer it as a subscription add-on. Don't gate launch on it.

**Provider summary (verified free-tier facts):**
- **Twelve Data** — stocks/forex/crypto/indices unified; ~800 req/day free. Best single default.
- **Finnhub** — 60 req/min free, strong fundamentals; **free tier = non-commercial** → BYO only.
- **Alpaca** — 5 req/s, no hard daily cap, US-equity-focused, commercial-friendly.
- **Alpha Vantage** — only ~25 req/day free + 15-min delay → fallback only.
- **CoinGecko / CoinMarketCap** — crypto, redistribution-friendly tiers → default crypto source.
- **Databento** — derived-use redistribution license available → the path if you ever go hosted.

**Always:** cache aggressively, honor each provider's attribution/branding requirements in an "About data" screen, and prefer delayed/derived data wherever real-time isn't essential to avoid display-license triggers.

---

## 10. Architecture Plan

**Stack:** Official **Elgato Stream Deck SDK (Node.js/TypeScript)** with the **SDPI** components for the property inspector. Target SDK 6.5+ for dial/Stream Deck+ support; keep a graceful path for non-dial decks.

```
streamdeck-market-command-center/
├─ plugin/
│  ├─ actions/            # ticker, index, crypto, portfolio, market-clock, movers, alert
│  ├─ rendering/          # canvas key renderer: typography, sparklines, auto-shrink, themes
│  ├─ data/
│  │   ├─ providers/      # twelvedata.ts, finnhub.ts, alpaca.ts, coingecko.ts  (common interface)
│  │   ├─ cache.ts        # TTL cache + request coalescing (one fetch feeds many keys)
│  │   └─ scheduler.ts    # central poll loop, rate-limit aware, backoff
│  ├─ market/             # exchange calendars, session state, countdowns (local, no API)
│  ├─ alerts/             # threshold engine + notifications
│  └─ settings/           # key store (OS keychain), watchlists, themes, profiles
└─ pi/                    # property inspector: BYO-key wizard, per-key config
```

**Key architectural principles:**
- **One poller, many keys.** Coalesce requests so 12 keys watching AAPL/SPX/BTC = a handful of API calls, not 12. This is what keeps users inside free rate limits and is the single most important engineering decision for the BYO model.
- **Provider abstraction** behind a common `Quote`/`Candle` interface so adding/swapping providers is trivial and users can pick their own.
- **Local-first rendering** — all drawing on-device (canvas), no servers, "privacy-first" as a selling point (match Stock Status's privacy angle).
- **Secrets in OS keychain**, never plaintext config.
- **Graceful degradation:** stale-data badge, rate-limit-hit indicator, offline state — never a blank key.

---

## 11. Pricing Recommendation

- **One-time premium purchase, no free version** (per the brief). Recommended **launch price $11.99**, settling to **$12.99–$14.99** as features land.
- Rationale: paid plugins commonly sit $4–$10; pricing *above* the pack signals premium and is still a rounding error for the target trader. Maker keeps **70%+**.
- **Launch tactic:** introductory **20% off for the first 2–4 weeks** (Elgato runs promo codes regularly; align with one) to seed reviews — reviews are the real growth engine.
- **Avoid subscriptions at launch.** The audience resents recurring fees for a utility, and you have no recurring server cost under the BYO model. Reserve a subscription *only* for a future hosted real-time data tier, clearly optional.
- **Do not ship a free tier.** A time-limited trial is unnecessary friction on a $12 product; rely on a strong listing + demo video instead.

---

## 12. UX / Layout Concepts (glanceable < 1 second)

Design law: **one primary number per key, readable in under a second.** Color does the talking.

- **Single key (ticker):** Big % change (color-coded), ticker symbol small-cap above, price small below, optional 1px sparkline strip at bottom. Auto-shrink for long values.
- **Single key (index/crypto):** same template, distinct accent color per asset class.
- **Market clock key:** session label + countdown, color = session (pre / open / after / closed) — the Trading Clocks pattern.
- **2-key combo:** price+chart on left, % + sparkline on right for one asset = a mini chart pair.
- **4-key cluster:** SPX / NDX / DJI / VIX as a "market snapshot" block — the signature glanceable layout.
- **XL / multi-key:** full watchlist grid; one row = stocks, one row = crypto, one key = portfolio total P/L, one key = market clock.
- **Dial (Stream Deck+):** twist = change timeframe (2D→1Y), press = cycle line-chart ↔ stats matrix (parity with Stock Status, done better).
- **Modes:** Minimal (number only) / Standard (number + label + spark) / Pro-On-Stream (high-contrast, bold type for camera).

Typography is the moat: a custom tabular-figure font, tasteful weight, true green/red that reads on camera. This is where "worth paying for" is felt instantly.

---

## 13. Customization Plan (useful, not bloated)

Ship: theme presets (Dark / Minimal / Pro-On-Stream) • accent color per asset/class • toggle ticker name / chart / sparkline • % vs. absolute change • daily vs. total return • refresh interval • 12/24h + timezone for clocks • watchlists & multi-page profiles • compact-number formatting (1.2M).

Skip / resist: fully custom fonts, per-pixel layout editors, animation-heavy effects, unlimited theming. These add support burden and decision fatigue. Curated presets > infinite knobs. (This restraint is itself a differentiator — competitors tend to over-expose options.)

---

## 14. Alerts (value-ranked)

Ship at Tier 2: **price above/below target**, **% daily move threshold**, **52-week breakout**, **market open/close** reminder. These are the ones traders actually act on. Defer: volume spikes, news alerts, portfolio-milestone confetti (nice, low utility). Deliver via Stream Deck key state change (flash/color) + optional OS notification. Alerts run off the same cached poll loop — no extra data cost.

---

## 15. Marketing Positioning & Listing Strategy

- **Hero line:** "Your trading desk on your Stream Deck." Lead the listing with a 10-second **video** of live numbers ticking + a dial twisting (Elgato listings with motion convert best).
- **First three bullets must hit the wedges:** (1) Stocks + Crypto in one beautiful dashboard, (2) Works on Mac & Windows with **zero setup** (no Node.js), (3) Pre-market / after-hours + live indices at a glance.
- **Screenshots:** the 4-key index snapshot, a sparkline ticker, the dial chart, the On-Stream Pro theme on a real deck.
- **Seed reviews:** launch discount + outreach to r/StreamDeck, r/Daytrading, finance YouTubers/streamers (give them free keys — they're distribution).
- **Differentiator copy:** explicitly contrast "no Node.js, no terminal, no setup" (the Stock Status pain) and "looks good on camera" (creator hook).
- **Use the marketplace-art skill** in this workspace to generate the listing image + video assets.

---

## 16. Development Roadmap

**M1 — Foundations (data + one key).** SDK scaffold, provider abstraction, central cached poller, BYO-key wizard, single live-price key with auto-shrink + color. → *Verify: AAPL/SPX/BTC update live within free rate limits on Mac + Win.*

**M2 — Core dashboard (MVP launch).** Index keys, crypto (bundled default key), market-hours/countdown, refresh config, 3 themes, listing assets. → *Verify: 12-key dashboard runs a full session without hitting rate limits; cold-install to first number < 60s with zero external installs.*

**M3 — Premium layer.** Sparklines, portfolio P/L, dial support, top movers, alerts. → *Verify: dial cycles timeframes; alert fires on threshold; sparkline renders intraday.*

**M4 — Depth + polish.** Earnings/Fear&Greed/economic calendar/commodities/yields, multi-page profiles, optional hosted real-time tier evaluation. → *Verify: power-user XL profile; decide go/no-go on hosted data licensing.*

---

## 17. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| **Data redistribution licensing** (paid plugin redistributing real-time quotes) | **High** | BYO-key model; delayed/derived data; honor attribution; hosted tier only with proper derived-use license |
| API free-tier rate limits frustrate users | High | Central coalesced poller, aggressive cache, configurable refresh, multi-provider choice |
| Small absolute TAM (Stream Deck ∩ traders) | Med | Price premium to compensate volume; bundle crypto to widen base |
| Provider changes terms / shuts free tier | Med | Provider abstraction → swap without re-architecting; support 3+ |
| Onboarding friction from BYO-key | Med | Excellent wizard, deep links, bundled crypto for instant first-run value |
| Incumbent (esp. Stock Status) closes the gap | Med | Move fast on cross-platform + polish + crypto; those are real moats |
| Marketplace review/approval rejection | Low-Med | Follow Elgato guidelines; no bundled licensed data without rights |
| Display accuracy/lag → trader complaints | Med | Clear "delayed/real-time" + timestamp badge; never imply execution-grade |

---

## 18. Reasons NOT to build this
- Absolute market is small; this won't be a top-grossing plugin in raw units.
- Data licensing is genuinely thorny; one wrong move (redistributing real-time quotes) risks takedown.
- Features are copyable; a funded incumbent could match them.
- Ongoing maintenance burden: APIs break, exchange calendars change, OS/SDK updates.
- "Premium feel" is hard and subjective — if the visuals aren't truly excellent, there's no moat at all.

## 19. Reasons TO build this
- Clear, unclaimed **"premium dashboard"** position — every competitor is a single-purpose utility.
- High willingness-to-pay audience; $12 one-time is frictionless for traders.
- High daily-glance usage → strong retention and word-of-mouth.
- BYO-key + bundled crypto solves the cost/licensing problem that scares off competitors → near-zero marginal cost.
- Cross-platform + zero-setup beats the most-used competitor's biggest weakness on day one.
- Creator/streamer halo = free distribution if it looks good on camera.
- You can absorb the entire field's good ideas (Stock Status's dial/charts, Trading Clocks' sessions) into one product.

---

## 20. The Defining Answer

> **"If you wanted to create the highest-quality finance plugin on the Stream Deck Marketplace, what would you build differently from every competitor?"**

Three things, in order:

1. **I'd treat it as a *design* product, not a data product.** Every competitor competes on "what numbers can I show." I'd compete on "how fast can a human read this number, and does it look good enough to leave on camera." Custom tabular typography, true-to-camera color, one primary number per key, ruthless restraint on clutter, curated themes over infinite knobs. The moat is glanceability and beauty — the two things money in this category has never actually bought.

2. **I'd solve the data problem with Bring-Your-Own-Key + bundled crypto, and say so loudly.** Competitors either quietly redistribute data they may not be licensed for (takedown risk) or make users install Node.js (onboarding death). I'd make the user the licensee — clean, legal, zero hosting cost — while crypto works instantly out of the box for the first-run "wow." Then market the *absence* of friction ("no Node.js, no terminal, works on Mac and Windows") as a headline feature.

3. **I'd ship the whole trading-awareness surface in one cohesive command center** — stocks + crypto + indices + market-session timing — instead of three separate single-purpose tools. Absorb the best idea from each competitor (Stock Status's dial-driven charts, Trading Clocks' color-coded sessions) into one product that feels like a *desk*, not a widget. The category has tickers and clocks; nobody has built the dashboard. That's the product.

---

## Sources
- [Stocks — Elgato Marketplace](https://marketplace.elgato.com/product/stocks-48907651-231b-4981-917e-db58885a64f8)
- [Stock Status — Elgato Marketplace](https://marketplace.elgato.com/product/stock-status-a7167b48-010b-40f7-b42c-0c09e243cb7e)
- [Trading Clocks — Elgato Marketplace](https://marketplace.elgato.com/product/trading-clocks-db6b7ee3-2792-471f-83aa-0dbe8ac95c91)
- [Simple Stock Ticker — Elgato Marketplace](https://marketplace.elgato.com/product/simple-stock-ticker-d39a8ba7-8c15-454a-8448-85afc0e1438e)
- [Elgato Marketplace — Stream Deck plugins overview (Videoguys)](https://videoguys.com/blogs/news-and-sales/elgato-marketplace-how-stream-deck-plugins-work-and-what-you-can-download)
- [Best Free Stock Market APIs 2026 (DEV)](https://dev.to/nexgendata/best-free-stock-market-apis-and-data-tools-in-2026-a-developers-honest-comparison-1926)
- [Stock API Free comparison 2026 (Qveris)](https://qveris.ai/guides/stock-api-free-comparison/)
- [Finnhub](https://finnhub.io/) · [Twelve Data](https://twelvedata.com/) · [Databento equities](https://databento.com/equities)
- [Best Free Crypto API 2026 (CoinMarketCap)](https://coinmarketcap.com/academy/article/best-free-crypto-api-in-2026-free-tier-comparison)
- [Stock Market Data Licensing: display prices legally (marketdata.app)](https://www.marketdata.app/education/stocks/stock-market-data-licensing/)
- [Trading Data API License: redistribution (terms.law)](https://terms.law/Trading-Legal/guides/api-license-trading-data.html)
- [Nasdaq Data License terms](https://data.nasdaq.com/terms)
