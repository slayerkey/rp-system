# Text Expander Lite / Pro — Real Windows Smoke

Run this against the exact candidate that passed `npm run qa` and official Elgato CLI validation/package.

## Environment record

Record:

- Windows version
- Stream Deck software version
- device model
- candidate commit
- Lite/Pro package hash
- test application versions where relevant

Do not mark this smoke PASS if the tested candidate differs from the package intended for Marketplace.

## Setup

0. For normal hardware iteration run `rat dev text-expander` and `rat dev text-expander-pro`. Rat Dev now resolves the shared source to each edition's exact `ship_plugin_dir`. For the final combined release identity check, `scripts/hardware-smoke.ps1 -Edition both` remains available.
1. Confirm Text Expander Lite and Pro link as separate plugin UUIDs and do not replace each other.
2. When testing the packaged Marketplace candidate, confirm the correct device-specific starter profile imports on Standard/MK.2, Mini, XL, Stream Deck +, and Neo where hardware is available.
3. Confirm the Lite starter profile contains **EMAIL +, CLIP +, LIBRARY**.
4. Confirm Pro opens with a **QUICK** page containing **EMAIL +, CLIP +, TIME, DATE, ADDRESS, LINK, LIBRARY** on Standard/MK.2, XL, Plus, and Neo. Mini keeps QUICK at six keys and places **LIBRARY** on EMAIL because the 3×2 QUICK grid is full.

## First-run happy path

Do this before any deeper variable testing.

1. Confirm the actions list exposes both **Insert Snippet** and **Full Library**. Pressing Full Library should open the local dashboard.
2. In the Property Inspector click **Open snippet library**.
3. Click **New snippet**, name the snippet `TEST`, enter `hello world`, and click **Save changes**.
4. Confirm `TEST` immediately appears in the Snippet selector.
5. Select `TEST`, focus Notepad, and press the Stream Deck key.
6. Confirm exactly `hello world` is inserted.
7. Edit `TEST` to `hello again`, save, press the same key, and confirm the updated text is inserted.
8. Restart Stream Deck software and confirm `TEST` still exists and still inserts correctly.
9. Confirm **Insert method** reads **Smart (recommended)**, **Type text**, and **Paste with clipboard**. There should be no old `Unicode typing` or `Clipboard paste + restore` wording.
10. Confirm Pro shows **Open full library dashboard ↗** under Dynamic text. Open it, change a reusable variable, save, and confirm the change is available on the next insertion.
11. Press the bundled **LIBRARY** hardware key and confirm it opens the same full local dashboard.
12. Delete the snippet currently assigned to a placed key. Confirm the key automatically falls back to a valid remaining snippet, persists that repaired selection, and still works when pressed instead of showing a stale-ID alert.

## Insertion matrix

For each target, focus a normal editable text field and press an Insert Snippet key.

| Target | Type text | Clipboard mode | Smart multiline/tab fallback | Emoji/Unicode | Result |
| --- | --- | --- | --- | --- | --- |
| Notepad | required | required | required | required | |
| Browser text field | required | required | required | required | |
| Discord message box | required | required | required | required | |
| Multiline editor | required | required | required | required | |
| Code editor | required | required | required | required | |

Use test content containing:

```text
PackRat αβγ 🙂
line two	with a tab
https://example.invalid/?a=1&b=<tag>
const text = "{{not-a-variable}}";
```

In Pro, doubled braces intentionally produce literal single braces so the final inserted code contains `{not-a-variable}` instead of opening a fill-in prompt. Verify no text is executed as a command, URL, script, or shell expression.

For **Smart**, confirm the multiline/tabbed sample chooses clipboard insertion rather than treating Enter/Tab as submit/navigation keystrokes. For explicit **Type text**, confirm line breaks/tabs do not accidentally submit a chat message or move focus; if a protected target blocks synthetic text, use the documented Clipboard fallback.

## Lite variables

Verify at press time:

- `{date}` resolves to the current local date.
- `{time}` resolves to the current local time.
- `{clipboard}` inserts the current text clipboard.
- `{app}`, `{username}`, and other Pro-only tokens remain literal in Lite.
- Lite refuses an 11th saved snippet and preserves the existing 10.

## Pro variables

Verify:

- In the normal Property Inspector snippet editor and the Full Library dashboard, confirm the date/time presets are visible.
- Change the built-in Time snippet to **12-hour time** and confirm a live value such as `7:23 PM`.
- Change Time to **24-hour time** and confirm a live value such as `19:23`.
- Test **With seconds**, **US date**, **Readable date**, **Long date**, and **Date + time**.
- Confirm presets replace the single token on the built-in Time/Date/Stamp snippets, but insert at the caret for a normal custom snippet.

- `{date}`, `{time}`, and `{datetime}`
- custom format such as `{datetime:YYYY-MM-DD HH:mm:ss}`
- `{clipboard}`
- `{username}`
- `{computer}`
- `{app}` reports the foreground process captured when the key was pressed
- `{counter:test}` advances exactly once per successful insertion
- rapid repeated presses produce unique sequential counter values
- `{cursor}` is removed and leaves the caret at the intended position
- reusable variables resolve from the local manager
- an empty reusable variable resolves to empty text without crashing
- unavailable app context resolves safely to empty text

## Fill-in templates

Use:

```text
Hi {name},

Thanks for reaching out about {topic}.

{response}
```

Verify:

1. Pressing the key opens the local fill-in page.
2. Empty required fields are rejected.
3. Submit returns focus to the previously active app and inserts the completed text.
4. Cancel inserts nothing.
5. Cancel does not advance counters.
6. Reusing the same one-shot form after submit/cancel is rejected.
7. Let one form expire and confirm it cannot insert afterward.

## Clipboard restoration

Prepare clipboard contents that are easy to recognize.

1. Use a snippet large enough to trigger Auto clipboard mode.
2. Insert it.
3. Paste again manually and confirm the original clipboard content was restored.
4. Repeat with explicit Clipboard mode.
5. Repeat with non-text clipboard content where practical, such as copied image/file data.
6. If Windows or the target application prevents restoration, confirm Text Expander shows an alert and does not claim restoration succeeded.

## Huge snippet

Insert a snippet of at least 50,000 characters containing Unicode and multiple lines.

Pass when:

- the application remains responsive
- the full text arrives in order
- no part is interpreted as a command
- Auto chooses the clipboard fallback
- the original clipboard is restored where Windows allows

## Restart and corrupt-library recovery

1. Create/edit snippets, restart Stream Deck, and confirm persistence.
2. Back up the local Text Expander AppData folder.
3. Corrupt `library.json`.
4. Restart.
5. Confirm the corrupt file is quarantined as `library.corrupt-<timestamp>.json`.
6. Confirm a valid backup is restored when present, otherwise generic defaults are regenerated.
7. Confirm no private or PackRat operator data appears in regenerated defaults.

## Synthetic-input blocked application

Test one application or protected field known to reject synthetic keyboard input.

Pass when:

- failure is safe and does not execute anything else
- explicit Clipboard mode is available as the documented fallback
- if paste is also blocked by application policy, Text Expander fails visibly rather than claiming success

## Final result

Record one of:

- **PASS** — all required checks succeeded against the exact release candidate.
- **BLOCKED** — an environment/application policy prevented a required test; record exact evidence.
- **FAIL** — product behavior is wrong; add an automated regression before rebuilding the candidate.
