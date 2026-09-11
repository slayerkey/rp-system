# Calendar Panel compatibility and provenance notes

## Calendar Sync parser provenance

The original handoff required porting the working Calendar Sync parser instead of inventing a weaker calendar engine. The supplied Calendar Sync Pro project confirmed that its TypeScript layer imports the real parser from the missing sibling `plugins/_calendar/src/` tree.

The upload also supplied the exact ical.js 2.2.1 dependency and a built `plugin.js` containing the compiled shared parser behavior. Calendar Panel ships that exact ical.js runtime as its primary parser using a deterministic product-local gzip plus base64 representation. `agenda-ical.js` ports the recovered production behavior for VTIMEZONE registration, recurring masters and exceptions, occurrence detail resolution, safety bounds, dedupe strategy, timezone fallback, cancellation handling, and `webcal://` normalization.

The original `_calendar` TypeScript wrapper remains absent from canonical GitHub. If it is later migrated, compare it fixture for fixture for provenance and maintenance consolidation. Its absence is not a Calendar Panel release blocker because the exact production parser dependency and compiled behavior are present and tested.

## Standalone ICS transport

XENEON widgets run from a `file://` origin and browser CORS applies. Some calendar providers return valid secret ICS feeds without `Access-Control-Allow-Origin`, so a direct widget fetch cannot reliably read every provider.

Calendar Panel remains a standalone paid XENEON product. It does not require Calendar Sync Pro, a Stream Deck plugin, or another paid companion.

Transport order:

1. Try the configured ICS feed directly from the widget.
2. If browser CORS or transport prevents a readable response, POST the feed URL to Packrat's stateless Cloudflare Pages relay at `https://packrat-site.pages.dev/api/calendar-feed`.
3. The relay fetches the ICS server-side and returns the raw calendar body with CORS enabled for the XENEON widget.
4. Calendar parsing always remains inside Calendar Panel so direct and relayed feeds use the same behavior.

Relay privacy and safety contract:

* The secret ICS URL is sent in the POST body, not in the relay query string.
* The relay does not cache or application-log calendar URLs or calendar bodies.
* Responses are `Cache-Control: no-store`.
* Only HTTP/HTTPS targets are accepted after `webcal://` normalization.
* Localhost, private-network, link-local, metadata, and private redirect targets are rejected.
* Calendar responses are capped at 2.5 MB and must contain a VCALENDAR payload.

This removes the former cross-product dependency while preserving compatibility with providers that block direct browser access.

## Rat Art and Rat Ship

No Calendar Panel shared-tool blocker remains here.

The current canonical art pipeline uses product-local `rat-art.mjs` for deterministic fixture setup and product-local `rat-art.json` for marketplace copy and composition choices. Calendar Panel now supplies both files. Rat Art successfully captured all eight native widget slots and rendered the full marketplace image set.

Rat Ship successfully rebuilt the widget, ran official CORSAIR validation and packaging, captured and rendered art, rendered the search icon, built the Maker Console ship kit, passed driver preflight, and passed final ship invariants.

## Network host policy

The current Widget API manifest does not define a `network_hosts` field. Calendar Panel therefore does not invent one in the product manifest. User-supplied calendar hosts are handled as configured ICS URLs, with loopback `127.0.0.1` used only for the optional companion bridge fallback.
