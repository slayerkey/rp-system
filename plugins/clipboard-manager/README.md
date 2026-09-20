# Clipboard Manager (Lite)

`com.packrat.clipboard`. Free tier and install anchor, the same role Better Hotkeys plays.
Four keys, four slots, holding the last four things you copied. Paid `clipboard-manager-pro`
follows once this ships, on history rather than pinned snippets (see `VALIDATION.md` for why).

One action, `com.packrat.clipboard.slot`. Each key is bound to a slot index, shows a preview of
the text in it, and pastes it on press.

## Layout

| Path | What it is |
|---|---|
| `src/clipboard/` | Reading and writing the OS clipboard, and the single background watcher. Nothing in here knows about Stream Deck except `watcher.ts`. |
| `src/paste/` | Keystroke injection for Ctrl+V and Cmd+V. Trimmed copy of `free/better-hotkeys-mouse/src/{win32,darwin}/input.ts`, following the same copy-per-plugin precedent `better-hotkeys-pro` set. Reuse it, do not write a second one. |
| `src/history.ts` | The four-slot list and its rules. Pure, so `npm run test:history` needs no Stream Deck. |
| `src/badge.ts` | Key faces as SVG strings. No canvas, no native binaries, identical on both platforms. |
| `src/actions/slot.ts` | The action itself. The only file that touches the Stream Deck action lifecycle. |

## Two platform decisions worth knowing before you change them

**Windows change detection is `GetClipboardSequenceNumber`, polled, not
`AddClipboardFormatListener`.** The listener API needs a message-only window and a running
message pump, and a Stream Deck plugin has neither. The sequence number answers the only
question the watcher asks in one call, and a tick that finds no change costs nothing else.

**macOS clipboard access is `pbpaste` and `pbcopy`, not NSPasteboard.** NSPasteboard has no
plain C entry point, so reaching it the way `src/paste/darwin.ts` reaches CoreGraphics would
mean binding `objc_msgSend` and building NSString objects by hand. macOS also publishes no
clipboard change event at all, so that side polls by content.

Non-text content is filtered at the OS layer on both platforms, before the history logic ever
sees it: `IsClipboardFormatAvailable(CF_UNICODETEXT)` on Windows, `pbpaste -Prefer txt` failing
on macOS. That is what keeps a copied screenshot out of the four slots.

## Working on it

```
npm install
npm run build
npm run test:history      # slot ordering, dedupe, cap
npm run test:badge        # every key face, including the empty states
npm run test:clipboard    # real round trip against the OS, including image and file content
npm run test:paste        # pastes into a throwaway window it creates itself
npx streamdeck validate com.packrat.clipboard.sdPlugin
python plugins/clipboard-manager/scripts/gen-icons.py
```

`npm run test:paste` injects real keystrokes, so it refuses to send anything unless its own
probe window is in front. If it cannot take the foreground it skips rather than typing into
whatever the user had open. Keep that guard.

koffi's prebuilt binaries are optional dependencies gated by os/cpu, so npm only installs the
one matching this machine. The mac ones need
`npm install --force @koromix/koffi-darwin-x64@<version> @koromix/koffi-darwin-arm64@<version>`,
and the build fails loudly if they are missing.
