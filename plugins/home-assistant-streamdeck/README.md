# Home Assistant Dashboard — PackRat Stream Deck
**Status: READY_TO_SHIP.** Operator approved $9.99, final five-frame Rat Ship art, deferred physical/customer-environment QA, and disclosed global-settings token storage on 2026-10-03. Marketplace submission is not performed; public source remains in `rp-system`. The existing published XENEON Home Assistant Panel is a separate SKU.

## Product
- One shared authenticated Home Assistant WebSocket client for all visible actions.
- Live Entity Status, bounded observed numeric sensor history, three-entity Home Overview, domain-checked Smart Control and Scene/Script Trigger.
- Stream Deck + native brightness encoder for lights that advertise the service; display-only Neo Infobar.
- Four editable unconfigured profile templates: MK.2, XL, Plus and Neo. Actual customer entities must be selected after connection; never prepopulate fictitious working devices.
- Manual entity assignment in v1. Room auto-generation is deferred until genuine entity/area registry checks are implemented and permission-tested.

## Exact automated release evidence

[Canonical main Rat Ship run 37088244126](https://github.com/slayerkey/rp-system/actions/runs/37088244126) passed on source commit `943648d45202c4110971241d459152a46f909f71`: locked Windows build/tests, 65 distinct profile ActionIDs, canonical UI/key audits, official Elgato validation/package, isolated Rat Ship kit and final photographic cover/contact sheet. The separate real Home Assistant Core 2026.8.3 job tested authentication, snapshot, pushed state updates, observed history and bad-token rejection. Package SHA-256: `c1a501b0ee4f763cb1e79e1062728319e0364de6d22d3e9f1326fcb931e2ec6c`. Only art and package SHA (artifact 11260759396), not the paid binary, were uploaded publicly. Changing release metadata triggers a fresh candidate rebuild.

## Explicitly approved release risks and follow-up

- Price **$9.99** and exact final Rat Ship artwork: approved 2026-10-03.
- Physical Stream Deck (MK.2/XL/Plus/Neo) and customer-style Home Assistant smoke: **OPERATOR-ACCEPTED DEFERRAL; NOT PASSED**. Test later and address any Marketplace rejection or customer issues.
- Customer-provided Home Assistant long-lived token is stored in Stream Deck **global settings, not OS secure credential storage**. Disclosed in the Marketplace description; the operator accepted this limitation on 2026-10-03. Never log credentials or embed them in profiles. Only Windows is advertised.

## Canonical Rat Ship workflow

Run `rat kit home-assistant-streamdeck` for nonpublishing preparation. When ready to initiate authenticated Maker Console submission on your PC, run `rat ship home-assistant-streamdeck`. That command can **submit**; it is not a dry run, and the user must intentionally execute it. Never equate `READY_TO_SHIP` with a claim that the plugin is already published.

## Proven component reuse
- Home Assistant native protocol and reconnection decisions from `widgets/_src/home-assistant/` and `docs/XENEON_HOME_ASSISTANT_RECOVERY_2026-08-28.md`.
- Performance Grapher bounded history, glanceable data rendering, Neo lifecycle patterns, and deterministic profile-builder infrastructure, without its hardware-specific dependencies.
- Canonical PackRat design/QA, gallery campaign and authenticated Rat Ship boundaries; no global standard was changed to excuse product defects.
