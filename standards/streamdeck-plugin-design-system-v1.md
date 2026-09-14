# PackRat Stream Deck Plugin Design System v1 — Canonical RatPack Standard

This is the canonical implementation and visual contract for PackRat Stream Deck plugins. It captures the hardware, Property Inspector, profile, interaction, and visual lessons that repeatedly caused rework when they were left implicit.

The target is not "looks correct in source." The target is "obvious, readable, persistent, responsive, and recognizably PackRat on a real Stream Deck."

## Authority and inheritance

This file is the single source of truth for the PackRat Stream Deck product experience.

- new Stream Deck plugins inherit this standard automatically
- product prompts should say **"use the canonical PackRat Stream Deck design system"** instead of restating colors, card geometry, buttons, glow, logo, or Property Inspector styling
- do not create a second product-specific "requirements/design/branding" document that copies these rules
- if a product genuinely needs an exception, document only the exception and the reason; everything else still inherits from this file
- when the global PackRat look changes, update this file first, then roll the change out to products
- implementation references are allowed; duplicated design contracts are not

Precedence for visual/interaction decisions:

1. this canonical standard
2. a documented product-specific exception
3. product implementation details

A product implementation that accidentally differs from this file is not a new standard.

## 1. Stable action identity

Every action gets one semantic slug and keeps it everywhere:

- manifest UUID: `com.packrat.<product>.<action-slug>`
- action icon directory: `imgs/actions/<action-slug>/`
- source action map key: `<action-slug>`
- profile generator UUID constant: the same manifest UUID
- tests and Property Inspector filtering: the same slug/UUID

Do not invent alternate names for the same action in profiles, source, and art. Stable identity makes future profile generation, QA, and debugging straightforward.

## 2. Full-key visual ownership

PackRat Keypad actions own the whole key face.

- `ShowTitle: false`
- runtime text/state is rendered into the image with `setImage(...)`
- Stream Deck host title overlays are not product UI
- 144 x 144 source art is reviewed at the real 72 x 72 hardware scale and at 36 x 36 stress-test scale

For rendered data cards, use this baseline before product-specific adjustments:

- outer canvas: 144 x 144
- safe horizontal content origin: about 14 px
- optional state/accent rail: about 5 px
- label: roughly 15-17 source px, bold
- primary value: roughly 29-38 source px
- secondary value: roughly 13-16 source px
- footer: optional only; do not put essential information in tiny footer text
- essential content stays at least 10-12 px from edges

If the key needs four layers of tiny information, simplify the key. Physical readability wins over information density.

### Proven utility-key renderer baseline

Monitor Manager Pro is the PackRat reference for compact utility controls. The pattern that survived real MK.2 testing is:

- one central renderer module owns background, glyph, state/value text, and text fitting
- semantic glyph lives in the upper portion of a 144 x 144 source canvas
- one-line text is rendered near y=131
- two-line text uses roughly y=112 and y=136
- text size adapts to the longest line instead of letting the host squeeze or clip it
- a useful starting scale is about 24 px for <=5 characters, 20 px for <=8, and 17 px for longer compact labels
- no host title is rendered on top of this image

These numbers are a proven starting point, not a reason to force every plugin into the exact same typography. The invariant is stronger: the renderer owns the collision-free geometry.

Centralize semantic glyphs in one obvious map keyed by the stable action slug. Do not scatter one-off SVG strings across action handlers.

## 3. Short labels and equal hierarchy

Use short semantic labels such as `SPEED`, `SUMMARY`, `LATENCY`, `OUTAGE`, and `BRIGHTNESS`.

When two values are equally important, give them equal visual weight. Examples:

- download and upload
- left and right audio channels
- CPU and GPU values when the action promises both equally

Do not make one value large and push the other into a tiny footer just because the generic card template only has one primary slot. Use a dedicated layout.

### Preset versus live-state rule

A preset key answers "what will this set?" and must keep showing its configured target.

Examples:

- a 25% brightness preset keeps showing 25%
- a 65% brightness preset keeps showing 65%
- a 240 Hz preset keeps showing 240HZ

Do not repaint every preset key with one shared current hardware value; that makes distinct buttons visually identical.

Live values belong on actions whose job is status/monitoring, and on encoder feedback. If the same action supports both Keypad and Encoder, the Keypad may show the configured preset while the Encoder shows the live value.

## 4. Canonical PackRat visual system

This section is the global PackRat Stream Deck visual contract. New plugins and deliberate refreshes of recent plugins reference this section instead of restating colors, branding, button rules, glow, spacing, or Property Inspector styling in product-specific prompts.

**Reference implementation:** Monitor Manager Pro is the current visual baseline for a clean PackRat Property Inspector. It is a reference implementation, not a competing source of truth. If the implementation and this document disagree, update this document deliberately rather than silently treating implementation drift as canonical.

The target look is dark, premium, compact, and consistent:

- very dark charcoal canvas
- slightly lighter charcoal cards
- clean white primary text
- muted cool-gray secondary text
- bright cheddar orange-yellow as the PackRat brand/interaction accent
- subtle orange glow rather than brown/gold fills
- simple geometric key art
- semantic red for destructive/error states
- semantic green only when the product literally means healthy/success/connected
- real PackRat brand mark with a clickable `PackRat ↗` link in Property Inspectors

Do not create alternate PackRat visual themes inside individual plugin specs unless a product has an explicit, documented exception.

### Canonical tokens

Use these values by default. These match the current proven PackRat Property Inspector treatment rather than a generic dark theme:

- body/canvas: `#080A0E`
- deep card edge: `#0D1015`
- raised card start: `#151920`
- input surface: `#090C10`
- neutral button: `#181C21`
- neutral button hover: `#22272E`
- card border: `#272D36`
- input/focus border: `#303744`
- primary text: `#F5F7F9`
- label text: `#CBD1D9`
- muted text: `#AAB2BD`
- tertiary/help text: `#87919F`
- PackRat accent: `#FFB21E`
- accent hover/highlight: `#FFC94A`
- accent soft: `rgba(255,178,30,.14)`
- accent focus/glow: `rgba(255,178,30,.35)`
- destructive/error: `#FF5D6C`
- healthy/success when semantically meaningful: `#2BE86A`
- neutral/unknown status: `#8B93A1`

Orange-yellow is the PackRat brand and interaction accent. Do not use muddy golden-brown fills as the normal button/card language. Do not make every button orange: orange communicates primary interaction and focus; neutral utility actions remain charcoal.

### Property Inspector surfaces

Use the darkest surface for the body, slightly lighter charcoal for cards, near-black charcoal for inputs/status boxes, and cool neutral borders.

Recommended baseline:

```css
:root {
  --packrat-bg: #080A0E;
  --packrat-card-deep: #0D1015;
  --packrat-card: #151920;
  --packrat-input: #090C10;
  --packrat-button: #181C21;
  --packrat-button-hover: #22272E;
  --packrat-border: #272D36;
  --packrat-input-border: #303744;
  --packrat-text: #F5F7F9;
  --packrat-label: #CBD1D9;
  --packrat-muted: #AAB2BD;
  --packrat-help: #87919F;
  --packrat-accent: #FFB21E;
  --packrat-accent-hover: #FFC94A;
  --packrat-accent-soft: rgba(255,178,30,.14);
  --packrat-accent-glow: rgba(255,178,30,.35);
  --packrat-danger: #FF5D6C;
  --packrat-success: #2BE86A;
}

body {
  margin: 0;
  background: var(--packrat-bg);
  color: var(--packrat-text);
  font-family: Inter, ui-sans-serif, system-ui, -apple-system,
    BlinkMacSystemFont, "Segoe UI", sans-serif;
}

main {
  display: grid;
  gap: 12px;
  padding: 14px;
}

.hero,
.card,
.group,
.privacy {
  border: 1px solid var(--packrat-border);
  background: linear-gradient(145deg, var(--packrat-card), var(--packrat-card-deep));
  border-radius: 14px;
  padding: 15px;
}

input,
select {
  width: 100%;
  border: 1px solid var(--packrat-input-border);
  border-radius: 9px;
  background: var(--packrat-input);
  color: var(--packrat-text);
  padding: 9px 10px;
}

input:focus,
select:focus {
  border-color: var(--packrat-accent);
  box-shadow: 0 0 0 2px var(--packrat-accent-glow);
  outline: none;
}
```

### Canonical component geometry

Use these defaults unless the product has a real usability reason to vary them:

- outer PI padding: 14 px
- vertical card gap: 12 px
- card radius: 14 px
- card padding: 15 px
- input/select radius: 9 px
- input/select vertical padding: about 9 px
- product heading: about 20 px
- card heading: about 13 px
- normal explanatory text: about 12 px
- field labels: about 11 px, semibold/bold
- tertiary capability/help copy: about 10 px
- compact button radius: about 9 px
- keep rows visually aligned; numbers, dropdowns, and buttons should look deliberately measured rather than browser-default

Normal secondary buttons such as New, Rename, Duplicate, Refresh, or similar actions use charcoal at rest. On hover/focus they may use the PackRat accent for border/glow, but they do not become brown/gold blocks.

Primary CTA buttons use the solid PackRat accent with dark text and the brighter accent on hover. Use primary CTA treatment sparingly; a panel full of equally loud orange buttons is not canonical PackRat.

Destructive actions remain red. Never recolor destructive meaning to orange.

Status colors are semantic, not decorative. Green means healthy/success/connected; red means failure/destructive; neutral states stay gray. Do not paint arbitrary controls green because they are "active."


### Canonical component recipe

This section is the implementation reference for the current PackRat Property Inspector look. Product prompts should say **"use the canonical PackRat Stream Deck design system"** instead of restating visual requirements.

If a product-specific prompt repeats different colors, spacing, radii, button treatment, number styling, or glow behavior by accident, this document wins. A deliberate exception must be named and justified in the product plan.

Use this baseline:

- body padding: 12 px
- primary section gap: 10-12 px
- card radius: 10 px
- input/button radius: 7 px
- card border: 1 px solid `var(--packrat-border)`
- card padding: 12 px
- control minimum height: 34 px
- body copy: 12 px
- helper copy: 11 px
- section heading: 13-14 px, semibold/bold
- large status/value number: 24-30 px, bold
- compact secondary number: 15-18 px, semibold
- numeric readouts use `font-variant-numeric: tabular-nums`
- keep one clear visual hierarchy per card: heading -> value/control -> helper text

Canonical CSS starting point:

```css
:root {
  color-scheme: dark;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  background: var(--packrat-bg);
  color: var(--packrat-text);
  font-size: 12px;
}

main {
  position: relative;
  z-index: 1;
  display: grid;
  gap: 10px;
  padding: 12px;
}

.card,
.group,
.status-card {
  border: 1px solid var(--packrat-border);
  border-radius: 10px;
  background: var(--packrat-card);
  padding: 12px;
}

h1, h2, h3,
.section-title {
  margin: 0;
  color: var(--packrat-text);
  font-weight: 700;
}

.eyebrow,
.kicker {
  color: var(--packrat-accent);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: .09em;
  text-transform: uppercase;
}

.metric-value,
.status-value,
.big-number {
  color: var(--packrat-text);
  font-size: 26px;
  font-weight: 800;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.muted,
.hint,
.help {
  color: var(--packrat-muted);
  font-size: 11px;
  line-height: 1.4;
}

input,
select,
textarea {
  width: 100%;
  min-height: 34px;
  border: 1px solid var(--packrat-border);
  border-radius: 7px;
  background: var(--packrat-input);
  color: var(--packrat-text);
  padding: 6px 8px;
}

button {
  min-height: 34px;
  border: 1px solid var(--packrat-border);
  border-radius: 7px;
  background: var(--packrat-button);
  color: var(--packrat-text);
  font-weight: 700;
  cursor: pointer;
  padding: 6px 10px;
}

button:hover,
button:focus-visible {
  border-color: var(--packrat-accent);
  background: var(--packrat-button-hover);
  box-shadow: 0 0 0 2px var(--packrat-accent-soft),
              0 0 18px var(--packrat-accent-glow);
  outline: none;
}

button.primary {
  border-color: var(--packrat-accent);
  background: var(--packrat-accent);
  color: #16110A;
}

button.primary:hover,
button.primary:focus-visible {
  background: var(--packrat-accent-hover);
}

button.danger {
  border-color: var(--packrat-danger, #FF5D6C);
  color: #FFF;
}
```

The exact component count is product-specific. The visual language is not.

### Number and status hierarchy

The clean PackRat look depends heavily on readable values and restrained supporting text.

- Put the important number/state first.
- Give important numeric values room; do not shrink them to fit unnecessary prose.
- Use tabular numbers for latency, percentages, temperatures, FPS, bandwidth, timers, and other changing values.
- A unit such as `ms`, `%`, `°C`, `Mbps`, or `Hz` should be visibly secondary to the number but still readable.
- Do not use giant numbers everywhere. Large numeric hierarchy is for the one value the card is about.
- Avoid four tiny metrics in one row when two clear rows would read better.
- Use labels such as `ONLINE`, `DEGRADED`, `OFFLINE`, `ON`, `OFF`, `AUTO`, or `N/A` only when they describe real state.
- Unknown/unavailable state is neutral gray, not green.
- Orange is the brand/interaction accent, not a fake healthy state.
- Green is reserved for literal success/healthy/connected meaning.

### Button hierarchy

Buttons must look clickable without turning the inspector into a wall of orange.

- neutral utility actions are charcoal by default
- hover/focus may introduce orange border/glow
- exactly one obvious primary CTA may use solid orange when the screen genuinely has a primary action
- destructive actions are red
- disabled actions reduce opacity and keep the cursor/default state obvious
- do not use bright green as the generic PackRat button color
- do not use muddy gold/brown button fills
- icon-only controls still need an accessible label or tooltip
- repeated button rows use equal height and spacing

### Layout discipline

The canonical design is compact, not cramped.

- Prefer one-column flow in narrow Property Inspectors.
- Use two-column grids only for naturally paired values or settings.
- Do not create dense 3-4 column mini dashboards inside the inspector.
- Cards are grouped by user task, not by implementation module.
- Status belongs near the top.
- Advanced or dangerous controls belong lower and should be visually quieter until needed.
- Helper copy explains consequences, not obvious labels.
- Avoid decorative separators when card boundaries already create hierarchy.
- Avoid arbitrary per-product radii, shadows, and gradients.
- Use one top-right ambient glow. Do not add a second glow, colored blobs, or background decoration that competes with controls.

### Canonical brand header

When a Property Inspector needs a product header, use a compact hierarchy:

1. small PackRat eyebrow or local PackRat brand link
2. product/action title
3. one short explanatory line only when it adds real context

Do not spend the top third of the inspector on oversized branding.

The PackRat maker link and logo remain secondary UI. They should never compete with the active action's settings.

### Single-source-of-truth rule

This file is the branding and interaction source of truth for PackRat Stream Deck plugins.

Product-specific specs should not maintain their own parallel list of:

- PackRat colors
- generic button colors
- border radii
- card styling
- top-right glow values
- brand-link treatment
- normal typography hierarchy
- standard key-face visual language

Instead, they should reference this file and document only real product exceptions.

When a better global visual pattern is approved during physical QA, update this standard first, then roll it into products. Do not leave the improvement trapped in one plugin.


### Ambient corner glow

Property Inspectors use one subtle premium orange glow in the top-right. This is part of the canonical PackRat composition, not an optional per-product flourish:

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

It is atmosphere only. It must not reduce text contrast or look like a visible orange circle.

### PackRat Property Inspector brand link

Property Inspectors use the small brand treatment:

`[PackRat icon] PackRat ↗`

Canonical behavior:

- use the real PackRat transparent logo asset from the shared RatPack art assets
- bundle the logo locally inside the plugin package
- render it as a normal local `<img>`; do not depend on CSS masks or data-URI tricks when a local packaged image is available
- label text uses the PackRat accent
- hover may underline and add a subtle accent glow
- clicking uses Stream Deck `openUrl`
- destination: `https://marketplace.elgato.com/maker/packrat`
- keep the mark small and secondary to the product title
- do not substitute emoji or generated replacement logos

### Key-face style

Recent PackRat keys use:

- dark rounded key background
- simple geometric white line art
- PackRat orange-yellow accent stroke/highlight
- minimal text
- strong readability at 72 x 72 hardware scale
- no busy gradients or generated-looking lettermarks

Preserve monochrome white action-list/category icons where required by Elgato presentation rules. The hardware accent and Property Inspector accent should feel like the same system.

### User-adjustable accents and semantic state

A product may expose a user accent setting when that capability is genuinely useful. If it does:

1. normalize the user accent to a six-digit hex value
2. persist and rerender it correctly
3. do not let it overwrite warning/error/destructive semantics
4. keep literal health/success telemetry green only when green conveys product meaning
5. keep PackRat branding itself on the canonical orange-yellow unless the product has a documented exception

Implementation convention when an accent setting exists:

- setting key: `accent`
- one shared `normalizeAccent(...)` helper
- pass the normalized accent into the renderer instead of reading settings independently in each action
- semantic warning/error colors remain independent

### Canonical inheritance rule

A new product should not need a long visual requirements prompt. The normal instruction is:

> Use the canonical PackRat Stream Deck design system from `standards/streamdeck-plugin-design-system-v1.md`.

That instruction means the product inherits the tokens, card treatment, button hierarchy, top-right glow, PackRat maker link, typography hierarchy, focus treatment, semantic status colors, and hardware key-face principles above.

A product-specific brief should describe only:

- product-specific information hierarchy
- genuinely unique controls or layouts
- semantic exceptions
- product-specific hardware states

If a prompt has to restate all PackRat colors, button geometry, glow, or logo placement, this standard is incomplete and should be updated here instead.

### Visual rollout rule

Applying the canonical theme is a visual-only operation unless a separate product bug is explicitly authorized.

Do not change:

- action UUIDs
- plugin UUIDs
- settings semantics
- feature scope
- profiles
- release state
- pricing
- Marketplace product IDs
- Lite/Pro relationships

When refreshing an existing product, preserve behavior exactly and add lightweight regression checks for the canonical tokens, local PackRat logo, maker URL, neutral button surfaces, ambient glow, and semantic destructive color.

## 5. Telemetry and graphs

Visual history and analytical history are separate concepts.

For live key graphs:

- use a short rolling visual window, normally 10-30 seconds
- 30 seconds is the default PackRat telemetry window unless a product has a clear reason otherwise
- fill the usable graph width with that window
- keep longer samples separately for analytics, alerts, outages, or reports
- a spike should remain visually obvious instead of being compressed by hours of historical data

For live status products, choose a polling cadence that feels alive on hardware without creating waste. Five seconds is a good baseline for cheap network/status probes. Faster local sensors may justify faster updates; expensive remote work should be slower or event-driven.

Never create one poller per key when a shared plugin-process engine can serve every key.

## 6. Property Inspector transport contract

The Property Inspector must be treated as a separate Stream Deck websocket client. Do not confuse its UUID with the selected action instance context.

The proven PackRat pattern is:

### Property Inspector side

- store the PI socket UUID as `uiUuid`
- use `context: uiUuid` for `getSettings`, `setSettings`, `getGlobalSettings`, `setGlobalSettings`, and `sendToPlugin`
- if the plugin needs the selected key instance, pass `actionInfo.context` separately inside the payload as `actionContext`
- autosave settings with a short debounce
- show visible feedback such as `Saving…` then `Saved`
- button commands show immediate local feedback such as `Probing…` or `Starting…`

### Plugin side

Prefer the global UI channel:

- `streamDeck.ui.onSendToPlugin(...)`
- `streamDeck.ui.sendToPropertyInspector(...)`
- resolve the selected key from payload `actionContext`
- do not rely on per-action PI response methods unless there is a product-specific reason and hardware proof

Required persistence test:

1. change a setting
2. wait for saved confirmation
3. select a different key
4. return to the original key
5. confirm the value persisted and the rendered key reflects it

Required command test:

1. press every PI command button
2. confirm immediate UI feedback
3. confirm the backend action occurred
4. confirm a fresh state response returns

## 7. Bundled default profiles

For a general dashboard-style paid plugin with multiple useful Keypad actions, bundled profiles are the default unless the product explicitly records why profiles would not add value.

Major-model PackRat baseline:

- DeviceType 0: standard / MK.2
- DeviceType 2: XL
- DeviceType 7: Plus
- DeviceType 9: Neo

Use `tools/streamdeck/profile-builder.mjs` for new deterministic profile generation.

Default manifest settings:

- `AutoInstall: true`
- `DontAutoSwitchWhenInstalled: true`
- `Readonly: false`

Profiles must preserve `ShowTitle: false` and use the same action UUIDs as the manifest. Do not hand-maintain four independent profile archives.

### Page architecture

A profile is allowed to have multiple pages. For products with many useful actions, prefer 3-5 clear workflow pages over cramming everything onto one surface.

Monitor Manager Pro is the reference pattern:

- primary/overview controls
- saved profiles or modes
- deeper system/display controls
- preset/value controls

Name pages by user intent, not implementation details. Keep the highest-frequency controls on page one. The shared `tools/streamdeck/profile-builder.mjs` supports both legacy one-page specs and deterministic multi-page specs.

### Rat Dev profile review loop

If a validated Stream Deck plugin contains bundled profiles, `rat dev <slug>` keeps the development profile current without blindly importing it on every run. Rat Dev fingerprints the bundled profile and checks the installed profile list first. An unchanged installed profile is not reopened, which prevents Stream Deck from creating repeated `copy` profiles. A changed bundle opens the newest profile once; a missing/deleted profile is opened again.

Selection order:

1. explicit `dev_profile` override
2. DeviceType 0 standard/MK.2 profile from the manifest
3. first bundled profile as a fallback

A product may explicitly set `open_profile_on_dev: false` only when automatically opening the profile would be actively unhelpful. Absence of that field is not an opt-out.

This makes profile review part of normal development instead of a step that can be forgotten.

Run:

`node tools/qa/streamdeck-key-visual-audit.mjs <path-to-.sdPlugin> --require-major-profiles`

when the product promises the major-model bundle.

## 8. Physical QA matrix

Automation is the floor. Before `READY_TO_SHIP`, visually sensitive plugins must pass a short hardware matrix.

### Key face

- readable at normal viewing distance
- nothing clips or runs off the key
- no essential micro-text
- paired metrics have appropriate visual weight
- accent/state colors visibly change as intended
- live graph fills its intended short window

### Property Inspector

- live status is not stuck on startup text
- settings save
- settings persist after close/reopen
- accent changes persist and rerender
- every button visibly responds and executes
- global settings and per-action settings are not mixed up

### Profiles

- expected major-model profile appears after install
- `rat dev` opens the standard/MK.2 development profile when bundled profiles exist
- multi-page navigation is coherent and the first page contains the highest-frequency controls
- profile actions resolve to installed plugin actions
- profile preserves `ShowTitle: false`
- profile does not force-switch the user's active profile

When hardware finds a repeatable defect, add a regression test or shared QA rule before calling the fix complete.

## 9. Common failure -> canonical fix

| Failure | Canonical fix |
| --- | --- |
| Text looked fine in source but tiny on hardware | Review 72 x 72 early; use the data-card type hierarchy above; remove nonessential footer copy |
| Graph became a tiny squiggle after long runtime | Decouple visual graph history from analytics history; use a 10-30 second visual window |
| Accent picker appeared to work but key did not update | Normalize accent, persist it through PI settings, and force runtime rerender |
| PI stayed on startup state while keys were live | Use global `streamDeck.ui` transport and the PI UUID envelope context |
| PI fields reset after reopening | Use `context: uiUuid` for settings messages and verify close/reopen persistence |
| PI buttons did nothing | Use the same global UI transport, pass action instance separately, and show immediate button feedback |
| Two equally important values were cramped | Give them a dedicated layout with equal visual hierarchy |
| Existing dev install kept an outdated default | Version/migrate global defaults during pre-release development instead of assuming empty settings |
| Profile bundle was forgotten | Use the shared profile builder, manifest `Profiles`, package tests, and the major-profile audit flag |
| Profile existed but Rat Dev did not open it | Rat Dev now defaults to importing a bundled profile, preferring DeviceType 0 / standard-MK.2 |
| Bottom-aligned host title still overlapped the icon | Disable the host title entirely; render glyph + text in one image with an explicit text band |
| Every preset key changed to the same live value | Keep preset keys on configured targets; reserve live values for status actions and encoder feedback |
| Raw resolution text ran off the key | Map common modes to compact labels such as 1080P, 1440P, or 4K and use a short fallback |
| Too many useful actions were crammed onto one page | Generate a small multi-page profile organized by user workflow |

## 10. Definition of done

A Stream Deck plugin is not visually done because the manifest validates.

For visual consistency, the final review should be able to answer **yes** to all of these without consulting a product-specific branding document:

- does the PI immediately look like the current PackRat family?
- are surface colors, spacing, controls, glow, and button hierarchy inherited from this file?
- is the real PackRat maker mark/link present where appropriate?
- are only semantic success/error states green/red?
- are action-list icons compliant with Elgato while hardware key art remains product-readable?
- did the product avoid inventing a local theme that competes with the global one?

It is done when:

- the action identity is stable
- key faces pass the structural audit
- representative runtime states are readable at 72 x 72 and 36 x 36
- Property Inspector settings and commands persist/work on hardware
- accent/state behavior is consistent
- live displays update at an intentional cadence
- visual graphs use an intentional short window
- promised major-model profiles are generated and package-tested
- Rat Dev opens the standard/MK.2 profile automatically for the local visual pass
- complex products use a coherent multi-page profile instead of a crowded single page
- Elgato validate/package passes
- a real-device smoke test confirms the final interaction
