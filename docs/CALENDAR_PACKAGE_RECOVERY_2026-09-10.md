# Calendar package recovery — 2026-09-10

This folder records the recovered Marketplace builds and the Calendar Panel companion fix after two independent support reports plus Discord feedback showed that Calendar Sync Pro worked on Stream Deck but did not provide the localhost bridge expected by Calendar Panel.

## Current versions

| Product | Current Marketplace baseline | Newest recovered/fixed build | SHA-256 |
| --- | --- | --- | --- |
| Calendar Sync Lite | 1.0.0.1 | 1.0.0.1 | `c5aade11acfcf7c15660c3fd4b01434224d5782e7bc872a19521c66f3d8e2f8b` |
| Calendar Sync Pro | 1.1.0.0 / Marketplace displays 1.1 | **1.1.1.0 bridge-fix candidate** | `5b11556b64f8c125c6d866d589de07731bd1979276c4b9983b576d208e7941c1` |
| Calendar Panel | 1.0.0 before this work | **1.0.1** | `71252ec1b2aae1c94ceaa028ff0980ac3b60acc7deee327e1e20f7ee48c54851` |

The original uploaded Pro 1.1.0.0 baseline hash is
`dce241a0dc56d074bcfee70b9917439b4a03d7d93d556af47bbd26bffdb9411a`.

## Which files are newest?

- **Lite:** 1.0.0.1 is the newest/current build.
- **Pro:** 1.1.1.0 is the newest build and supersedes 1.1.0.0 for the next Marketplace update.
- **Panel:** 1.0.1 is the newest build.

## Pro 1.1.1.0 bridge contract

Calendar Panel falls back to:

`GET http://127.0.0.1:38765/v1/ics?url=<encoded ICS URL>`

Calendar Sync Pro 1.1.1.0 now provides that local-only service. It also exposes:

`GET http://127.0.0.1:38765/health`

The bridge:
- binds only to `127.0.0.1`;
- accepts only HTTP/HTTPS (plus webcal normalized to HTTPS);
- does not log private ICS URLs;
- returns a generic upstream error;
- verifies the upstream response contains `BEGIN:VCALENDAR`;
- supplies CORS headers needed by the XENEON widget;
- treats `EADDRINUSE` as non-fatal.

See `plugins/calendar-pro/companion-bridge.reference.mjs`.

## Calendar Panel 1.0.1

The source is on main under `widgets/_src/agenda-panel` / `widgets/agenda-panel`.
The companion-needed state now contains a direct CTA to the exact Calendar Sync Pro Marketplace listing and uses iCUE Linkprovider to open it.

The exact 1.0.1 package was validated and retained in the GitHub prerelease tag:
`agenda-panel-v1.0.1-upload`.

## Recovery note

The historical Stream Deck Calendar source directories were missing from the canonical repository even though the products were already live. The manifests below were recovered from the actual installed/uploaded packages so product IDs and versions are no longer inferred from stale registry metadata.
