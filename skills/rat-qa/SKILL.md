---
name: rat-qa
description: Run deterministic RatPack quality gates, route failures, and identify only the genuine final local checks.
---

# Rat QA

Run the product type appropriate automated checks before asking for local testing.

At minimum cover metadata, package structure, assets, copy rules, required variants, release notes or changelog expectations, and known platform constraints.

For plugins, include unit or fixture tests, vendor manifest validation, and the Stream Deck key-face visual gate from `standards/streamdeck-key-visuals-v1.md`. Run `node tools/qa/streamdeck-key-visual-audit.mjs <path-to-.sdPlugin>` when applicable.

For canonical PackRat Stream Deck UI work, also run `node tools/qa/streamdeck-plugin-design-audit.mjs <plugin-source-root> --require-canonical-pi`. For a Lite/free plugin with a direct Pro counterpart, add `--require-lite-pro-upsell`; both the top `Upgrade to Pro ↗` CTA and bottom explanatory Pro card are required.

The design audit must inspect the real per-action Property Inspector paths declared in the manifest, not assume one shared inspector file. A passing check against the wrong file is not evidence.

For a stateful Property Inspector, add deterministic race regressions before hardware QA. At minimum verify: pending local settings survive stale settings/state responses until acknowledgement; authoritative plugin state can clear `Saving…`; commands flush dependent pending settings first; dirty rename/name/path drafts are not overwritten by render/focus churn; switching away and back preserves the immutable selected ID/value; and duplicate human-readable labels remain independently selectable. Treat these as correctness tests, not optional UI polish.


For stateful Property Inspectors, treat "settings persist but plugin-owned library/timeline/live state is blank" as a transport failure signature. Verify the canonical PackRat route end-to-end: PI websocket context = `uiUuid`, selected key = separate `actionContext` payload, plugin receives commands on `streamDeck.ui.onSendToPlugin`, and plugin-owned state returns on `streamDeck.ui.sendToPropertyInspector`. Do not accept a per-action response helper mixed into a global request path.

When a stateful PI has been difficult to diagnose, prefer a non-destructive, copyable deep diagnostic over repeated user guesses.

If PI HTML renders but plugin-owned state never arrives, the diagnostic must separate **plugin launch** from **PI transport**. For Node plugins, verify the manifest does not misuse `Nodejs.Debug` as a boolean/off switch; it is Node command-line argument configuration. Log module load, Stream Deck connect, runtime start, PI command receipt, native refresh, PI response send, and process exit/exception before changing transport architecture again.

A direct host/native probe is only native-boundary evidence. It does not prove the Stream Deck Node process launched, the linked build is current, or the PI request/response path works. The report should identify transport, selected action resolution, persisted settings, storage path/readability/parseability, disk-vs-memory IDs, writeability probe, selected item resolution, and timeout/no-response state.

The visual gate is not satisfied by correct image dimensions alone. Every PackRat Keypad state must explicitly use `ShowTitle: false`; state/value text belongs inside the rendered key image. Review keys at 72 x 72 and 36 x 36. Reject clipped text, text crossing the main glyph, tiny low-contrast subjects, dense generic device illustrations behind labels, unrelated actions that all look the same, preset buttons that all collapse to one current value, and raw resolution strings that run off the key. Dynamic state must be readable without requiring the user to remember what the button means.

Reject ambiguous extensionless assets as well: a manifest path such as `imgs/actions/foo/key` must not have competing SVG/PNG/@2x candidates. Review representative runtime-generated states in addition to static manifest art, because runtime rendering is the shipping UI.

For profiles, include ZIP structure, page structure, action IDs, required plugins, device variants, icons, platform encoding, and the same key-face visual standard.

Generated/full-key profile QA must verify both `ShowTitle: false` **and** an empty generated host `Title` when the rendered key image owns all text. A profile can reintroduce host-title overlays even when the plugin manifest itself is correct.

Rat Dev profile QA must cover installed-profile synchronization, not only exported bundle validity:

- unchanged installed semantic content → no replacement
- same bundle SHA but installed settings/actions/states drift → replace in place
- changed bundle → replace in place
- legacy/untracked installed profile with the same logical Name → replace in place
- multiple same-name installed copies → discover and refresh all of them
- replacement preserves the Stream Deck `Device` binding
- replacement creates a backup and verifies/rolls back transactionally

Do not accept "bundle fingerprint unchanged" as proof that the profile visible on hardware is current. Generated profile labels must not undo the plugin's visual hierarchy. For complex plugins, verify page grouping and navigation instead of only checking archive validity. Rat Dev should open the standard/MK.2 profile automatically when bundled profiles exist.


Generated profile ActionIDs must be unique across **all** bundled device variants, not merely unique within one profile ZIP. If manually dragged actions work but bundled-profile actions do not, ActionID collision is an early diagnostic target. Builders should fail closed on duplicate IDs and expose the IDs in deterministic profile audit output.

For XENEON/iCUE widgets, include inline build, structure, browser layout, behavior, deterministic capture, art checks, official CORSAIR validation and packaging, exact package integrity/extraction, lexical iCUE property binding regression when controls are declared, Corsair Labs Windows runner smoke, and StreamSpell packaged verification where applicable.

Do not accept a compatibility runner alone as proof that iCUE settings work. The Corsair Labs runner currently writes settings onto the widget window, while real iCUE can expose document-level bindings with different semantics. A public widget with XENEON Custom Style controls must pass the RatPack lexical-binding smoke in addition to the runner smoke.

For art, include dimensions, expected file count, font identity, required source presence, text bounds, device presence, widget shot presence, and nontrivial content occupancy.

For live battery/device telemetry, distinguish **freshness** from **value change**. If repeated fresh bridge/device reads return the same percentage, treat that as device-reported telemetry rather than forcing a synthetic change. Where practical, expose/log transport, source, observation timestamp, charging state, and repeated samples. Clear stale value/source/timestamp metadata when the device disappears.

Do not mark the whole workflow local because a final device check remains.

Do not preserve a stale `qa_passed` state after Marketplace or real-host evidence demonstrates a failure. Route the product back to blocked/recovery status until the rejected behavior is covered by an automated regression and that regression passes against the exact package intended for resubmission.

The same invalidation rule applies when product scope or behavior changes after QA. A feature rollback, product-boundary reset, UUID/settings migration, or removal/addition of app-launch/profile/workspace behavior invalidates earlier final release evidence even when the old tests were green. Re-run deterministic tests, native smoke, vendor validation/package, relevant art, and exact-package evidence against the new exact source commit.

For paid/private-source products, distinguish infrastructure failure from product failure. A private Actions run that fails before meaningful checkout/test steps because runner allocation is unavailable is not code evidence. Use the established public control-plane/private-source QA bridge when configured, pin the exact private SHA, keep paid source/packages out of public artifacts, and record the actual Windows/macOS job evidence.

Report automated pass, warnings, blockers, and the smallest exact hardware or host test still required.
