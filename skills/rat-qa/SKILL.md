---
name: rat-qa
description: Run deterministic RatPack quality gates, route failures, and identify only the genuine final local checks.
---

# Rat QA

Run the product type appropriate automated checks before asking for local testing.

At minimum cover metadata, package structure, assets, copy rules, required variants, release notes or changelog expectations, and known platform constraints.

For plugins, include unit or fixture tests, vendor manifest validation, and the Stream Deck key-face visual gate from `standards/streamdeck-key-visuals-v1.md`. Run `node tools/qa/streamdeck-key-visual-audit.mjs <path-to-.sdPlugin>` when applicable.

The visual gate is not satisfied by correct image dimensions alone. Every PackRat Keypad state must explicitly use `ShowTitle: false`; state/value text belongs inside the rendered key image. Review keys at 72 x 72 and 36 x 36. Reject clipped text, text crossing the main glyph, tiny low-contrast subjects, dense generic device illustrations behind labels, unrelated actions that all look the same, preset buttons that all collapse to one current value, and raw resolution strings that run off the key. Dynamic state must be readable without requiring the user to remember what the button means.

For profiles, include ZIP structure, page structure, action IDs, required plugins, device variants, icons, platform encoding, and the same key-face visual standard. Generated profile labels must not undo the plugin's visual hierarchy.

For XENEON/iCUE widgets, include inline build, structure, browser layout, behavior, deterministic capture, art checks, official CORSAIR validation and packaging, exact package integrity/extraction, lexical iCUE property binding regression when controls are declared, Corsair Labs Windows runner smoke, and StreamSpell packaged verification where applicable.

Do not accept a compatibility runner alone as proof that iCUE settings work. The Corsair Labs runner currently writes settings onto the widget window, while real iCUE can expose document-level bindings with different semantics. A public widget with XENEON Custom Style controls must pass the RatPack lexical-binding smoke in addition to the runner smoke.

For art, include dimensions, expected file count, font identity, required source presence, text bounds, device presence, widget shot presence, and nontrivial content occupancy.

Do not mark the whole workflow local because a final device check remains.

Do not preserve a stale `qa_passed` state after Marketplace or real-host evidence demonstrates a failure. Route the product back to blocked/recovery status until the rejected behavior is covered by an automated regression and that regression passes against the exact package intended for resubmission.

Report automated pass, warnings, blockers, and the smallest exact hardware or host test still required.
