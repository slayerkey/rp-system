# Stream Deck Key Visual Standard v2

This is the canonical PackRat standard for Stream Deck action faces and bundled profile keys.

A design that is readable in source art but overlaps or becomes ambiguous on a physical key is a failed UI. The real product is the 72 x 72 key.

## Non-negotiable rule: own the full key face

For PackRat keypad actions, the preferred and now default pattern is:

- render the icon and any value/state text into one key image
- set `ShowTitle: false`
- update live text with `setImage(...)`, not `setTitle(...)`

Do not depend on Stream Deck's title overlay for product UI. Bottom alignment still allows two-line text to collide with art, and the host can render fonts differently from a design preview.

The key renderer must explicitly reserve a text zone and keep the glyph out of it.

## Scale is the truth

Review every key at:

- 72 x 72 pixels
- 36 x 36 pixels as a visibility stress test
- real Stream Deck hardware/editor for final host confidence

The primary action or preset must be obvious immediately.

## Preferred patterns

### Icon-led
Use one large semantic glyph and no extra text when the action is self-explanatory.

### Rendered state/preset key
Use a large semantic glyph in the upper portion and render one or two short lines in a dedicated bottom band.

Examples: `65%`, `HDR / ON`, `240HZ`, `SAVE / PC`.

### Rendered data key
For dense telemetry, own the entire 144 x 144 layout with explicit label, value, graph and footer regions.

Internet Health Pro is the reference for this pattern.

## Mandatory hierarchy

1. One dominant subject per key.
2. Use the action itself as the icon, not a generic picture of the device.
3. No Stream Deck title overlay on PackRat keypad UI.
4. One or two short text lines maximum inside the rendered image.
5. Preset buttons show the preset they will set, not a shared current value that makes several different preset keys look identical.
6. Live dials/status keys may show the current value.
7. Resolution/mode labels must use compact forms such as `1080P`, `1440P`, `4K`, or a short fallback.
8. Unsupported hardware shows `N/A` or `?`, never a believable fake zero.
9. Bundled profile generation must preserve `ShowTitle: false`; it may not reintroduce host title overlays.
10. Long explanations belong in the tooltip or Property Inspector.

## Geometry baseline

For a 144 x 144 rendered source:

- keep the main glyph in roughly the upper 70-85 px
- reserve roughly the lower 40-50 px for one/two text lines
- keep essential content at least 10-12 px from edges
- use simple bold geometry and high contrast
- avoid decorative detail that disappears at 72 x 72

## References

- Audio Manager Pro: strong semantic action glyphs.
- Internet Health Pro: strong full-key renderer and explicit layout regions.
- Monitor Manager Pro: regression reference for why host title overlays are not accepted; the runtime now renders its own glyph + bottom text band.
- Macro Recorder Pro: simple record/stop/play glyphs are good; legacy host-managed profile titles are not the future default.

## Required QA

For each new or materially changed Stream Deck plugin:

1. Build exact shipping assets.
2. Run `node tools/qa/streamdeck-key-visual-audit.mjs <path-to-.sdPlugin>`.
3. The audit must fail if a Keypad state does not explicitly set `ShowTitle: false`.
4. Review representative runtime-rendered states at 72 x 72 and 36 x 36.
5. Review bundled profile output separately.
6. Reject keys with collisions, tiny subjects, ambiguous presets, raw overlong resolution strings, or generic shared artwork.

When hardware review finds a recurring visual defect, convert it into a repository rule or regression test.
