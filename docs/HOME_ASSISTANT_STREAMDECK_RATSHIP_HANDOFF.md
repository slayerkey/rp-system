# Home Assistant Stream Deck — Rat Ship integration

This public controller contains ONLY release-safe product registration and proposed Marketplace copy. The actual candidate source is intentionally NOT here: the prior private SKU boundary and `packratEG/packrat-factory/SECURITY.md` prohibit using the owner-only factory as a product repository. No unapproved paid code or package was uploaded.

## Next dependency
Import the existing source candidate Git bundle / source ZIP into an approved **private per-SKU** source repository, retaining `plugins/home-assistant-streamdeck/`. Record the exact source commit and add the private CI job for `npm ci`, `npm test`, `npm run build`, canonical plugin design audit `--require-canonical-pi`, key audit `--require-major-profiles`, official `streamdeck validate` and `streamdeck pack`. The packaged binary/SHIP_KIT must never be uploaded by this public repository's Actions.

After private CI and actual Home Assistant integration checks pass, pin the private release artifact to `products/home-assistant-streamdeck.json` (immutable source commit, CI run/artifact, package SHA256 and gallery paths), align the submission version and explicitly approve price. Then run `rat preview-art home-assistant-streamdeck` to inspect final 02_cover.png and contact sheet, and finally `rat ship home-assistant-streamdeck` in non-publishing review mode; do not submit or publish without owner authorization.

TESTING means 31 local fixture and art-contract checks passed; it does NOT represent validated Elgato packaging, physical Stream Deck, a real HA server or a finished Marketplace campaign.
