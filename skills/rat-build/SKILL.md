---
name: rat-build
description: Build an approved Packrat product using the platform specific canonical pipeline.
---

# Rat Build

Read `RATPACK.md`, the product validation, registry entry, matching platform reference, `standards/streamdeck-plugin-design-system-v1.md`, and `standards/streamdeck-key-visuals-v1.md` for Stream Deck products.

Dispatch by product type.

## Profile

Use the shared deterministic builder in `tools/streamdeck/profile-builder.mjs` for new profile bundles and generate the required variants from one canonical layout definition. The builder supports one-page and multi-page profiles; use a small number of workflow pages when a single surface would be crowded. Preserve one press, one action, required plugin declarations, platform key encoding, and device specific layout rules. Run structural validation after generation.

Generated profile key faces are product UI, not filler. Keep labels short, keep text out of the primary glyph area, and inherit the plugin's semantic action art instead of placing long titles over generic backgrounds.

## Plugin

Use the Stream Deck SDK project structure, lockfile, unit or fixture tests, manifest validation, Elgato CLI validation, and packaged CI artifact.

Choose a key-face pattern before implementing actions:

- Icon-led: one large semantic glyph, high contrast, with `ShowTitle: false`.
- Rendered state/preset key: compose the semantic glyph plus one or two short value/state lines into one 144 x 144 or equivalent key image and update it with `setImage(...)`.
- Rendered data key: own the complete telemetry/dashboard layout inside the image.

For PackRat Keypad actions, host-managed Stream Deck title overlays are not the product UI. Keep `ShowTitle: false` and render text inside the image in a reserved band. Preset buttons must show the preset they will set; do not repaint every preset key with one shared current value.

Do not use one generic device silhouette as the background for unrelated actions when a specific symbol can communicate the action. Brightness should look like brightness, contrast like contrast, volume like volume, power like power, and so on.

For utility-style plugins, centralize the semantic glyph map and key renderer. Preset keys show their configured target; status keys and dials may show live state. Use compact semantic mode labels instead of raw strings that can run off the key.

For Keypad plugins, run `node tools/qa/streamdeck-key-visual-audit.mjs <path-to-.sdPlugin>` as part of QA when the product layout permits. New Node SDK plugins should also run `node tools/qa/streamdeck-plugin-design-audit.mjs <plugin-source-root>` so action identity and Property Inspector transport regressions fail before hardware QA. Dashboard-style plugins that promise the standard PackRat profile bundle must add `--require-major-profiles` and cover DeviceTypes 0, 2, 7, and 9.

Before hardware QA, enforce the PackRat plugin design contract:

- stable semantic action slugs across UUIDs, source maps, icons, profiles, and tests
- full-key ownership with `ShowTitle: false`
- readable 72 x 72 hierarchy; essential text may not live in tiny footers
- paired values that matter equally must receive equal visual weight
- user accents persist and rerender healthy/active states; warnings/errors keep semantic colors
- live graphs use a short intentional visual window, normally 10-30 seconds, separate from long analytical history
- Property Inspector messages use the PI UUID as the websocket context, pass the selected key context separately when needed, and use the proven global `streamDeck.ui` transport
- Property Inspector settings must survive close/reopen and every command button must show feedback and execute
- shared polling engines are preferred over per-key pollers

Review representative keys at 72 x 72 and 36 x 36 before asking the user to find visual clipping on hardware. When the plugin bundles profiles, the normal Rat Dev pass should open the standard/MK.2 profile automatically so the profile itself is part of the same hardware review.

## Widget

Use the canonical iCUE skill. Keep authored source separate from shipping output, run inline flattening, structure checks, browser fixtures, responsive tests, functional tests, deterministic captures, vendor validation, and packaging.

## Icons

Use deterministic source icons, processing, resizing, manifest or package metadata, and asset QA.

Do not route nonprofile products through old profile only assumptions.

Advance state only when the build contract and automated checks for that product type are satisfied.
