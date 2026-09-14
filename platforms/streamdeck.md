# Stream Deck Platform

## Plugins

Canonical development path:

source -> dependency install -> build -> unit and fixture tests -> manifest validation -> Elgato CLI validate -> Elgato CLI package -> artifact -> physical device validation.

The browser workflow can author and update plugin source. GitHub Actions is the preferred clean runner for dependency installation and packaging.

Do not rename published plugin UUIDs.

Use `standards/streamdeck-plugin-design-system-v1.md` and `standards/streamdeck-key-visuals-v1.md` as the canonical visual/interaction contract. Normal product work treats those standards as read-only.

Before local hardware QA, run:

- `node tools/qa/streamdeck-plugin-design-audit.mjs <plugin-source-root>`
- add `--require-canonical-pi` when the canonical PackRat Property Inspector is expected
- add `--require-lite-pro-upsell` for a Lite/free product with a direct Pro counterpart
- `node tools/qa/streamdeck-key-visual-audit.mjs <path-to-.sdPlugin>`

A manifest extensionless asset path must resolve to one unambiguous file. Do not leave competing SVG/PNG/@2x candidates. Review runtime-generated key states as well as fallback manifest assets.

## Profiles

The existing deterministic Python builder can create standard, XL, Plus, VSD, Windows, and Mac output without the target operating system being present.

VSD means Virtual Stream Deck and is an 8 by 8 product target.

Final import validation remains a Stream Deck application and hardware check.

## Icons

Use approved deterministic icon sources and generators. Existing house rules prefer real icon libraries and prohibit AI generated key icons for the product itself.

Action-list/category icons and hardware key faces are separate surfaces: action-list/sidebar icons stay monochrome white where Elgato presentation requires it; hardware key faces use the PackRat dark/white/orange system and must remain readable at 72 × 72.

Large product media libraries should not be copied into the system repository merely to make context portable.
