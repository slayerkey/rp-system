# PackRat Marketplace Listing V2

## Purpose

PackRat Marketplace Listing V2 is the shared presentation standard for Stream Deck, Stream Deck+, XENEON Edge, profile, plugin, icon-pack, and related marketplace products.

The product is the marketing. The system exists to make the real product easy to understand, easy to trust, and easy to buy without burying it under branding or decoration.

This standard changes marketplace presentation only. It must not redesign or fabricate the purchased product.

## Core buyer questions

A listing should answer these questions in roughly this order:

1. What is this?
2. What does it actually look like?
3. Why would I care?
4. What does it do beyond the obvious version of the idea?
5. Is setup or day-to-day use annoying?
6. Is this a real, maintained PackRat product?
7. Do I understand what I am getting?

Every marketplace asset must answer at least one meaningful buyer question. Do not create media solely to reach a fixed gallery count.

## Product accuracy is a release gate

Customer-facing product imagery must come from the real product or a deterministic representation of the real product.

For hardware compositions:

REAL PRODUCT CAPTURE

→ APPROVED DEVICE PLATE

→ RESTRAINED BACKGROUND / LIGHTING

→ MINIMAL COPY / BRANDING

Do not use generative image systems to invent product UI, device controls, values, modes, layouts, or states.

Do not make Pro look better by altering the UI shown to customers. Edition differences must come from real functionality plus restrained marketplace labeling.

If the real product state required for a claim is unavailable, remove the claim or block the asset. Never synthesize proof.

## Marketplace canvas

Default marketplace image size: `1920 × 960`.

Video uses the current Elgato Marketplace requirement for the product type and must be verified against current Marketplace guidance before export.

Keep all essential information inside a `72 px` outer safe area. Do not place important text against the frame edge.

## Hero system

The hero is the highest-priority asset.

Default hierarchy:

1. Real product / device
2. Real product UI
3. Optional short use-case label
4. PackRat mark
5. Supporting background

The marketplace title already names the product. Do not automatically repeat the full product name at poster scale.

### Device / product dominance

For a normal hardware hero, target approximately `78–92%` of usable canvas width for the dominant device/product composition when the form factor allows it.

The product should normally occupy at least `55%` of the canvas height excluding safe areas.

Prefer a straight or near-front view. Avoid cinematic angles that make the UI harder to read.

A background scene is never a reason to make the purchased product small.

### Hero chrome

V2 hero chrome is intentionally shallow.

- PackRat mark: top center, restrained, consistent.
- Optional use-case label: top left.
- Optional edition/platform label: top right.
- Real product: dominant center.
- No duplicate PackRat footer mark on a V2 hero.

The hero should not contain a paragraph.

### Hero label decision

Use the fastest clear option:

- `none` when the product is self-explanatory from the real UI plus marketplace title.
- `use_case` when a short label such as `PC POWER`, `WEATHER`, `MUSIC CONTROL`, or `AI USAGE` makes the thumbnail understandable faster.
- `product` only when the marketplace title genuinely needs to be repeated in the image for clarity.

Recommended use-case label length: `2–4 words` and preferably under `24 characters`.

### Brand mark

The current canonical PackRat mark is the rat/package logo. The vector source currently lives at `slayerkey/packrat-site/assets/packrat-logo.svg`; Rat Art may use a deterministic repository-local raster derivative.

Default V2 hero mark position: top center.

The mark must be recognizable but subordinate to the product. Do not render a large `PACKRAT` wordmark on every listing.

### Background

Use a restrained dark studio field with controlled depth and a configurable product-family ambient accent.

Allowed:

- subtle gradient
- soft local glow behind product
- restrained vignette
- product-appropriate ambient color
- slight texture when it improves separation

Avoid:

- giant RGB explosions
- random desks or rooms
- unrelated props
- fake floating HUD elements
- decorative particles
- visual effects that reduce UI legibility

## Thumbnail gate

The hero must be inspected at least at these derived review sizes:

- `480 × 240`
- `320 × 160`
- `240 × 120`

At `320 × 160` the product must still be the obvious subject. Any hero label that becomes unreadable or competes with the product must be removed or simplified.

Rat Art should generate a thumbnail review sheet for V2 candidates.

## Listing sequence

A strong default sequence is:

1. Hero
2. Demo / product in action when motion or state change matters
3. Core value proof
4. Strongest differentiator
5. Secondary differentiator or useful modes
6. Setup / ease only when it removes a real buying objection
7. Compatibility / sizes when relevant
8. Trust / creator close only when it adds information not already supplied by the maker identity

This is a decision framework, not a mandatory asset count.

Do not put a near-duplicate static screenshot immediately after the hero.

## Demo video system

Recommend a demo when the product's value depends materially on:

- changing live data
- interaction
- animation
- multiple modes or states
- touch controls
- navigation
- before/after behavior

A demo should show the product immediately. No long intro animation.

Conceptual default pacing:

- `0–2 s`: real product immediately
- `2–5 s`: primary job
- `5–9 s`: strongest second state or interaction
- `9–14 s`: meaningful depth / mode / result
- optional short PackRat close only if it does not delay understanding

Typical useful length is roughly `8–16 seconds`, but comprehension controls the length.

Overlay copy should normally be `2–5 words` and should not turn the video into a slideshow.

## Feature asset system

Start with the customer benefit, then use the real UI as proof.

Prefer:

- image when the value is visually obvious
- short video when change/movement is the value
- before/after when the difference itself matters
- headline + real screen when the screen proves the claim
- small checklist only when several simple inclusions are genuinely useful

Do not default every feature to icon + headline + paragraph cards.

### Copy compression

Feature headlines should usually be `2–6 words`.

Body copy should usually fit one short line, two at most.

Run the `SO WHAT?` test on every feature. If a feature statement only describes implementation, rewrite it as the useful outcome or remove it.

Examples:

- `4 DISPLAY MODES` is stronger than a paragraph explaining that four layouts are selectable.
- `ONE-TIME SETUP` is stronger than explaining every configuration click on a marketing frame.
- `SEE WHAT THE WATTS COST` communicates why energy integration matters.

## Lite / Pro / Free families

Related editions must be visibly one family.

Keep consistent:

- product/device framing
- logo position
- type system
- background family
- hero label placement
- overall composition

Differentiate editions with a restrained badge or label and the real feature/state being demonstrated.

Do not use a more cinematic device, brighter fake UI, or unrelated background solely to make Pro appear premium.

## XENEON-specific rule

For XENEON Edge, the captured widget remains the source of truth and is composited into the calibrated XENEON device plate.

Compatibility/sizes normally belongs at the end of the gallery after value and interaction are understood.

Eight slot captures remain QA evidence even if only a subset appears in marketplace media.

## Stream Deck plugin / profile rule

When a plugin/profile is best understood as a key layout, make the physical or deterministic Stream Deck key cluster large enough to read as the product rather than decoration.

Do not fabricate desktop application UI merely to create context.

If the product depends on desktop-side setup, show only real setup screens and only when setup friction materially affects the purchase decision.

## Icon pack rule

For an icon pack, the icons themselves are the product hero.

A strong hero normally uses a large, readable grid or carefully selected subset at true key-like scale. A Stream Deck device may provide context, but it must not make the actual icon design too small.

Show variety without turning the hero into a wall of hundreds of indistinguishable thumbnails.

Use Marketplace icon metadata such as style, theme, color, static/animated state, and supported device fields for discoverability rather than adding keyword blocks to customer-facing copy.

## Description system

Descriptions should sound like a real creator explaining the product.

Recommended structure when each section adds useful information:

1. One-line value proposition
2. Why it is useful / 2–4 concise benefits
3. What you get
4. Setup only when buyers need to know it before purchase
5. Compatibility / requirements
6. Lite vs Pro where relevant
7. Short PackRat close

The first sentence matters disproportionately because marketplace cards and previews may truncate later copy.

Avoid filler such as:

- elevate your experience
- ultimate solution
- unlock unparalleled control
- revolutionize your workflow

Do not append raw SEO keyword paragraphs to the description.

## Discoverability / metadata

Use the Marketplace's actual metadata fields and filters first:

- product type
- platform / operating system
- supported device
- dial support where relevant
- icon style / theme / color
- XENEON orientation / interactivity
- product keywords / search terms when supported
- correct free / paid edition relationship

Customer-facing prose stays human-readable.

## Creator trust

Trust should be cumulative across the catalog, not manufactured inside every product.

Use the same restrained PackRat mark and a consistent maker identity.

A short close such as `Made by PackRat.` or `Part of the PackRat ecosystem.` is enough when useful.

Do not invent social proof, customer counts, ratings, maintenance promises, or usage metrics.

## Catalog contact sheet

The catalog is a system, not a collection of isolated covers.

Generate a hero contact sheet in marketplace order and inspect:

- product scale
- PackRat mark position
- label scale
- background intensity
- product visibility
- family relationships
- edition badges
- color balance
- outliers

The desired result is recognizable common authorship without making every product the same template.

## Scoring rubric

Score a V2 candidate honestly from `0–100`:

- Instant product clarity: 20
- Product visibility: 15
- Visual quality: 10
- Marketplace thumbnail performance: 10
- User journey: 15
- Feature communication: 10
- Brand recognition: 10
- Consistency: 5
- Description quality: 5

Target: `95+`.

Normal maximum refinement passes: `3`.

## Mandatory gates

A candidate fails regardless of numeric score if:

- product is not the hero
- actual UI is misleading
- hardware/product is too small
- hero copy is hard to scan
- branding competes with product
- a demo delays the product behind intro material
- feature art spends prime space explaining obvious information
- descriptions contain generic AI-marketing filler
- Lite / Pro family members look unrelated
- logo treatment is inconsistent
- hero fails thumbnail review
- gallery sequence does not follow a sensible buyer journey
- consistency is achieved by making every listing visually identical
- unexplained raw SEO keyword clutter remains in customer-facing descriptions
- a real screenshot is altered in a way that misrepresents the purchased product

## Rollout safety

V2 is opt-in while the catalog migrates.

Do not change the rendering of existing schema-v1 products merely because shared tooling changed.

A product moves to V2 only after its real source/captures are available, its V2 candidate is rendered, its thumbnail sheet/contact sheet is reviewed, claims are verified, and the product-specific art review records the result.

Legacy products whose real source or current marketing assets are not yet versioned must be marked `SOURCE_REQUIRED`; do not fabricate a V2 replacement from memory.
