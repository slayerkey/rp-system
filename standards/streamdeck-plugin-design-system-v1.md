# PackRat Stream Deck Plugin Design System v1


This is the canonical implementation contract for new PackRat Stream Deck plugins. It captures the hardware, Property Inspector, profile, and visual lessons that repeatedly caused rework when they were left implicit.

The target is not "looks correct in source." The target is "obvious, readable, persistent, and responsive on a real Stream Deck."

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

This is the global PackRat Stream Deck visual contract. New plugins and deliberate refreshes of recent plugins should reference this section instead of restating colors, branding, button rules, or Property Inspector styling in product-specific prompts.

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

Use these values by default:

- canvas/background: `#080A0E`
- panel/card: `linear-gradient(145deg,#151920,#0D1015)`
- input/status surface: `#15191E`
- neutral button: `#181C21`
- neutral button hover: `#22272E`
- border: `#303640`
- primary text: `#F5F7FB`
- muted text: `#9AA2AF`
- PackRat accent: `#FFB21E`
- accent hover/highlight: `#FFC44D`
- accent soft: `rgba(255,178,30,.16)`
- accent glow: `rgba(255,178,30,.28)`
- destructive/error: `#FF5D6C`
- healthy/success when semantically meaningful: `#2BE86A`
- neutral/unknown status: `#8B93A1`

Orange-yellow is the brand and interaction accent. Do not use muddy golden-brown fills as the normal button/card language.

### Property Inspector surfaces

Only the page background and card/box background use the darker Monitor Manager Pro treatment. All other canonical accent, glow, button, hover, spacing, and semantic-color behavior remains unchanged unless the global design itself is explicitly being revised.

Use the darkest surface for the body, slightly lighter charcoal for cards, near-black charcoal for inputs/status boxes, and cool neutral borders.

Recommended baseline:

```css
:root {
  --packrat-bg: #080A0E;
  --packrat-card-start: #151920;
  --packrat-card-end: #0D1015;
  --packrat-input: #15191E;
  --packrat-button: #181C21;
  --packrat-button-hover: #22272E;
  --packrat-border: #303640;
  --packrat-text: #F5F7FB;
  --packrat-muted: #9AA2AF;
  --packrat-accent: #FFB21E;
  --packrat-accent-hover: #FFC44D;
  --packrat-accent-soft: rgba(255,178,30,.16);
  --packrat-accent-glow: rgba(255,178,30,.28);
}
```

Normal secondary buttons such as New, Rename, Duplicate, Refresh, or similar actions use charcoal at rest. On hover/focus they may use the PackRat accent for border/glow, but they do not become brown/gold blocks.

Primary CTA buttons use the solid PackRat accent with dark text and the brighter accent on hover.

Destructive actions remain red. Never recolor destructive meaning to orange.

### Ambient corner glow

Property Inspectors use one subtle premium orange glow in the top-right:

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

### Lite → Pro upgrade callout

When a free/Lite Stream Deck product has a direct Pro counterpart, the Property Inspector must expose the upgrade without making the user scroll to the bottom of the inspector.

Canonical pattern:

- use one compact top bar above the first product card
- keep `[PackRat icon] PackRat ↗` on the left
- place a primary CTA button labeled `Upgrade to Pro ↗` on the right
- vertically center both controls in the same row and preserve enough gap that they never collide
- the CTA uses the normal PackRat orange primary-button treatment and glow; do not invent a second upsell color system
- clicking opens that Lite product's direct Pro Marketplace listing through Stream Deck `openUrl`
- keep the button compact and `white-space: nowrap` so the top bar stays one clean row at normal Property Inspector widths
- do not rely on a bottom-only upsell that users must scroll to discover
- do not add fake locked controls, disabled Pro actions, or clutter simply to advertise the upgrade
- product-specific feature explanations may appear elsewhere when useful, but the persistent top CTA itself stays generic and reusable

This is the default Lite → Pro conversion pattern for future PackRat Stream Deck plugins unless a product has no direct Pro counterpart or has an explicit documented exception.

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

### Visual rollout rule

**Consumer rule:** product-specific build, QA, and rollout tasks must treat this file as read-only. They consume this design system; they do not rewrite it to match their local implementation. Only an explicit global design-system task may edit this file.

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
