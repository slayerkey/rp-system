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
3. Confirm the Lite starter profile is intentionally just **EMAIL +** and **CLIP +**.
4. Confirm Pro opens with a **QUICK** page containing **EMAIL +, CLIP +, TIME, DATE, ADDRESS, LINK**, followed by the deeper workflow pages.

## First-run happy path

Do this before any deeper variable testing.

1. Add **Insert Snippet** to a key. Confirm there is no second visible Manage Snippets action in the actions list.
2. In the Property Inspector click **Create / edit snippets**.
3. Click **New**, name the snippet `TEST`, enter `hello world`, and click **Save**.
4. Confirm `TEST` immediately appears in the Snippet selector.
5. Select `TEST`, focus Notepad, and press the Stream Deck key.
6. Confirm exactly `hello world` is inserted.
7. Edit `TEST` to `hello again`, save, press the same key, and confirm the updated text is inserted.
8. Restart Stream Deck software and confirm `TEST` still exists and still inserts correctly.
9. Confirm **Insert method** reads **Smart (recommended)**, **Type text**, and **Paste with clipboard**. There should be no old `Unicode typing` or `Clipboard paste + restore` wording.
10. Confirm the legacy hidden library action, if already placed from an earlier dev build, no longer blocks access to editing: selecting it shows the inline snippet editor.

## Insertion matrix

For each target, focus a normal editable text field and press an Insert Snippet key.

| Target | Unicode typing | Clipboard mode | Multiline | Emoji/Unicode | Result |
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
const text = "{not-a-variable}";
```

Verify no text is executed as a command, URL, script, or shell expression.

## Lite variables

Verify at press time:

- `{date}` resolves to the current local date.
- `{time}` resolves to the current local time.
- `{clipboard}` inserts the current text clipboard.
- `{app}`, `{username}`, and other Pro-only tokens remain literal in Lite.
- Lite refuses an 11th saved snippet and preserves the existing 10.

## Pro variables

Verify:

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
