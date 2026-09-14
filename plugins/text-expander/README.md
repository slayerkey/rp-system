# PackRat Text Expander Lite + Pro

Canonical Stream Deck source for:

- Text Expander Lite — Free
- Text Expander Pro — $7.99

Text Expander owns repeated authored text, not clipboard history.

## Runtime

Text Expander v1 is Windows-only and targets Stream Deck 7.1+ with Node.js 24. The plugin application layer uses the official `@elgato/streamdeck@2.1.2` SDK and SDKVersion 3 so the packaged build follows the current Marketplace/DRM runtime path.

## Build

```powershell
cd plugins/text-expander
npm ci
npm run qa
```

Build output:

- `dist/com.packrat.textexpanderlite.sdPlugin/`
- `dist/com.packrat.textexpanderpro.sdPlugin/`

The canonical CI workflow validates and packages both with `@elgato/cli@1.9.0`, then renders deterministic Marketplace art. Starter profiles are bundled for Standard/MK.2, Mini, XL, Stream Deck +, and Neo.

## Privacy

There is no PackRat cloud dependency, account, analytics endpoint, or snippet sync. Libraries, reusable variables, and counters stay on the current Windows PC.

## Safety

Snippet contents are treated as data. The fixed Windows bridge accepts base64 UTF-8 text through JSON stdin. It does not execute snippet contents as PowerShell, shell, JavaScript, or commands.

## Edition split

Lite is capped at 10 snippets with `{date}`, `{time}`, and `{clipboard}`. Its bundled starter profile is intentionally simple: **EMAIL +** and **CLIP +**.

Pro adds a large local library, folders, date/time formats, `{datetime}`, `{username}`, `{computer}`, `{app}`, named counters, cursor placement, reusable variables, and fill-in template fields. Its first QUICK page includes **EMAIL +, CLIP +, TIME, DATE, ADDRESS, and LINK** before the deeper workflow pages.

See `docs/TEXT_EXPANDER_STREAMDECK_PLAN.md` for the complete product and QA contract.

## Hardware smoke prep

Rat Dev now understands this shared-source Lite/Pro family. For normal iteration use `rat dev text-expander` or `rat dev text-expander-pro`. For the final combined physical release smoke, the family helper still prepares both editions together:

```powershell
.\scripts\hardware-smoke.ps1 -Edition both -OpenChecklist
```

It runs the locked build and automated QA, verifies each generated plugin directory against the deterministic unpacked-content digest from the validated CI artifact, validates both editions with the official Stream Deck CLI, links the correct Lite and Pro UUIDs, and writes an environment/build report under `out/host-smoke/text-expander/`. It does not automate the physical typing, clipboard, focus, or application-policy checks; complete those from `REAL_WINDOWS_SMOKE.md`.

