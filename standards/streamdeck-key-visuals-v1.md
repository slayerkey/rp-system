# Stream Deck Key Visual Standard v2

This is the canonical PackRat standard for Stream Deck action faces and bundled profile keys.

For the full plugin interaction contract, including Property Inspector transport, accents, telemetry cadence, major-model profile coverage, and hardware QA, also read `standards/streamdeck-plugin-design-system-v1.md`.

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

Monitor Manager's validated utility-key baseline uses a 144 x 144 source, a glyph in the upper area, one-line text around y=131, or two lines around y=112/y=136. Start near 24/20/17 px for short/medium/long compact labels and adjust only when the real 72 x 72 result demands it.

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
7. Utility keys should use one central action-slug-to-glyph map and one renderer so spacing fixes propagate everywhere.
8. Resolution/mode labels must use compact forms such as `1080P`, `1440P`, `4K`, or a short fallback.
9. Unsupported hardware shows `N/A` or `?`, never a believable fake zero.
10. Bundled profile generation must preserve `ShowTitle: false`; it may not reintroduce host title overlays.
11. Long explanations belong in the tooltip or Property Inspector.
12. An extensionless manifest asset path must resolve to exactly one canonical file. Do not ship competing `.svg`, `.png`, or `@2x` variants for the same path.
13. Action-list/category icons and key faces are different jobs. Keep action-list/sidebar icons monochrome white when required by Elgato presentation; use PackRat orange/white on the hardware key face.
14. Do not add generic decorative PackRat accent rails, bars, stripes, or corner strokes to hardware key faces. Orange must carry semantic meaning (for example a +, active state, warning-safe highlight, or other intentional detail), not exist as repeated branding furniture above/beside every glyph.
15. Runtime-generated key images are authoritative. A correct fallback SVG does not excuse stale runtime colors, tiny runtime text, or a different runtime layout.

## Geometry baseline

For a 144 x 144 rendered source:

- keep essential content at least 10-12 px from edges
- use simple bold geometry and high contrast
- avoid decorative detail that disappears at 72 x 72
- never reserve top/side space for a generic orange accent rail; give that space back to the semantic glyph/text
- for data cards, start around 15-17 px for the label, 29-38 px for the primary value, and 13-16 px for secondary values
- footer text is optional; never hide essential information in micro-copy
- if two values are equally important, use a dedicated equal-weight layout instead of shrinking one into a footer
- size text from the longest real label/state you actually ship; use the largest readable size that fits the reserved safe region instead of a fixed tiny font
- if the longest label forces unreadably small type, shorten the customer-facing label or split it into at most two intentional lines rather than allowing overflow
- for live graphs, use a dedicated 10-30 second visual window rather than compressing long analytical history into the key

## References

- Audio Manager Pro: strong semantic action glyphs.
- Internet Health Pro: strong full-key renderer and explicit layout regions.
- Monitor Manager Pro: regression reference for why host title overlays are not accepted; the runtime now renders its own glyph + bottom text band.
- Macro Recorder Pro: simple record/stop/play glyphs are good; legacy host-managed profile titles are not the future default.

## Required QA

For each new or materially changed Stream Deck plugin:

1. Build exact shipping assets.
2. Run `node tools/qa/streamdeck-key-visual-audit.mjs <path-to-.sdPlugin>`.
   The shared audit also rejects ambiguous extensionless key/icon assets so Stream Deck cannot silently choose an outdated PNG over the intended SVG.
3. The audit must fail if a Keypad state does not explicitly set `ShowTitle: false`.
4. Review representative runtime-rendered states at 72 x 72 and 36 x 36.
   Include the longest label, two-line state, error/N-A state, configured preset, and at least one live/dynamic state when those exist.
5. Review bundled profile output separately. For dashboard-style plugins that promise major-model profiles, use `--require-major-profiles`.
6. Verify user accents render consistently in healthy/active states while warning/error colors keep semantic meaning.
7. Reject keys with collisions, tiny subjects, ambiguous presets, raw overlong resolution strings, unequal treatment of paired values, or generic shared artwork.

When hardware review finds a recurring visual defect, convert it into a repository rule or regression test.
