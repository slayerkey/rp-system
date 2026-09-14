# PackRat Stream Deck Premium Theme — Candidate v1

Status: **candidate for global rollout after one final Rat Dev visual approval**.

This is the visual system currently prototyped in Window Manager Pro and informed by the darker, premium presentation used by Monitor Manager Pro. It is intentionally a visual-only contract. Applying it must not change plugin behavior, action UUIDs, settings semantics, release state, pricing, profiles, or marketplace identity.

## Visual goal

The PackRat Stream Deck UI should feel dark, premium, compact, and consistent:

- very dark charcoal app background
- slightly lighter dark cards/panels
- clean white primary text
- muted cool-gray secondary text
- bright cheddar orange-yellow accent
- subtle orange glow rather than brown/gold fills
- simple, geometric key art
- clear destructive red only for destructive actions
- real PackRat brand mark plus a clickable `PackRat ↗` link

Avoid muddy golden-brown surfaces. Orange-yellow should behave like a light/accent, not like the base material of the interface.

## Approved candidate tokens

Use these as the starting point for recent PackRat Stream Deck plugins:

- canvas/background: `#14171B`
- panel/card: `#1B1F24`
- input/status surface: `#15191E`
- neutral button: `#181C21`
- neutral button hover: `#22272E`
- border: `#303640`
- primary text: `#F5F7FB`
- muted text: `#9AA2AF`
- accent: `#FFB21E`
- accent hover/highlight: `#FFC44D`
- accent soft: `rgba(255,178,30,.16)`
- accent glow: `rgba(255,178,30,.28)`
- destructive: keep semantic PackRat red (for example `#FF5D6C`)

Green remains available for literal healthy/success telemetry states, but it is not the candidate brand/default interactive accent.

## Property Inspector structure

### Background and cards

- body/canvas uses the darkest surface
- cards use a slightly lighter charcoal
- borders remain cool neutral gray
- avoid brown/gold card fills
- inputs and status boxes use near-black charcoal
- use compact spacing and rounded cards consistent with current PackRat inspectors

### Buttons

Neutral buttons such as New, Rename, Duplicate, Refresh, or secondary actions:

- charcoal background
- white text
- neutral border at rest
- orange-yellow border/glow on hover and focus

Primary CTA buttons:

- solid `#FFB21E`
- dark text
- brighter `#FFC44D` hover
- soft orange glow

Destructive actions:

- stay red
- never recolor destructive meaning to orange

### Corner glow

Include one subtle premium ambient glow in the top-right of the Property Inspector. Baseline:

```css
body::before {
  content: "";
  position: fixed;
  top: -130px;
  right: -110px;
  width: 330px;
  height: 330px;
  pointer-events: none;
  background: radial-gradient(
    circle,
    rgba(255,178,30,.12) 0%,
    rgba(255,178,30,.055) 34%,
    rgba(255,178,30,0) 72%
  );
}
```

The glow is atmosphere only. It must not reduce text contrast or create a visible orange blob.

## PackRat brand link

Every new/recent Property Inspector using this candidate theme should expose a small brand link near the top:

`[PackRat icon] PackRat ↗`

Implementation requirements:

- use the real PackRat transparent logo asset, not an emoji and not a generated replacement
- bundle the image inside the plugin package
- render it as a normal local `<img>` element for maximum Stream Deck webview compatibility
- use `openUrl` to open the PackRat maker page:
  `https://marketplace.elgato.com/maker/packrat`
- orange-yellow label
- underline on hover
- subtle orange hover glow
- keep the mark small and secondary to the product title

Do not rely on CSS mask/data-URI rendering for the brand mark when a local packaged image is available.

## Key-face style

Keep the clean recent PackRat key style:

- dark rounded key background
- simple white line art
- orange-yellow accent stroke/glow
- minimal text
- no busy gradients or generated-looking lettermarks
- preserve monochrome white action-list/category icons when required by Elgato presentation rules

The visual accent on hardware should match the Property Inspector accent.

## Rollout rule

Before making this the global default:

1. Rat Dev one representative plugin with the full candidate theme.
2. Confirm the real PackRat logo renders.
3. Confirm dark surfaces are not too crushed on the user's monitor.
4. Confirm hover/focus glow feels premium rather than noisy.
5. Confirm the top-right glow is subtle.
6. Confirm destructive red and literal health-state colors remain semantic.
7. Only then update the canonical default accent/tokens and apply to other recent plugins.

When rolling out:

- visual-only changes unless a separate product bug is explicitly authorized
- do not change action UUIDs
- do not add/remove features
- do not change profiles
- do not change release state
- do not alter pricing or marketplace product IDs
- preserve current functionality exactly
- add lightweight regression checks so recent plugins cannot silently drift back to blue/green/brown defaults

## Reference implementation

Current visual prototype:

- private repo: `slayerkey/vcs`
- branch: `product/window-manager-pro`
- Property Inspector implementation under:
  `streamdeck/window-manager-pro/1.2.0.0/source/com.packrat.windowmanagerpro.sdPlugin/ui/`

Monitor Manager Pro remains a visual reference for dark card/background hierarchy and premium density. The candidate theme intentionally combines that darker hierarchy with the approved orange-yellow PackRat accent and brand link.
