# Clipboard Manager Pro

`com.packrat.clipboardpro` keeps 50 recent text copies, searches the full history, pins important entries, names keys, and offers an explicit plain-text paste mode.

## Actions

| Action | Workflow |
|---|---|
| Clipboard Entry | Shows a configured recent or pinned position. Press pastes. Hold for 0.6 seconds to pin or unpin. |
| History Picker | Search and select a result in the Property Inspector. Press pastes it. Hold for 0.6 seconds to step through matches. |

The full clipboard value is stored and pasted. Preview length and custom names affect only the key face.

## Reuse and isolation

Pro imports the clipboard adapters, single watcher, paste engine, history ring, and SVG badge renderer from `../clipboard-manager/src`. The history ring has an additive limit parameter whose default remains four for Lite. The Pro plugin asks it for 50 entries.

Stream Deck global settings are scoped by plugin UUID. Pro runs as `com.packrat.clipboardpro`, while Lite runs as `com.packrat.clipboard`, so their history, pins, action settings, reset, and uninstall paths do not meet. The watcher preserves Pro-only global fields when it records a new copy.

## Plain-text behavior

Standard paste leaves the current clipboard untouched when it already contains the selected text, which preserves any rich representation still held by the source application. Plain text always rewrites the clipboard through the shared text-only adapter before pasting, removing rich formats while keeping every character. Older history entries are text-only by design.

## Safety

Empty and non-text clipboard content is skipped. Consecutive duplicates do not create repeated history rows. Display previews are truncated, but stored and pasted text is not. Pinned entries use a separate capped list and never rotate with recent history.

## Development

```powershell
npm install
npm run typecheck
npm run build
npm test
npx streamdeck validate com.packrat.clipboardpro.sdPlugin
```

Run the Lite suite separately from `plugins/clipboard-manager` to verify the four-slot contract.

## QA waivers

On 2026-08-23, the owner approved submission with these documented compatibility risks:

- Corporate DLP or antivirus tools may scrutinize applications that monitor the clipboard.
- Stream Deck includes narrower built-in text actions, while Pro is positioned around searchable history, pins, names, and explicit plain-text paste.
