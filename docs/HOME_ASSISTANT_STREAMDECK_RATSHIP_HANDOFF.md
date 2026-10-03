# Home Assistant Stream Deck — canonical Rat Ship handoff

Owner authorized public source in `slayerkey/rp-system/plugins/home-assistant-streamdeck/`. The separate XENEON `home-assistant` widget is unchanged.

## Verified automation
[Exact-source green GitHub Actions run](https://github.com/slayerkey/rp-system/actions/runs/37086074174) on commit `e0316938af4812cdb31da1b98c34901974424b91` passed Windows build/tests, canonical PI design audit, major-model visual/profile audit, official Elgato CLI validation/packaging, an isolated full Rat Ship kit with deterministic galleries and final photo cover/contact sheet. Real HA Core 2026.8.3 job passed the actual shared WebSocket transport smoke. Package SHA-256 `16dc3064fc14d52e14f26c1f4e0ca31ac8aa7540342aa7c7267bef1fa539e641`. Public [safe review art artifact](https://github.com/slayerkey/rp-system/actions/runs/37086074174) id `11261045209`; intentionally no public paid-package artifact.

## Manual release checks
Product is `READY_FOR_HARDWARE_QA`, *not* `READY_TO_SHIP`. Review exact final `02_cover.png` and contact sheet; perform/explicitly defer actual hardware and customer Home Assistant smoke; approve the candidate $9.99 price or select another amount. Current long-lived access token storage is host-managed Stream Deck global settings, not OS keychain: disclose clearly or improve before public release.

Once these are closed, record truthfully in `products/home-assistant-streamdeck.json`, `plugins/home-assistant-streamdeck/submission.json` and `products/index.json`, merge canonical main, preview via `rat preview-art home-assistant-streamdeck`, and only after explicit operator authorization run `rat ship home-assistant-streamdeck`. Never treat `rat ship` as a nonpublishing command or fabricate hardware success.
