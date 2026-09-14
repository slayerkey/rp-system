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

## 4. Accent and semantic state colors

Default PackRat healthy/active accent is `#2BE86A`.

Recommended semantic colors:

- healthy / active: user accent, default `#2BE86A`
- warning / degraded: `#FFB34D`
- bad / offline / destructive: `#FF5D6C`
- neutral / unknown: `#8B93A1`

Rules:

1. Normalize user accents to a six-digit hex value.
2. The user accent controls healthy/active styling, not warning/error meaning.
3. Use the accent consistently on one or two stable visual anchors such as the left rail, graph, active glyph, or secondary value.
4. Changing the accent in the Property Inspector must save, persist after reopening, and force the key to rerender.
5. Do not hardcode a second "healthy green" in one action while the rest use the user accent.

Implementation convention for new plugins:

- setting key: `accent`
- default constant: `DEFAULT_ACCENT = "#2BE86A"`
- one shared `normalizeAccent(...)` helper
- pass the normalized accent into the renderer instead of reading settings inside every glyph/action
- keep warning/error colors semantic and independent of the accent

This naming convention makes the accent path easy to find during later maintenance.

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

If a validated Stream Deck plugin contains bundled profiles, `rat dev <slug>` opens a profile for import by default after linking the development plugin.

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
