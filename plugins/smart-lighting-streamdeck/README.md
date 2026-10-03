# PackRat Smart Lighting for Hue & Govee — Stream Deck
Separate Windows Stream Deck plugin sharing the installed v1 PackRat Lighting Companion with the existing XENEON widget. The companion remains the sole Hue/Govee provider, credential and rate-limit owner. No Govee rooms are invented. The Stream Deck plugin opens an origin-less local WebSocket client to 127.0.0.1:17486/widget using the companion's existing random pairing token and version-1 JSON protocol, leaving existing XENEON origin restrictions unchanged. No credential or token should be committed or logged.

## Setup
1. Install (or retain) the existing Windows companion: https://packrat-site.pages.dev/downloads/smart-lighting
2. Open http://127.0.0.1:17486/, connect Philips Hue and/or Govee there and copy the local pairing token.
3. Place an included profile, then enter the pairing token in the selected action's Property Inspector.
4. Choose a supported target using search. Each action persists an immutable ID; profiles intentionally leave actual device targets unassigned. Favorites use the companion's existing shared favorites.

## Build
From this product folder run `npm ci`, `npm run check`, `npm run validate`, and `npm run pack`. For canonical media use `./rat-art.ps1 -Destination <path>` on Windows; canonical `rat ship` then overwrites 02_cover.png with approved real-device photography and real runtime key art.

## Constraints
- Windows 10+, Stream Deck 7.6+, local companion 1.0.0/protocol v1.
- Power keys show actual state; preset keys keep configured values; dial shows current brightness when provider advertises it.
- Companion response protocol v1 does not correlate commands or provide scene completion acknowledgements. Scene trigger is sent; authoritative completion cannot be claimed without extending the protocol and preserving XENEON compatibility. Power/brightness/color are only marked successful when observed from the shared snapshot.
- Physical Hue, Govee and Stream Deck device behavior requires a separate operator hardware check.
- This is a release candidate. Do not submit/publish until the canonical automated gates and operator authorization.
