# Stream Deck Key Visual Standard v1

This is the canonical PackRat standard for Stream Deck action faces and bundled profile keys.

The problem this standard prevents is simple: a design can look acceptable in source art or a large screenshot and still be bad on a physical Stream Deck key. The real product is the small key.

## Scale is the truth

Judge every key at:

- 72 x 72 pixels, which is the practical key-face design target
- 36 x 36 pixels, as a reduced visibility stress test
- the actual Stream Deck editor or hardware when final host behavior matters

Do not approve a key because the 144 x 144 source SVG looks clean when zoomed in.

The primary action or live value must remain obvious at a glance. If the user needs to read around background art to understand the key, the hierarchy is wrong.

## Preferred visual patterns

### 1. Icon-led action

Use one large semantic glyph with strong contrast.

Good fit:

- brightness
- contrast
- volume
- mute
- power
- input
- record
- stop
- play
- window movement
- simple toggles

Default behavior:

- dedicated action-specific key image
- one dominant glyph
- `ShowTitle: false` when the icon is sufficient
- use tooltip and Property Inspector copy for the long explanation, not the key

Reference pattern: Audio Manager Pro uses large dedicated glyphs on a dark key face and does not place Stream Deck title text on top of the art.

### 2. Rendered data key

When a key needs multiple pieces of live information, render the complete key face yourself.

Good fit:

- health/status dashboards
- latency
- timers
- progress
- multi-field telemetry
- any state where label, value, status, and graph all need fixed layout

Default behavior:

- render into one 144 x 144 SVG/PNG or equivalent
- define explicit bands for label, primary value, secondary state, graph, and footer
- `ShowTitle: false`
- fit text before rendering
- never add Stream Deck title text over the rendered dashboard

Reference pattern: Internet Health Pro owns its full 144 x 144 layout, uses explicit text bands, and disables title overlay.

### 3. Text-assisted icon

Use only when a short live value or state materially improves the action.

Examples:

- `65%`
- `HDR\nON`
- `240HZ`
- `MUTED`
- `INPUT 1`

Rules:

- reserve a dedicated text band
- keep the primary glyph outside that band
- prefer bottom or top alignment
- never use middle-aligned Stream Deck title text over a meaningful illustration
- the action name itself usually does not belong on the key

## Mandatory hierarchy rules

1. One dominant subject per key.
2. Prefer the action itself over a picture of the device being controlled.
3. Do not reuse a generic monitor, keyboard, window, or computer illustration behind unrelated action labels when a semantic icon can be used.
4. Do not place long text over the primary glyph.
5. Do not rely on tiny background detail for meaning.
6. Do not make the key name compete with the state or value.
7. Dynamic actions should show meaningful feedback when possible, such as ON, OFF, N/A, current percentage, current mode, or current status.
8. Unsupported hardware should look unsupported, not like a valid zero value.
9. Bundled profile generation must preserve the same visual hierarchy as the plugin actions.
10. If a label needs a sentence, it belongs in the tooltip or Property Inspector.

## Geometry baseline

For a 144 x 144 source key:

- keep essential content at least 12 px from the edge
- aim for the main glyph to occupy roughly 60 to 95 px of the source canvas
- use bold simple geometry
- prefer strokes around 7 to 10 px for the main symbol
- avoid hairlines and decorative detail that disappears at 72 x 72
- if a text band is required, reserve it before drawing the glyph

These are defaults, not a reason to force every icon into identical geometry. The test is physical readability.

## Text baseline

Prefer:

- one short value
- one short word
- two very short lines

Avoid:

- full action names such as `MONITOR BRIGHTNESS`
- labels that repeat what the glyph already says
- three or more lines
- long words squeezed over an illustration
- font sizes chosen only because they technically fit

For Stream Deck-managed titles, default to `ShowTitle: false`. If a title is necessary, use a text-safe top or bottom band and keep it short.

For fully rendered keys, render the text inside the image and keep `ShowTitle: false`.

## Contrast baseline

Primary information must have strong contrast against the key background.

Recommended PackRat utility pattern:

- near-black background
- white primary glyph/text
- one bright accent for active state
- muted gray only for secondary information
- red/orange for warning or failure only when semantically appropriate

Do not make the most important thing on the key the lowest-contrast element.

## State design

A button should answer at least one of these instantly:

- What will happen if I press this?
- What state is this in now?
- What value will this set?
- Did the last action succeed?

When the hardware can report state, show it. When state is unknown, show `?`, `N/A`, or another honest state rather than leaving the key visually blank.

## Generated profile rule

Profile builders are part of the UI pipeline.

Do not generate a clean plugin manifest and then add long middle-aligned labels in `build-profiles.*`.

Profile actions should inherit:

- the same action-specific image
- the same text policy
- the same state/value formatting
- the same safe text band

Generated profile variants must be checked at their real device grid sizes.

## Reuse research

The current PackRat catalog shows three useful lessons:

- Audio Manager Pro is the strongest icon-led reference: dedicated semantic glyphs, high contrast, large subject, no title overlay.
- Internet Health Pro is the strongest rendered-data reference: complete key composition with explicit label/value/graph/footer regions and no Stream Deck title overlay.
- Macro Recorder Pro demonstrates the value of simple dedicated record/stop/play glyphs, but long or middle-aligned profile titles should not be copied as the future default.

Do not copy legacy visual debt just because another product shipped with it.

## Required QA

For each new or materially changed Stream Deck plugin:

1. Build the exact shipping key assets.
2. Run:
   `node tools/qa/streamdeck-key-visual-audit.mjs <path-to-.sdPlugin>`
3. Review every primary action at 72 x 72.
4. Review a 36 x 36 reduction.
5. Check representative live states.
6. Check bundled profile versions separately.
7. Reject any key where text overlaps the main art, the main subject feels tiny, or two unrelated actions are hard to distinguish.

A visual defect found repeatedly on hardware should be converted into a repository rule, validator, or regression test rather than fixed only inside one product.
