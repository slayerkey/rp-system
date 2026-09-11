# RATPACK

## What RatPack is

RatPack is Packrat's product factory and operating system for researching, building, testing, packaging, marketing, shipping, and maintaining marketplace products.

The current factory covers Stream Deck profiles, Stream Deck plugins, Stream Deck icon packs, CORSAIR iCUE widgets for XENEON Edge, and additional marketplace experiments.

## Operating principle

GitHub is the canonical source of truth.

ChatGPT is the preferred development and orchestration environment.

GitHub Actions is the preferred remote build and test computer when a clean or platform specific runner is required.

Local applications and physical hardware are final validation boundaries only when the product genuinely depends on them. They are not the normal place to discover ordinary code, packaging, layout, or art failures.

## Canonical repository

`ratpack-system` is the hub for shared skills, standards, platform references, workflow contracts, schemas, CI contracts, reusable QA, adapters, product registry, and product source as migration progresses.

The current migrated product roster lives at `products/index.json`. Read it for fresh chat roster discovery and current legacy product status.

During migration, the existing local `ratpack-projects` and `_shared` directories remain compatibility dependencies until their consumers are moved into versioned paths here and the clean environment tests pass.

## Natural task language

When the user says "Rat validate this", follow `skills/rat-validate/SKILL.md`.

When the user says "Build it", follow `skills/rat-build/SKILL.md` and dispatch by product type.

When the user says "Make the art", follow `skills/rat-art/SKILL.md`.

When the user says "Run QA", follow `skills/rat-qa/SKILL.md`.

When the user says "Package it" or "Ship it", follow `skills/rat-ship/SKILL.md`.

When the user asks what is next, follow `skills/rat/SKILL.md` using canonical product state.

## Product types

`profile`: Stream Deck profile products, including standard, XL, Plus, VSD, Windows, and Mac variants when applicable.

`plugin`: Stream Deck SDK plugins.

`widget`: CORSAIR iCUE widgets, including XENEON Edge dashboard LCD products.

`icons`: Stream Deck icon packs.

Other marketplace types may exist. Do not force them through a Stream Deck specific builder.

## Workflow states

IDEA

RESEARCHING

VALIDATED

PLANNED

BUILDING

TESTING

ART

READY_FOR_HARDWARE_QA

READY_TO_SHIP

SUBMITTED

PUBLISHED

BLOCKED

REJECTED

The current product roster still uses a smaller legacy `status` vocabulary. During migration, preserve compatibility while introducing `workflow_state` using `standards/product-state.md`.

`READY_FOR_HARDWARE_QA` is a capability state, not a universal requirement. Products without owned or necessary hardware may move directly to `READY_TO_SHIP` after their documented automated release gate passes.

## Source of truth rules

Product names, price, status, type, keywords, and required variants come from canonical product metadata.

Validation evidence belongs with the product and must survive a NO GO decision.

Shared workflow logic belongs here, not duplicated across Claude commands and Agent skills.

Claude, Codex, and ChatGPT adapters should be thin. They may route to canonical skills but should not contain a second full copy of the workflow.

Existing published identifiers are immutable. Do not rename published plugin or product identifiers solely to make namespaces consistent.

## Web first execution rule

Stay in ChatGPT until a real technical boundary is reached.

Use direct execution when the tool runs in the ChatGPT environment.

Use GitHub Actions when dependency installation, Windows, a browser, a vendor CLI, or a clean runner is required.

Use the local PC only for host application state, authenticated browser state that cannot be delegated safely, or genuinely required host or hardware validation.

## Final local boundaries currently known

Physical Stream Deck behavior and final import validation remain useful for products that target actual Stream Deck hardware.

XENEON Edge widgets do not require owned physical hardware for release candidate status. The canonical gate is source and structure QA, all eight deterministic browser fixtures, official iCUE CLI validation and packaging on Windows CI, exact-package integrity, lexical iCUE binding/settings regression where applicable, Corsair Labs Windows runner smoke, and StreamSpell packaged-widget validation across all eight XENEON presets. A real iCUE or physical-device smoke test is optional extra confidence when available, but any real-host observation overrides mocks and should be converted into an automated regression.

Maker Console staging and upload are automated through the canonical Playwright driver. The signed in Maker Console browser profile remains local and is never copied into GitHub or CI. GitHub generates and validates the exact SHIP_KIT consumed by that local browser bridge.

Host application runtime validation remains required for products whose core function integrates with applications such as Premiere Pro, Resolve, or AutoCAD.

## Proven remote execution

Stream Deck plugin build, Elgato CLI validation, packaging, logs, and artifacts have been proven through GitHub Actions.

XENEON official CLI Windows CI was proven on 2026-08-22 with `icuewidget-cli@0.4.47`: validation passed and a real `.icuewidget` package was created on a clean Windows runner.

The packaged XENEON artifact was then independently opened by StreamSpell's `xeneon-edge-widget-builder` in GitHub Actions and rendered through all eight official XENEON viewport presets with zero console errors.

Rat Art for XENEON is versioned and runs through GitHub Actions using deterministic browser captures plus the repository compositor. Image generation is explicitly disabled for Rat Art.

Rat Ship for XENEON rebuilds the canonical widget, validates and packages it with the CORSAIR CLI, reruns Rat Art, creates the Maker Console SHIP_KIT, and preflights the Playwright browser driver in GitHub Actions. Only the authenticated browser session remains local.

## Critical migration blockers

The local `ratpack-projects` and `_shared` content must be preserved before restructuring.

Brand art must fail if its required brand font cannot be resolved. Silent fallback is not acceptable.

XENEON art must require real deterministic widget captures before rendering. Missing captures must fail the pipeline rather than produce blank marketing art.

Never move Maker Console browser profile data, cookies, passwords, or session tokens into GitHub Actions merely to eliminate the final authenticated browser boundary.

## Read next by task

Roster and product state: `products/index.json`

Validation: `skills/rat-validate/SKILL.md`

Build: `skills/rat-build/SKILL.md` plus the matching file under `platforms/`

Art: `skills/rat-art/SKILL.md`

QA: `skills/rat-qa/SKILL.md`

Ship: `skills/rat-ship/SKILL.md`

XENEON or iCUE work: `skills/icue-widget-builder/SKILL.md`, `platforms/icue-xeneon.md`, and `docs/XENEON_TROUBLESHOOTING_PLAYBOOK.md`

Fresh chat acceptance: `docs/FRESH_CHAT_ACCEPTANCE.md`
