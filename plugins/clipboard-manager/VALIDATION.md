# Validation: Clipboard Manager

Idea: Stream Deck plugin exposing recent clipboard history as tappable keys. Free "Lite" tier shows
the last 4 copied items with tap-to-paste; paid Pro tier adds extended searchable history, pinned
snippets, image support, and Stream Deck+ dial scrolling. Follows the `better-hotkeys` /
`better-hotkeys-pro` free-anchor-to-paid-superset model.

Data freshness: `data_age_days: 6` (no `stale_warning`, no refresh needed).

## Score

| Component | Score | Why |
|---|---|---|
| Demand (0-30) | 26.6 | Best match `clipboard` = popularity 47 (p88 of tracked queries), 53 total hits, dominant category Plugins. Verified the match is genuine, not loose substring noise — `clipboard` and `clipboard manager` (popularity 11) both mean exactly this idea. Tighter term is low-volume, so buyers search the generic word. |
| Competition gap (0-25) | 23.3 | Only 3 competing products, none entrenched, no premium org present. Hand-verified: [Clipboard slot](https://marketplace.elgato.com/product/clipboard-slot-d8adc7ee-b73d-4214-92e1-e2ea33fe2173) (Commit-La-Grenouille, free, 2,052 dl, last published 2023-11 — **stale ~2.75 years**), Mac Clipboard Manager (Schwab Music, free, 354 dl, Mac-only), Quick Clipboard (Teddy, $19.99, **12 dl**). Nobody offers a free-to-paid pair. |
| Monetization (0-20) | 9.1 | Median paid comp $19.99 x 12 downloads; 33% of comps are paid. Score is low because the single paid comp barely sold — but read the evidence: that is a *pricing* failure ($19.99 for a clipboard tool in a marketplace where Pro tiers clear at $4.99-9.99), not proof of absent willingness to pay. Treated as a correctable comp, not a ceiling. |
| **Deterministic subtotal (0-75)** | **59.0** | From `tools/opportunity.py` |
| Build fit (0-15) | 9 | Genuine plugin build, no config-only path. Strong reuse: the `better-hotkeys` scaffold (`@elgato/streamdeck` TS plugin, win32/darwin native split via koffi, `@elgato/cli` packaging) and — critically — its **existing keystroke-injection code is exactly the paste mechanism** (send Ctrl/Cmd+V), so the hardest-looking part is already solved and shipping. `plugins/_shared`'s SVG key-badge renderer is directly reusable for drawing truncated text previews on keys. Tabler covers clipboard/pin/search glyphs. Deduct 5 for new native clipboard-watch logic on two platforms (Windows `AddClipboardFormatListener` via koffi; macOS has **no** change event so it must poll `NSPasteboard` — different code paths, not one abstraction). Deduct 1 for the Pro search/pinned Property Inspector being real new UI work. |
| Risk (0-10) | 6 | No game/app IP, no trademark exposure, no anti-cheat surface. Deduct 4 for: (a) **built-in feature overlap** — Stream Deck 6.9's Text action added a "Paste from Clipboard" mode, and built-in Text actions already cover *static* snippets for free, which materially weakens the planned Pro "pinned snippets" feature (see Also researched); (b) clipboard monitoring is precisely the behavior corporate DLP/endpoint-security tooling flags, a plausible support-ticket and AV-false-positive source; (c) free open-source alternatives exist off-marketplace ([quick-clips](https://github.com/glmorgan/quick-clips), [clipboard-buddy](https://github.com/Commit-La-Grenouille/streamdeck-clipboard-buddy)). |
| **Qualitative subtotal (0-25)** | **15** | |
| **TOTAL (0-100)** | **74** | |

## Verdict: **GO**

74 clears the 70 threshold. The case rests on a real, verified gap: demand sits at p88, the only free
incumbent has been stale since 2023, the only paid entrant is mispriced at $19.99 with 12 downloads,
and no one has shipped a credible free-to-paid pair. This is the closest structural analog to
`better-hotkeys` in the researched set — universal need, genuinely useful free tier, obvious Pro ceiling.

**Scope condition:** the Pro tier must not lean on "pinned snippets" as a headline feature, because
built-in Text actions already do static snippets for free. Pro's defensible value is *history* —
extended, searchable, image-capable, dial-scrollable. Lead with that.

## Also researched

- **Built-in feature overlap (the one finding that changes the spec):** Stream Deck 6.9 changed the
  Text action's default to "Paste from Clipboard" and added paste-mode selection. This does **not**
  kill the idea — the built-in action pastes *fixed, preconfigured* text, whereas this plugin surfaces
  a rolling history of what the user actually copied, which the built-in cannot do at all. But it does
  mean a "pinned static snippet" Pro feature would be re-selling a free built-in. Recommend demoting it.
- **Competitor complaints / gap confirmation:** the free incumbent is a *single-slot* save/paste tool
  with no history list; Clipboard Buddy explicitly does not persist across reboots or Stream Deck
  reloads. Persistence across restarts is therefore a real, cheap differentiator for even the Lite tier.
- **Paid-plugin platform requirement:** Marketplace DRM for paid plugins requires `@elgato/streamdeck`
  v2+, Node 24+, and Stream Deck 7.1+. Confirm `better-hotkeys-pro` is already on that path before
  scoping the Pro build; if it is, this is inherited, not new work.
- **macOS asymmetry:** no OS-level clipboard-change notification exists on macOS, so the Mac build is
  poll-based by necessity. Worth a battery/CPU sanity check, and a reason to consider Windows-first.
- No upcoming platform change found that would kill or boost this; not tied to any game patch cycle.

## Recommended listing

- **Lite name:** "Clipboard Manager" (17 chars, exact-search-term style, leads with the p88 `clipboard` query).
- **Pro name:** "Clipboard Manager Pro" (21 chars), matching the established `better-hotkeys-pro` convention.
- **Price:** Lite **free** (cross-sell anchor, same role `better-hotkeys` plays). Pro **$6.99**. Comp
  table: the $19.99 comp demonstrably failed at 12 downloads; the ecosystem's working Pro band is
  Kuberstar's $6.99 (Mac Monitor Pro) to $9.99 (Notion Deck Pro), and `better-hotkeys-pro` sits at
  $4.99. $6.99 sits mid-band and above the in-house floor, reflecting a broader feature set than
  Better Hotkeys Pro without repeating the $19.99 mistake.
- **Device SKU plan:** plugin, not a keymap profile — no std/xl variant split. Platform is the real
  axis: **Windows first**, macOS as a follow-on phase given the polling asymmetry above. Stream Deck+
  dial support is a Pro feature, not a separate SKU.
- **Top 5 keywords:** `clipboard`, `clipboard manager`, `clipboard history`, `copy paste`, `paste`.
- **Risk flags:** `compat-risk:dlp-av` (clipboard monitoring may trip corporate endpoint security /
  AV heuristics — disclose plainly in the description to pre-empt refunds), `overlap-risk:builtin-text`
  (built-in Text action covers static snippets; keep Pro positioned on history, not pinned snippets).

Next step: `/rat-build clipboard-manager` (Lite, Windows-first), with Pro scoped after Lite ships.
