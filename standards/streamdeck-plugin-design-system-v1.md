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

This is the single global visual contract for PackRat Stream Deck plugins. Product prompts should say **"use the canonical PackRat Stream Deck design system"** instead of restating colors, spacing, branding, button rules, glow, or Property Inspector styling.

**Reference implementation:** Monitor Manager Pro. The implementation is the visual reference, but this document is the source of truth. If Monitor Manager and this section ever disagree, resolve the difference here deliberately instead of creating another branding/spec file.

### Visual character

PackRat Property Inspectors are:

- very dark, almost-black charcoal
- compact and premium
- clean white primary text
- cool-gray supporting text
- bright cheddar orange-yellow for PackRat branding and primary interaction
- subtle orange glow, never muddy brown/gold surfaces
- semantic red for destructive/error states
- semantic green only for literal healthy/success/connected states

### Canonical tokens

These values come directly from the approved Monitor Manager Pro treatment:

- body/canvas: `#080A0E`
- card gradient start: `#151920`
- card gradient end: `#0D1015`
- input surface: `#090C10`
- privacy/deep neutral surface: `#0D1116`
- card border: `#272D36`
- input border: `#303744`
- primary text: `#F5F7F9`
- label text: `#CBD1D9`
- body/muted text: `#AAB2BD`
- tertiary/help text: `#87919F`
- PackRat accent: `#FFB21E`
- accent hover: `#FFC94A`
- primary-button deep border: `#C97A00`
- accent glow: `rgba(255,178,30,.35)`
- hero corner glow: `rgba(255,178,30,.14)`
- destructive/error: `#FF5D6C`
- healthy/success when semantically meaningful: `#2BE86A`
- neutral/unknown status: `#8B93A1`

Do not substitute lighter generic grays such as `#14171B` / `#1B1F24` for the canonical page/card hierarchy. The near-black Monitor Manager contrast is intentional.

### Canonical Property Inspector recipe

Use this as the baseline:

```css
:root {
  color-scheme: dark;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system,
    BlinkMacSystemFont, "Segoe UI", sans-serif;

  --packrat-bg: #080A0E;
  --packrat-card-start: #151920;
  --packrat-card-end: #0D1015;
  --packrat-input: #090C10;
  --packrat-deep: #0D1116;
  --packrat-border: #272D36;
  --packrat-input-border: #303744;
  --packrat-text: #F5F7F9;
  --packrat-label: #CBD1D9;
  --packrat-muted: #AAB2BD;
  --packrat-help: #87919F;
  --packrat-accent: #FFB21E;
  --packrat-accent-hover: #FFC94A;
  --packrat-accent-border: #C97A00;
  --packrat-accent-glow: rgba(255,178,30,.35);
  --packrat-danger: #FF5D6C;
  --packrat-success: #2BE86A;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  background: var(--packrat-bg);
  color: var(--packrat-text);
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
  background: linear-gradient(
    145deg,
    var(--packrat-card-start),
    var(--packrat-card-end)
  );
  border-radius: 14px;
  padding: 15px;
}

.hero {
  background:
    radial-gradient(circle at 90% 0%, rgba(255,178,30,.14), transparent 42%),
    linear-gradient(145deg, var(--packrat-card-start), var(--packrat-card-end));
}

h1 {
  margin: 5px 0 6px;
  font-size: 20px;
  line-height: 1.1;
}

h2 {
  margin: 0 0 10px;
  font-size: 13px;
}

p {
  margin: 0;
  color: var(--packrat-muted);
  font-size: 12px;
  line-height: 1.45;
}

label {
  display: block;
  margin: 11px 0 6px;
  color: var(--packrat-label);
  font-size: 11px;
  font-weight: 700;
}

input,
select,
textarea {
  width: 100%;
  border: 1px solid var(--packrat-input-border);
  border-radius: 9px;
  background: var(--packrat-input);
  color: #F7F8FA;
  padding: 9px 10px;
  outline: none;
  font: inherit;
  font-size: 12px;
}

input:focus,
select:focus,
textarea:focus {
  border-color: var(--packrat-accent);
  box-shadow: 0 0 0 2px var(--packrat-accent-glow);
}

button {
  border: 1px solid var(--packrat-border);
  border-radius: 9px;
  background: var(--packrat-deep);
  color: var(--packrat-text);
  font-weight: 800;
  cursor: pointer;
}

button:hover,
button:focus-visible {
  border-color: var(--packrat-accent);
  box-shadow: 0 0 18px var(--packrat-accent-glow);
  outline: none;
}

button.primary {
  border-color: var(--packrat-accent-border);
  background: var(--packrat-accent);
  color: #120B00;
  box-shadow: 0 0 14px var(--packrat-accent-glow);
}

button.primary:hover,
button.primary:focus-visible {
  border-color: var(--packrat-accent);
  background: var(--packrat-accent-hover);
  box-shadow: 0 0 18px var(--packrat-accent-glow);
}

button.danger {
  border-color: var(--packrat-danger);
  color: #FFF;
}

.metric-value,
.status-value,
.big-number {
  font-variant-numeric: tabular-nums;
}

.help,
.caps {
  color: var(--packrat-help);
  font-size: 10px;
  line-height: 1.5;
}
```

Normal utility buttons stay near-black/charcoal. Orange-yellow is for primary CTAs, focus, borders, links, and glow. Do not make every button orange.

### PackRat brand treatment

Property Inspectors use:

`[PackRat icon] PackRat ↗`

Requirements:

- use the real shared PackRat transparent logo
- bundle it locally inside the plugin
- render it as a normal local `<img>`
- do not use emoji, generated substitutes, CSS masks, or data-URI workarounds when the local asset is available
- use the PackRat accent for the label
- clicking uses Stream Deck `openUrl`
- destination: `https://marketplace.elgato.com/maker/packrat`
- hover may underline and use the canonical accent glow
- keep branding secondary to the product title

### Key-face style

Use the same visual language on hardware:

- dark rounded key background
- simple geometric white line art
- orange-yellow accent stroke/highlight
- minimal text
- strong readability at 72 x 72
- no busy gradients or generated-looking lettermarks
- preserve monochrome white action-list/category icons where Elgato presentation requires them

### Semantic color rule

- orange-yellow = PackRat brand / interaction / focus
- green = literal healthy / success / connected
- red = destructive / failure / offline when appropriate
- gray = neutral / unknown / supporting information

A user-adjustable accent may control product data visualization where useful, but it does not replace PackRat branding or semantic warning/error meaning.

### Existing-product rollout rule

Applying this design system to an existing product is visual-only unless a separate product bug is explicitly authorized.

Do not change:

- plugin/action UUIDs
- feature scope
- settings semantics
- profiles
- release state
- pricing
- Marketplace IDs
- Lite/Pro relationships

Add lightweight regression checks for the canonical background/card hierarchy, PackRat accent, local logo, maker URL, primary/neutral button treatment, and semantic destructive color.

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
