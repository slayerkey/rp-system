# Epic Pen — Validation

Run 2026-08-12. Data age 4 days (no refresh needed).

Covers both SKUs in the line: `epic-pen` (free) and `epic-pen-pro` ($7.99). Same market, same score.

## Score

| Component | Score | Why |
|---|---|---|
| Demand (0-30) | 5.0 | best query 'anno' popularity 11 = p16 of all tracked queries. No 'epic pen' query exists at any volume. This is the binding constraint on the whole product. |
| Competition gap (0-25) | 25 | 0 competing products. The entire screen-annotation category is empty across Profiles, Icons and Plugins — not weakly served, absent. |
| Monetization (0-20) | 6 | no comps anywhere in the niche, so the tool defaults mid-low. Adjacent PowerPoint comps ($9.99/22dl, $34.99/123dl) show the price band is tolerated, but those ride real search volume this idea does not have. |
| **Deterministic subtotal** | **36.0 / 75** | |
| Build fit (0-15) | 14 | Every action maps to an existing builder in `profiles/_build/common.py` (`hotkey_action`, `hotkey_switch_action`, `dial_action`, `folder_action`, `open_action`). All 30 planned icons confirmed present in `assets/tabler-icons.css`. `RequiredPlugins` is stock Elgato only, so setup is zero-install. **−1**: `PRINTSCREEN` was absent from `VK`/`_QT_SPECIAL` and had to be added for the screenshot key (two additive lines, done 2026-08-12). |
| Risk (0-10) | 7 | No game, no anti-cheat, no third-party artwork, no logo on cover. Nominative name use only, the same posture already accepted for Blackmagic in `docs/DECISIONS.md`. **−3** for three real exposures, listed below. |
| **Qualitative subtotal** | **21 / 25** | |
| **TOTAL** | **57 / 100** | **LEAN-GO** |

### The three risk deductions

1. **Hotkeys are per-install defaults, not constants.** Epic Pen lets the user rebind everything in Settings > Hot keys, and has already reworked its hotkey system once (v3.9.95). A buyer who changed theirs gets a dead profile. Mitigated by leading `INSTALL.md` with the full binding table and a verify step.
2. **8 of 26 actions require an Epic Pen Pro subscription** (about €24/yr). Stated up front in the listing or it is a refund magnet.
3. **Total vendor dependency on a small studio with no API, no SDK and no plugin surface.** Epic Pen's only command-line arguments are installer flags (`/ac=`, `/silent`, `/proxyHost=`); there is no runtime CLI. A hotkey change in any future version breaks the product.

## Why this cannot be flipped to GO

Demand is a market fact, not a build decision. There is no version of this product that scores above about 60. Owner accepted it on 2026-08-12 as a deliberate land-grab: one day of build cost, permanent ownership of a term nobody else has claimed, and a tool the owner personally uses. Do not spend premium-product effort here.

## Also researched

- **Functionality is verified, not inferred.** Epic Pen publishes no default hotkey list anywhere — not in the User Guide, the FAQ, or the version history. The complete binding table was read from the owner's live install at `%APPDATA%\Epic Pen\settings.json` (v3.12.172, licence `null`, free tier). 26 actions, all `Ctrl+Shift` or `Alt+Shift`, all registered by Epic Pen as **global** Windows hotkeys so they fire regardless of window focus.
- **What cannot be automated, and is therefore not shipped:** Redo (no redo hotkey exists in Epic Pen at all), named colours (the 6 hotkeys select palette *slots*, not colours), colours 7-24, highlighted cursor as a direct toggle, absolute stroke size, fading-ink duration, screenshot destination, and any CLI or API control.
- **A plugin product is impossible.** Epic Pen has no SDK, no API and no integration surface. Hotkeys are the only mechanism.
- **The audience exists, it has just never been sold an annotation tool.** SideshowFX's free Zoom profile has 48,633 downloads; Elgato's free PowerPoint plugin has 79,104; ProPresenter 14,246. The presenting/teaching population on Stream Deck is large.
- **Alternative targets scored for comparison** (deterministic half only): Clip Studio Paint 67.3, OBS 65.5, PowerPoint 63.8, Figma 54.2, Teams 49.5, Canva 45.2, Zoom 40.2, Epic Pen 36.0. Epic Pen loses on demand and only on demand. `clip-studio-paint` was queued to `registry.json` as `status: idea` on the strength of this.
- **Free alternatives outside the marketplace:** ZoomIt (free, Microsoft, but most of its keys are *modal* — consumed locally once in draw mode, so far fewer are Stream Deck addressable), gInk and ppInk (free, open source, tiny user bases). None has a Stream Deck product either.
- **Epic Pen Mac exists** with claimed feature parity since 2022, but its default modifier is unverified. `mac_variant()` would silently emit wrong keycodes on every button if Mac uses Ctrl rather than Cmd, so Mac is out until someone can read a Mac install's hotkey panel.

## Verdict: LEAN-GO

Ship it as a fast, cheap, honest pair of products. Do not expect volume.

## Recommended listing

- **Names:** "Epic Pen Profile" (16 chars, free) and "Epic Pen Pro Profile" (20 chars, $7.99)
- **Price:** $7.99 for the Pro tier. Floor of the house $8-18 band. There is nothing to anchor a premium ask against, and no search traffic to convert.
- **Structure:** free tier + paid tier, split along **Epic Pen's own free/Pro feature line**. The paywall never needs justifying because it maps to a boundary the buyer already understands. Same funnel pattern as `davinci-resolve-lite` / `davinci-resolve-pro`. Free is the discovery mechanism: every paid Packrat profile currently sits at 0-1 downloads while the free Discord profile has 121 and the free Better Hotkeys plugin has 272.
- **Icons:** bundled in both, **not** sold separately. Existing Packrat icon packs run 0-36 downloads and a 30-icon app-specific set has no standalone search demand.
- **Device SKUs:** std_win, xl_win, plus_win, vsd_win (both tiers). Plus carries one genuine dial, stroke size; colour and tool cycling are impossible because Epic Pen has no cycle hotkey, and dial press is already recorded as non-functional with the stock hotkey action.
- **OS:** Windows only. See the Mac note above.
- **Top keywords:** epic pen, epic pen profile, screen annotation, annotate screen, teaching stream deck
- **Risk flags:** none on the free tier. `hardware-unverified:pro-tools-untested` on the paid tier.

## Registry

`epic-pen: status validated, price_usd 0`
`epic-pen-pro: status validated, price_usd 7.99`
