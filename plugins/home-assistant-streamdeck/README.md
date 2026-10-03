# Home Assistant Dashboard — PackRat Stream Deck
**Status: READY_TO_SHIP.** Operator approved $9.99, final five-frame Rat Ship art, deferred physical/customer-environment QA, and disclosed global-settings token storage on 2026-10-03. Marketplace submission is not performed; public source remains in `rp-system`. The existing published XENEON Home Assistant Panel is a separate SKU.

## Product
- One shared authenticated Home Assistant WebSocket client for all visible actions.
- Live Entity Status, bounded observed numeric sensor history, three-entity Home Overview, domain-checked Smart Control and Scene/Script Trigger.
- Stream Deck + native brightness encoder for lights that advertise the service; display-only Neo Infobar.
- Four editable unconfigured profile templates: MK.2, XL, Plus and Neo. Actual customer entities must be selected after connection; never prepopulate fictitious working devices.
- Manual entity assignment in v1. Room auto-generation is deferred until genuine entity/area registry checks are implemented and permission-tested.

## Latest verified nonpublishing Rat Ship release evidence

[Canonical merged-main release run 37143082868](https://github.com/slayerkey/rp-system/actions/runs/37143082868), source commit `069751db2df881668529c63af4cbd76a83dea8f6`: 34/34 Node tests, 65 distinct ActionIDs across four profiles, canonical UI and key audits, official Elgato validation/package, **all 15 genuine runtime art keys through the Windows Canvas renderer**, complete canonical photo cover and four galleries/contact sheet, and live Home Assistant Core 2026.8.3 transport tests. The new media files were independently compared byte-for-byte with the previously owner-approved five-frame artwork and contact sheet. CI reference package SHA-256: `6c14ee79a71748a699e2ee57c4f764bf969c35fb525328dd157838b5db925178`. Safe public artifact: `11280799528` (media and package hash only; no public package binary). A local Rat Ship invocation always builds and verifies its own fresh package; do not substitute the CI reference hash for the local package hash.

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
