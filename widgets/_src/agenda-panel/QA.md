# Calendar Panel QA

Status: RELEASE READY

Product: Calendar Panel
Slug: `agenda-panel`
Branch: `product/agenda-panel`
Pull request: `#15`
Version: `1.0.1`
Author: `PackRat 🐀`

## Product behavior contract

* No OAuth.
* Up to three ICS feed URLs, stored only as iCUE textfield properties.
* Direct feed fetch first, Packrat stateless HTTPS relay fallback second when browser CORS blocks readable access.
* `webcal://` feeds are accepted and normalized to HTTPS for transport.
* Cached parsed event data may persist per widget instance, but secret feed URLs are never copied into localStorage.
* Time scaled day timeline uses actual local day start and next day start, so 23 hour and 25 hour DST days do not assume 1440 minutes.
* All day events use date only semantics and exclusive DTEND.
* Recurring events expand within bounded safety limits and honor RDATE, EXDATE, RECURRENCE ID overrides, cancellation, COUNT and UNTIL through the exact Calendar Sync ical.js runtime.
* IANA TZID, UTC, floating local time, and embedded VTIMEZONE STANDARD/DAYLIGHT rules are resolved before local display.
* Concurrent events are lane packed. Overflow collapses instead of shrinking touch targets below useful size.
* Small and portrait slots use chronological agenda compositions rather than a compressed 24 hour axis.
* Multiple configured calendar feeds refresh in parallel.
* A downloaded malformed feed or exhausted direct-plus-relay transport failure is reported as FEED ERROR. No companion purchase state exists.

## Calendar Sync provenance

The supplied Calendar Sync Pro archive was inspected directly. Its TypeScript source imports the shared `_calendar` implementation rather than containing that sibling TypeScript tree, but its built plugin contains the compiled shared calendar behavior and its dependency tree contains the exact ical.js 2.2.1 runtime used by production Calendar Sync.

Calendar Panel ships that exact ical.js 2.2.1 runtime as its primary parser. The source is stored deterministically as a gzip plus base64 payload split across `ical-pack-01.js` through `ical-pack-08.js`; `ical-loader.js` restores the exact browser source locally before parsing. `agenda-ical.js` ports the recovered Calendar Sync behavior for VTIMEZONE registration, recurrence masters and exceptions, occurrence detail resolution, safety bounds, UID plus occurrence-start dedupe, IANA timezone fallback, and cancellation handling.

The product-local parser in `agenda-core.js` plus `agenda-recur.js` remains only as a resilience fallback if the exact ICAL runtime cannot initialize.

## Product-local automated checks

PASS: canonical `tools/xeneon/inline.py agenda-panel` generated self contained shipping HTML.

PASS: exact Calendar Sync ICAL regression fixtures cover exclusive all day DTEND, recurrence COUNT, EXDATE, moved RECURRENCE ID exceptions, RDATE at a different clock time, cancellation, IANA timezone conversion, and embedded non IANA VTIMEZONE rules.

PASS: fallback parser regression fixtures cover all day exclusivity, recurrence exceptions, IANA timezone conversion, and DST wall time.

PASS: deterministic browser audit across all eight official XENEON sizes: 840x344, 696x416, 840x696, 696x840, 1688x696, 696x1688, 2536x696, and 696x2536.

PASS: zero document overflow, zero runtime or console errors, no visible interactive target below the tested 44 px floor, no offscreen visible interaction, and descender heavy hero copy remains inside its card.

PASS: horizontal M, L, and XL render time scaled event blocks. Small horizontal and all portrait slots render the chronological touch agenda instead of compressing the timeline.

PASS: hero today versus next three days toggle, event detail open and close, and iCUE initialization/data update lifecycle callbacks.

PASS: appearance-only iCUE property changes render immediately without refetching calendar data. Calendar URL changes trigger a refresh.

PASS: failure state matrix covers unconfigured, empty valid feed, stale cache fallback, direct-to-relay fallback, transport failure, malformed feed, partial multi-calendar failure, parallel refresh, and secret URL localStorage privacy.

PASS: current `manifest.json` contains the required Widget API 1.4.0 manifest fields for this product and targets Windows `dashboard_lcd` with `interactive: true`.

PASS: marketplace language claim is English only until all dynamic runtime copy is localized.

## Canonical GitHub vendor and shipping gates

PASS: `XENEON Widget CI` resolved `agenda-panel` from PR #15.

PASS: canonical shipping HTML generation on the Windows runner.

PASS: official CORSAIR `icuewidget-cli@0.4.47 validate`.

PASS: official CORSAIR `.icuewidget` package creation.

PASS: generic `tools/xeneon/streamspell.mjs` verified that exact official package across all eight XENEON presets.

PASS: deterministic Rat Art captured the real widget at all eight native slots and rendered the complete marketplace image set from product-local `rat-art.mjs` and `rat-art.json`.

PASS: Rat Ship rebuilt and revalidated the canonical widget, captured real product art, rendered the search icon, built the Maker Console `SHIP_KIT`, passed the Playwright driver preflight, and passed final ship invariants.

PASS: RatPack Context CI.

Latest fully green workflow head used for these gates: `9c9934f4a10c3bfc8fb99031ab343c2be25ed660`.

Latest inspected official package SHA256: `a80e987fbe763b8c9854718351bd3cd324d16cb5abec0b15cf01dd0a453a84a5`.

## Release artifacts

The canonical workflows produced:

* Official `agenda-panel.icuewidget`.
* StreamSpell evidence for all eight presets.
* Eight native widget captures.
* Five 1920x960 deterministic marketplace images plus contact sheet and Rat Art report.
* Search icon.
* Maker Console `SHIP_KIT` with package, marketplace images, paste-ready metadata, description, release notes, checklist, and local stage/submit helpers.

## Compatibility note

See `NEEDS.md` for the standalone relay contract. Calendar Panel is independent: direct-CORS-compatible feeds load directly and providers that block browser CORS fall back automatically to Packrat's stateless HTTPS relay.
