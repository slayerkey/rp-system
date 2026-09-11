# XENEON Home Assistant recovery — 2026-08-28

## Trigger

A real iCUE user reports that Home Assistant Panel 1.0.1 accepts server/token/entity settings but does not recognize any entities across multiple domains.

The screenshot shows a LAN HTTP URL, a Long-Lived Access Token field, and a manual entity id. The token itself must never be committed, logged, or copied into QA.

## Canonical source status

`products/index.json` registers `home-assistant` / Home Assistant Panel as published, version 1.0.1.

As of this recovery, current `main` contains neither `widgets/_src/home-assistant/` nor `widgets/home-assistant/`. Repository code search and the accessible Slayerkey repository list do not reveal a separate Home Assistant source repository.

The product owner has confirmed the published Home Assistant source may exist only on the local development computer. Treat that local source as authoritative if found.

**Do not reconstruct or replace the published Home Assistant product from scratch.** The GitHub work in this recovery branch is transport research and diagnostics only. Once the transport root cause is proven, apply the smallest compatible patch to the existing local published source/package.

## Proven root cause class

The published settings guidance tells users to add `null` to Home Assistant CORS allowed origins. That strongly suggests the product calls the REST API directly from an imported `file://` widget.

A `file:` widget has an opaque web origin. Authenticated Home Assistant REST calls include an `Authorization` header and therefore require browser CORS permission before the API response can be read.

A real Home Assistant Core 2026.8.3 regression now reproduces the important behavior from an actual `file://` document:

* The Home Assistant server is reachable from the widget.
* The authenticated REST API is blocked by browser CORS under the default Home Assistant configuration.
* The native `/api/websocket` endpoint connects from the same file-origin widget.
* WebSocket bearer-token authentication succeeds.
* `get_states` returns a real seeded entity correctly.

Observed exact result:

`REST CORS is blocked, but WebSocket WORKS`

and the seeded entity returned as:

`sensor.ratpack_temperature = 72`

This is strong evidence that the customer can have a completely valid server URL, token, and entity id while a REST-only implementation still appears unable to recognize any entities.

## Recommended repaired transport

Home Assistant officially exposes `/api/websocket`.

Use the WebSocket API as the primary transport for the published panel:

1. Connect to `<server>/api/websocket` using `ws:` or `wss:` based on the configured HTTP scheme.
2. Wait for `auth_required`.
3. Send `{ "type": "auth", "access_token": token }`.
4. After `auth_ok`, issue `get_states` for the initial snapshot.
5. Subscribe to `state_changed` events for live updates instead of REST polling.
6. Use `call_service` for control actions.
7. Reconnect with bounded backoff after network loss.
8. Reconnect immediately when server address or token changes in iCUE.

This removes the fragile requirement that every user manually allow the opaque `null` REST origin and also gives the panel live push updates instead of polling.

REST can remain only as an optional diagnostic/fallback path where a named allowed origin is explicitly available. It should no longer be required for normal operation.

## Diagnostic gate

The temporary `tools/xeneon/home-assistant-diagnostic/` widget tests:

1. LAN reachability with an opaque no-CORS request.
2. REST API readability / CORS.
3. Bearer token authentication.
4. Exact entity lookup.
5. Home Assistant native WebSocket authentication + `get_states`.

The deterministic browser regression asserts that REST preflight sends an opaque origin, that Authorization is preflighted, and that WebSocket can still succeed when REST CORS is intentionally denied.

The stronger CI gate starts clean Home Assistant Core 2026.8.3, performs real onboarding, creates a temporary QA access token, seeds a real entity through Home Assistant, then runs the diagnostic from `file://`. That real-server gate passes.

No real user token is used in CI.

## Local source patch rule

When the original Home Assistant source is found on the local PC:

* Preserve the current UI, product identity, settings names, styles, and entity configuration model unless a change is technically required.
* Replace only the connection/data transport layer first.
* Do not make the customer re-enter unrelated settings.
* Remove or downgrade the old `null` CORS setup requirement once the WebSocket path is confirmed in physical iCUE.
* Add a visible connection state that distinguishes server unreachable, token rejected, connected, and entity missing.
* Test the repaired package against at least one sensor and one controllable entity before publishing.

## Security

The support screenshot exposed a real Long-Lived Access Token. The user should revoke it immediately and create a fresh temporary token before further testing. Never attach screenshots containing tokens to issues or CI artifacts.

Allowing the CORS origin `null` is broader than an ordinary named web origin. The authenticated WebSocket transport avoids requiring that setup for normal use.
