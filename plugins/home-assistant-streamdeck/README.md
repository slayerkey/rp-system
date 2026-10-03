# PackRat Home Assistant Dashboard (Stream Deck) — source candidate

**Status: source candidate only; not a validated release.** Source is intentionally not committed to the public `slayerkey/rp-system` repository or uploaded to public GitHub Actions as a paid-plugin package. Canonical Rat Ship registration is staged at rp-system PR #212. Obtain a private per-SKU destination for editable source, then validate/pin the exact artifact before shipping.

## Intent
A visually coherent, configurable Home Assistant dashboard rather than duplicating comprehensive free entity-action plugins. A single Node WebSocket transport supplies all active actions with initial discovery, real state-change events, observed rolling sensor history, and domain-checked service operations. Start with manual entity configuration; *room-based auto-generation remains deferred* pending verified registry permissions and an actual HA instance.

## What is implemented
- Entity Status (1 key), Live History (numeric sensor, real observed values), Home Overview (up to 3 live entities), Smart Control (light/switch/input_boolean), Scene/Script Trigger, Stream Deck + brightness encoder, Neo Infobar (display-only).
- Four editable, **unconfigured** profile bundles (MK.2, XL, Plus, Neo); selected customer entities are never bundled. Actions show SETUP until configured.
- Shared WebSocket `/api/websocket`, `auth_required` / `auth_ok`, `get_states`, `get_services`, `subscribe_events` with `state_changed`, reconnect, and acknowledged `call_service`.
- Canonical PI context routing (`uiUuid` versus `actionContext`), save acknowledgements and protection against stale state overwriting unsaved user changes.

## Known release blockers
1. SDK dependencies are not available in the supplied offline runtime; official Elgato build/validation/packaging have **not** run.
2. Private per-SKU source repository / private GitHub Actions artifact destination must be established before uploading paid code or a paid package. Do not use the owner-only `packrat-factory` as editable product-source storage. Do not use public Actions for the binary.
3. Runtime tests use deterministic fake WebSocket and DOM fixtures, **not** a real Home Assistant server or Stream Deck device. Windows is provisionally declared; macOS is deliberately not advertised until tested.
4. Product-specific deterministic Rat Art and 15 representative runtime-key fixture generation are now implemented. Canonical full-repo art audits and the final global photographic cover/contact sheet still need to RUN and PASS. Draft geometric assets are not a Rat Art approval.
5. The long-lived token currently lives in Stream Deck plugin global settings (host-managed but not an OS keychain). Validate customer-facing disclosure or replace storage before release. No credentials appear in profiles, fixtures, logs, or art.
6. Auto room layouts require the actual Home Assistant area/device/entity registries and permissions; no invented room membership or fake default devices are shipped.

## Build inside a private repository
Copy this directory as `plugins/home-assistant-streamdeck/` and copy the included `tools/streamdeck/profile-builder.mjs` to the same path in the repo (or use the identical canonical `main` file). Supply the canonical art assets/audit scripts in their unchanged paths. Use Node 24, Python 3 and CairoSVG/Pillow for deterministic draft icon regeneration; `npm install` to generate a lockfile and check it in; then `npm test && npm run build && npm run validate && npm run pack`. Generate deterministic Rat Art using the full repository (`rat preview-art home-assistant-streamdeck`), review `02_cover.png` / `review-contact-sheet.png`, then execute canonical Rat Ship. **Do not bypass audit failures or upload the paid `.streamDeckPlugin` as a public Actions artifact.**

## References/reuse
- Recovered native Home Assistant WebSocket transport behavior from `widgets/_src/home-assistant/home-assistant.js` and `docs/XENEON_HOME_ASSISTANT_RECOVERY_2026-08-28.md`.
- Adapted the observed rolling history and key rendering patterns from Performance Grapher's `src/history.js`, `src/render.js`, Neo display layout approach from `src/neo.js`, and unmodified shared `tools/streamdeck/profile-builder.mjs`.
- Did not copy the XENEON product's identity, UI, hardware-specific telemetry or mutate existing global PackRat standards.

## Existing Rat Ship handoff

See `handoff/README-RAT-SHIP.md` in the source ZIP. The product now has `rat-art.ps1` to export its actual runtime key renderer, with the global Rat Ship pipeline responsible for the final photographed cover and campaign galleries. Public rp-system registration is staged, not merged, until the private exact-source release candidate is verified.
