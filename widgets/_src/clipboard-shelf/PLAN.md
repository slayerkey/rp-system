# Clipboard Shelf plan

## Product goal

Clipboard Shelf turns XENEON Edge into a readable, touch-first shelf for recent Windows text clipboard history. It is a new XENEON product, not a port of the local-only Stream Deck Clipboard Manager source.

## Architecture decision

The shipping widget does not use navigator.clipboard for history capture. Browser clipboard reads are permission and activation constrained, and the iCUE widget platform does not expose a documented clipboard provider. Continuous history is owned by a minimal Windows companion.

Live path:

1. Windows sends WM_CLIPBOARDUPDATE to the PackRat Clipboard Shelf Bridge.
2. The bridge reads Unicode text only, deduplicates it, applies the configured history limit, and persists local state with Windows DPAPI.
3. The bridge exposes a loopback-only WebSocket at ws://127.0.0.1:17485/ws.
4. First-run pairing uses a locally generated DPAPI-protected code. The bridge sends no clipboard snapshot until the widget authenticates with that code.
5. The XENEON widget renders normalized text previews and sends narrow commands for copy, pin, favorite, delete, clear, private mode, and history limit changes.
6. The companion self-installs under the current user's LocalAppData folder and registers per-user startup so history works after reboot.
7. After the complete release gate passes, the free companion ZIP is published as a versioned GitHub Release so Marketplace customers have a stable download.
8. No cloud, PackRat server, account, or remote synchronization exists.

The loopback protocol requires the fixed application subprotocol packrat-clipboard-shelf-v1-a91f6c, per-user pairing authentication, and exact local-origin checks. The health endpoint never returns clipboard text or the pairing token.

## v1 scope

Text only. No images or files.

Features:
- readable recent text cards
- tap a card to make it the current Windows clipboard value
- current-copied highlight that clears when Windows switches to non-text clipboard content
- pinned entries protected from normal history pruning
- independent favorites
- URL recognition and link filter
- search on medium and larger layouts
- individual delete and clear-all confirmation
- configurable unpinned history limit
- Private Mode that pauses new capture and hides existing card contents on XENEON
- bridge offline/reconnect state
- local-only encrypted-at-rest persistence

## Layout strategy

All eight official XENEON compositions are explicit:
- S horizontal: two compact columns, filter rail, no search box
- S vertical: two compact columns, filter rail, no search box
- M horizontal: three columns with search
- M vertical: two columns with search
- L horizontal: four columns with search
- L vertical: two columns with larger cards
- XL horizontal: six columns with search and wider status treatment
- XL vertical: two columns with larger cards

Primary text and touch targets are protected before secondary metadata. Long text wraps safely and is line-clamped inside cards instead of shrinking.

## Privacy behavior

Private Mode is manual and deterministic: capture pauses and existing history text is hidden on the XENEON surface until disabled. It is not marketed as password detection.

Clipboard text is never sent to PackRat, cloud storage, analytics, CI logs, or the health endpoint. Persisted bridge state and its per-user pairing code are protected with Windows DPAPI. The bridge does not expose history until the widget authenticates.

## Release honesty

Physical XENEON Edge validation is not claimed. Release candidate status requires the hardware-free PackRat XENEON gate plus Windows companion build/self-test.
