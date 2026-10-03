# Home Assistant Dashboard — PackRat Stream Deck
**Status: automated release candidate passed; physical Stream Deck / operator release gates pending.** Public source is approved by the owner in `slayerkey/rp-system`. Its standalone Stream Deck SKU does not change the existing published XENEON Home Assistant Panel.

## Product
- One shared authenticated Home Assistant WebSocket client for all visible actions.
- Live Entity Status, bounded observed numeric sensor history, three-entity Home Overview, domain-checked Smart Control and Scene/Script Trigger.
- Stream Deck + native brightness encoder for lights that advertise the service; display-only Neo Infobar.
- Four editable unconfigured profile templates: MK.2, XL, Plus and Neo. Actual customer entities must be selected after connection; never prepopulate fictitious working devices.
- Manual entity assignment in v1. Room auto-generation is deferred until genuine entity/area registry checks are implemented and permission-tested.

## Exact clean automated release evidence
At source commit `e0316938af4812cdb31da1b98c34901974424b91`, [GitHub Actions run 37086074174](https://github.com/slayerkey/rp-system/actions/runs/37086074174) completed successfully: locked Windows Node build/tests, major-model profile structural checks (65 distinct action identities), canonical PI and key/profile audits, official Elgato validation and packaging, isolated canonical Rat Ship art and kit with final photo cover and contact sheet. Separate Ubuntu job confirmed shared transport against **real Home Assistant Core 2026.8.3**: authenticated snapshot, pushed state updates, observed history, rejected token. This is not a claim of physical Stream Deck/customer HA testing. Packaged candidate SHA-256: `16dc3064fc14d52e14f26c1f4e0ca31ac8aa7540342aa7c7267bef1fa539e641`. Public CI uploads **review artwork and hash only**; the paid binary is built locally by Rat Ship and is never exposed as a public Actions artifact.

## Remaining release gates
1. Inspect the **exact final Rat Ship** `02_cover.png` and `review-contact-sheet.png` (safe media artifact 11261045209). Illustrative test values in artwork are clearly labeled.
2. Physical Stream Deck hardware and a customer-like Home Assistant run are not verified. Record the results or obtain explicit operator authorization to defer; never mark deferred checks PASS.
3. Approve the price. $9.99 is an *unapproved hypothesis*; canonical product price and submission price deliberately remain null, preventing submission.
4. The user-supplied long-lived Home Assistant token is currently stored in Stream Deck plugin global settings (host-managed), **not** OS secure credential storage. Disclose that limitation, or replace it with a verified secure mechanism before public release. Never log tokens or put them in bundled profiles or art. macOS is not advertised until tested.

## Canonical Rat Ship workflow
The full workflow is in root `STREAMDECK.md`, `skills/rat-qa/SKILL.md`, `skills/rat-art/SKILL.md`, and `skills/rat-ship/SKILL.md`. Run `rat preview-art home-assistant-streamdeck` to inspect the final photo cover/contact sheet. After operator acceptance of remaining gates and canonical `READY_TO_SHIP`, use `rat ship home-assistant-streamdeck`. **That command can enter authenticated Marketplace submission; do not run it until publication/submission is authorized.** For nonpublishing preparation use `rat kit home-assistant-streamdeck` or `rat stage home-assistant-streamdeck` where available.

## Proven component reuse
- Home Assistant native protocol and reconnection decisions from `widgets/_src/home-assistant/` and `docs/XENEON_HOME_ASSISTANT_RECOVERY_2026-08-28.md`.
- Performance Grapher bounded history, glanceable data rendering, Neo lifecycle patterns, and deterministic profile-builder infrastructure, without its hardware-specific dependencies.
- Canonical PackRat design/QA, gallery campaign and authenticated Rat Ship boundaries; no global standard was changed to excuse product defects.
