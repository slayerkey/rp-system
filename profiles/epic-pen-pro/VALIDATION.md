# Epic Pen Pro — Validation

Run 2026-08-12. Data age 4 days.

The market analysis for this product is identical to its free tier and is not duplicated here. **See `profiles/epic-pen/VALIDATION.md`** for the score table (57/100, LEAN-GO), the competitor research, the alternative-target comparison, and the full list of what Epic Pen can and cannot be made to do.

This file records only what is specific to the paid SKU.

## What the paid tier adds

Eight actions, all of which require an **Epic Pen Pro subscription** in Epic Pen itself:

| Action | Hotkey |
|---|---|
| Line | `Ctrl+Shift+L` |
| Arrow | `Ctrl+Shift+A` |
| Rectangle | `Ctrl+Shift+R` |
| Ellipse | `Ctrl+Shift+E` |
| Text | `Ctrl+Shift+T` |
| Whiteboard | `Ctrl+Shift+W` |
| Blackboard | `Ctrl+Shift+B` |
| Fading ink | `Ctrl+Shift+F` |

Plus the structural upgrades: a Shapes page, a Boards page, a Launch Epic Pen key, and on Stream Deck + the stroke-size dial.

## Why the paywall sits here

The split is **Epic Pen's own free/Pro line**, not an arbitrary one. Everything in the free profile works on free Epic Pen; everything added here needs Epic Pen Pro. That makes the paid tier self-explaining and means no buyer is ever paying for something they cannot use without noticing first.

## Price: $7.99

Not $29.99. `davinci-resolve-pro` earns its price from SideshowFX comps at 176-2021 downloads. This niche has **zero comps and zero search volume**, so nothing supports a premium ask. $7.99 is the floor of the house $8-18 band and an impulse buy for someone who already found the free profile useful.

**Price and name lock at submission.** Neither can be changed in Maker Console; both require emailing maker@elgato.com.

## Open risk: `hardware-unverified:pro-tools-untested`

**Owner-accepted 2026-08-12.** The owner's Epic Pen install is free tier with no trial used, so the eight Pro buttons above were **not confirmed firing**. Their bindings come from the same live `settings.json` as the eighteen verified free-tier buttons, so they are very likely correct — but "very likely" is the actual confidence level and it is recorded here rather than hidden.

**Three consequences carried into the build:**

1. **Whiteboard, Blackboard and Fading Ink ship as plain `hotkey_action`, not `hotkey_switch_action`.** Epic Pen describes them as toggles, but without a Pro licence there is no way to confirm the same key turns them back off. A two-state key face would assert on/off behaviour that was never verified, so the deck stays silent about state instead of guessing. Draw and Toolbar *are* two-state, because they are free tier and were tested.
2. **The listing description must state the Epic Pen Pro requirement inside the first 250 characters.** Burying it is the fastest route to refunds and one-star reviews.
3. **If a Pro licence is ever activated**, verifying the eight buttons and promoting the three board/fade keys to two-state toggles is a clean v1.1.

## House rule 8

The word "free" must not appear anywhere in this listing, including any reference to the free tier. Cross-sell copy has to reach for other phrasing.

## Registry

`status: validated, price_usd 7.99, risk_flags: ["hardware-unverified:pro-tools-untested"]`
