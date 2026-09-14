# Text Expander Lite / Pro — Stream Deck product plan

## Product boundary

**Clipboard Manager:** recall things the user previously copied.

**Text Expander:** insert things the user types repeatedly.

Text Expander intentionally does not keep clipboard history, browse previously copied items, pin clipboard entries, or duplicate Clipboard Manager's customer job.

## Current market verdict — 2026-09-12

The category is not empty.

The strongest direct current competitor found is **Type Deck** by Phil Ewels. Its current Marketplace/GitHub materials describe preset text insertion plus dynamic date, time, clipboard, and persistent counter variables. That means PackRat cannot justify this family as merely "the built-in Text action plus {date}."

Adjacent current Marketplace products include clipboard utilities and text-format/file tools, but they solve different jobs.

PackRat's differentiation is therefore:

- a reusable named snippet library instead of per-key static text
- a local manager that lets many Stream Deck keys reuse the same snippet
- Pro folders/categories
- Pro fill-in templates that prompt only for missing fields before insertion
- reusable local variables
- application/user/computer context where Windows can report it reliably
- named counters
- cursor placement and post-insert Tab/Enter
- Unicode/multiline/code-safe insertion with an explicit clipboard-paste fallback
- local-only data with no cloud account

References reviewed:
- Elgato Marketplace: Type Deck
- Type Deck source/docs: https://github.com/phil-ewels/streamdeck-type-deck
- Elgato Marketplace: Quick Clipboard
- Elgato Marketplace: String-Styler / Text-Format
- Elgato Marketplace: Text File Tools
- Elgato Stream Deck SDK / CLI documentation current on 2026-09-12

## Demand context

PackRat's 2026-08-29 Marketplace search snapshot records:

| Search term | 30-day popularity | exact product hits |
| --- | ---: | ---: |
| Windows | 198 | 671 |
| shortcut | 62 | 322 |
| clipboard | 60 | 69 |

These are demand/supply signals, not sales or conversion claims.

The listing may use these words only where truthful. Text Expander is Windows-only in v1, can insert clipboard text, and is a Stream Deck productivity shortcut.

## Lite / Pro split

### Text Expander Lite — Free

- maximum 10 snippets
- reusable named snippets
- inline create/edit snippet library directly in the Insert Snippet Property Inspector
- one visible Insert Snippet action; the old library action remains hidden only for compatibility
- `{date}`
- `{time}`
- `{clipboard}`
- Unicode and emoji
- multiline text, tabs, URLs, code, and special characters
- Smart insertion mode, Type text, or Paste with clipboard
- local storage only
- bundled device-specific starter profiles

Lite deliberately does **not** implement folders, custom date formats, app/user/computer variables, counters, reusable variables, fill-in template fields, or cursor placement.

### Text Expander Pro — $7.99

Everything in Lite plus:

- up to 5,000 snippets
- folders/categories
- custom date/time formatting
- `{datetime}`
- `{username}`
- `{computer}`
- `{app}`
- `{counter:name}`
- `{cursor}`
- reusable variables
- fill-in template fields such as `{name}` and `{topic}`
- optional Tab/Enter after insertion
- bundled multi-page starter profile

## Variable model

### Lite

- `{date}` -> local `YYYY-MM-DD`
- `{time}` -> local `HH:mm`
- `{clipboard}` -> current Windows text clipboard, or empty when the clipboard is not text

### Pro built-ins

- `{date}`
- `{time}`
- `{datetime}`
- `{clipboard}`
- `{username}` -> Windows account username
- `{computer}` -> Windows computer name
- `{app}` -> foreground process name captured when the Stream Deck key is pressed
- `{counter:name}` -> named local counter
- `{cursor}` -> remove marker after expansion and move the caret back after insertion

Formatted date/time tokens are supported with:

- `{date:YYYY-MM-DD}`
- `{time:HH:mm:ss}`
- `{datetime:YYYY-MM-DD HH:mm}`

Supported formatting tokens are `YYYY YY MMMM MMM MM M DD D dddd ddd HH H hh h mm m ss s A a`.

No expression language, JavaScript evaluation, shell interpolation, or command substitution is supported.

### Reusable variables and fill-in fields

Pro's manager can define local reusable variables as `name=value`. A matching token such as `{signature}` resolves directly.

Any remaining simple token in a Pro snippet, for example `{name}` or `{topic}`, becomes a required fill-in template field. Text Expander opens a localhost one-shot form, then returns focus to the previously active app and inserts the completed text.

Cancelling the form inserts nothing and does not increment counters.

Literal braces can be escaped with `{{` and `}}`.

## Text and clipboard safety

Snippet content is data.

The plugin never passes snippet text into PowerShell source, a shell command, `Invoke-Expression`, `cmd.exe`, or another evaluator.

The fixed Windows bridge receives UTF-8 snippet text as base64 JSON over stdin.

Short single-line snippets use Win32 Unicode keyboard input. Smart mode switches multiline, tabbed, and very long snippets to clipboard paste so authored line breaks/tabs are not reinterpreted as submit or focus-navigation keys, while explicit Type text remains available for direct synthetic text input.

Clipboard-paste mode:

1. captures the existing Windows clipboard data object where practical
2. temporarily places the expanded Unicode text on the clipboard
3. sends Ctrl+V
4. restores the previous clipboard data object
5. reports an alert if restoration fails

Applications can block synthetic input or paste by policy. The plugin cannot truthfully guarantee insertion into such an application; this remains a real-host QA boundary.

## Persistence and recovery

Library files live under the current user's AppData PackRat folder.

Writes are atomic and retain a `.bak` copy. If the active library is corrupt, Text Expander quarantines it as `library.corrupt-<timestamp>.json`, attempts the backup, and otherwise regenerates the generic starter library.

Counters are serialized so rapid presses cannot reuse the same counter value. A counter commits only after the associated insertion callback succeeds.

## Bundled profiles

Lite starter page, bundled for Standard/MK.2, Mini, XL, Stream Deck +, and Neo:

- EMAIL +
- CLIP +

Both starter keys use purpose-specific custom icons with a visible add badge.

Pro starter pages, bundled for Standard/MK.2, Mini, XL, Stream Deck +, and Neo:

- QUICK — EMAIL +, CLIP +, TIME, DATE, ADDRESS, LINK
- EMAIL
- SUPPORT
- CREATOR
- DEVELOPMENT
- PERSONAL

The starter data uses only generic demo copy such as `REPLACE ME` and `REPLACE WITH YOUR LINK`. No PackRat operator/customer/private contact data is embedded.

## Lite -> Pro upgrade rule

The Lite property inspector includes the upgrade reasons:

- more snippets
- folders
- advanced dynamic variables
- fill-in templates
- counters
- app-aware behavior

The upgrade button is hidden until a real Text Expander Pro Marketplace URL exists and is recorded in canonical metadata. A search URL, creator page, placeholder URL, or guessed product UUID is not accepted.

## QA boundary

Automated tests cover the variable engine, formatting, Unicode/multiline/large snippets, escaping, template field discovery, cursor placement, snippet limits, persistence, corrupt-library recovery, rapid serialized counters, build structure, bundled profile archives, and the safety guard against shell-evaluation primitives.

The Windows CI release gate targets the official `@elgato/streamdeck@2.1.2` SDK runtime, Node.js 24 / Stream Deck 7.1+, and current pinned Elgato Stream Deck CLI validation and packaging for both editions.

Final real-host tests still required before claiming READY_TO_SHIP:

- Notepad
- browser text field
- Discord
- multiline editor
- code editor
- Unicode and emoji
- clipboard restoration with text and non-text clipboard data
- huge snippet
- empty/missing context values
- custom date formatting
- rapid repeated physical key presses
- Stream Deck restart and persistence
- corrupt-library recovery on Windows
- template submit/cancel and foreground-window restore
- an application that blocks synthetic typing, verifying the documented clipboard fallback/limitation

