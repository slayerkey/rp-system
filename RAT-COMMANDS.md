# RatPack command cheat sheet

You only need to remember a few commands for normal use.

## `rat ship <slug> [slug...]`

This is the main release command for both XENEON widgets and registered Stream Deck plugins.

```text
rat ship helldivers
rat ship weather-timeline-pro weather-timeline snake desk-notes
```

Rat Ship runs local first. At the start of the queue it switches the local checkout to the latest canonical `main` once, then processes products sequentially so one authenticated Maker Console browser profile is never driven by two submissions at the same time.

The Marketplace router reads `products/<slug>.json` and chooses the correct product pipeline. XENEON widgets use the CORSAIR flow. Stream Deck plugins use the official Elgato CLI and `.streamDeckPlugin` package path. Mixed queues are supported.

Every product kit is written under:

```text
out\ship\<slug>
```

If one product fails, Rat Ship records the failure, continues the remaining queue, and prints a failure summary at the end.

### Release-state guard

Canonical product metadata uses the schema-defined `workflow_state` release state machine. For any product that declares a workflow state, `rat ship` and `rat submit` fail closed unless the canonical state is exactly `READY_TO_SHIP`.

That means intermediate states such as `BUILDING`, `TESTING`, `ART`, `READY_FOR_HARDWARE_QA`, `SUBMITTED`, `PUBLISHED`, `REJECTED`, and `BLOCKED` are not eligible for a new public submission. Legacy product records with no `workflow_state` retain the pre-state-machine behavior until migrated.

Blocked products should name the unresolved dependency in their `blocker` field. Legacy `BLOCKED_*` values are still recognized defensively during migration, but new product records should use canonical `BLOCKED`.

This prevents a product from being publicly submitted before its current release candidate has actually cleared the release gate.

`rat kit` and `rat stage` remain available for non-public preparation and review in every workflow state. Move `products/<slug>.json` on canonical `main` to `READY_TO_SHIP` only after the current candidate is genuinely ready for Marketplace submission.

### Stream Deck plugin release path

For a registered Stream Deck plugin, Rat Ship:

1. Reads the canonical product registry entry and source path.
2. Installs locked dependencies with `npm ci` when a lockfile exists.
3. Runs product build and tests.
4. Runs the official Elgato validator.
5. Creates the official `.streamDeckPlugin` package.
6. Runs deterministic Rat Art when present.
7. Builds the local ship kit with metadata, release notes, package and media.
8. Reuses the persistent local Maker Console browser login.
9. Creates or resumes the correct Plugin product type.
10. Sets applicable metadata, pricing, media, release notes and publish policy.
11. Submits the product.

`rat kit <slug>` is allowed before Marketplace pricing is chosen because it does not create a Maker Console product. `rat stage <slug>` and `rat ship <slug>` fail closed when required pricing is unset.

### XENEON widget release path

For a XENEON widget, Rat Ship:

1. Reuses the already synced canonical `main` checkout.
2. Checks required local runtime pieces and installs only missing pieces.
3. Regenerates the canonical flattened widget with `tools/xeneon/inline.py`.
4. Refuses to ship if generated shipping output has uncommitted drift.
5. Runs the official CORSAIR validator.
6. Creates the official `.icuewidget` package.
7. Captures the real widget locally for Rat Art.
8. Renders deterministic Rat Art and the search icon.
9. Builds and validates the Maker Console ship kit.
10. Reuses the persistent Maker Console browser runtime and login.
11. Fills the product draft, uploads package and media, sets metadata and submits.

### Local dependency behavior

Rat Ship expects Git, Python, Node, npm and npx on the Windows machine. It checks pinned runtime pieces such as Pillow and Playwright and installs only missing pieces. Stream Deck plugins use the locked local `@elgato/cli` dependency through `npx`. XENEON widgets use the pinned CORSAIR iCUE Widget CLI.

### Gallery order

The normal XENEON marketplace sequence is:

1. Cover or hero
2. Feature and value breakdown
3. Main product showcase
4. Settings, interaction or alternate state
5. Slot size compatibility

The cover is separate from the gallery. Stream Deck plugin products can provide their own deterministic Rat Art sequence, but the local plugin ship kit expects the canonical file names `01_search_icon.png`, `02_cover.png`, and `03_gallery_01.png` through `06_gallery_04.png`.

### Crash and recovery behavior

Recoverable Maker Console or Chromium failures are retried with saved resume state up to three times. Rat Ship does not blindly retry a draft whose irreversible state is wrong.

On a local Maker Console failure Rat Ship creates:

```text
out\ship\<slug>\log.zip
```

The ZIP contains recovery screenshots, error text, state and page diagnostics. Authentication remains local under:

```text
%LOCALAPPDATA%\PackRat\maker-console-profile
```

GitHub Actions never receives Maker Console cookies, passwords, browser profile data or session tokens.

## Clean GitHub runner commands

### `rat ship-cloud <slug> [slug...]`

Explicitly runs the old clean hosted XENEON build, downloads the kit, then uses the local authenticated Maker Console bridge.

### `rat kit-cloud <slug> [slug...]`

Runs the same clean hosted XENEON build and downloads the kit only.

## Automatic CI

Normal pushes and pull requests use lightweight CI plus any product or shared tooling gate whose path matches the changes. Lightweight CI validates canonical context, JSON, local PowerShell syntax, Rat Dev dependency behavior, the external Rat Dev lifecycle contract, and the Rat Audit lifecycle contract.

Expensive rendering, packaging, host smoke tests and Maker Console work happen in product release gates, locally during normal shipping, or through an explicit cloud workflow when requested.

## `rat dev <slug>`

This is the normal one command local development updater for products that need a real Windows host application or XENEON Edge to test.

```text
rat dev discord-bridge
rat dev discord-panel
rat dev valorant-tracker
```

The command bootstraps RatPack to the exact current canonical `origin/main` commit before product work begins. It explicitly refreshes the remote `main` ref and verifies local `HEAD` matches it, so a successful bootstrap cannot quietly continue from a stale command layer.

### Registered external Stream Deck plugins

External Stream Deck plugins use a build before switch lifecycle. The current live plugin is not used as the candidate build directory.

Rat Dev:

1. Reads `plugins/<slug>/rat-dev.json` to resolve repository, ref, plugin directory and UUID.
2. Reuses the Git controller checkout under `out\dev\worktrees\<slug>` when healthy.
3. Explicitly fetches the registered external branch without resetting, cleaning or deleting that controller checkout.
4. Creates a fresh detached candidate under `out\dev\builds\<slug>\<commit>-<timestamp>`.
5. Installs locked dependencies in the candidate.
6. Builds and runs product tests.
7. Runs supported profile generation, profile QA and product structural QA.
8. Runs the official Elgato validator on the candidate.
9. Leaves the current live development plugin untouched if anything above fails.
10. Only after the candidate passes validation, stops and unlinks the previous plugin.
11. Links the validated candidate and restarts the plugin process.
12. Attempts to restore the previous known good plugin if activation fails.
13. Saves successful deployment identity under `out\dev\state\<slug>.json`.
14. Prints the exact product version, repository, source branch, full source commit, plugin UUID, plugin path, link status and restart status.
15. Prints bundled profile names when profiles exist.
16. Opens the preferred bundled `.streamDeckProfile` for import when the product opts in, or by default when bundled profiles exist and the product has not explicitly opted out.

A successful run therefore gives an unambiguous answer to “which build am I actually running?”

Example success footer:

```text
Rat Dev updated valorant-tracker.
Product version:   1.0.0.0
Source repository: https://github.com/slayerkey/packrat-riot-tracker.git
Source branch:     product/valorant-tracker
Source commit:     <full SHA>
Plugin UUID:       com.packrat.valorant-tracker
Plugin path:       <validated isolated build path>
Link:              verified (CLI success)
Restart:           verified (CLI success)
```

Development linking and packaged Marketplace installation are intentionally described separately. For bundled profiles, Rat Dev now opens the preferred `.streamDeckProfile` after a successful link so Windows/Stream Deck can present the normal Install Profile flow. Products can set `open_profile_on_dev` or `dev_profile` in canonical metadata or `rat-dev.json` to override that behavior.

See `docs/RAT-DEV-RELIABILITY.md` for the full external lifecycle contract and failure behavior.

### Shared-source Lite/Pro products

Rat Dev supports multiple product SKUs that intentionally share one internal source directory. The product registry remains authoritative:

- `products/<slug>.json.source` selects the shared source root.
- `products/<slug>.json.ship_plugin_dir` selects the exact generated `.sdPlugin` directory for that SKU.
- A family branch such as `product/text-expander` can therefore serve both `rat dev text-expander` and `rat dev text-expander-pro`.

Rat Dev refuses to guess when an unregistered source root contains multiple top-level `.sdPlugin` directories. Add explicit product metadata instead of relying on directory enumeration order.

### Internal Stream Deck products and XENEON widgets

Products sourced from RatPack itself keep the established internal worktree path in `tools/local/rat-dev.ps1`.

For pre-merge product work, Rat Dev prefers an exact `origin/product/<slug>` branch when it contains newer or divergent work. If that exact product branch is already fully merged and is merely an ancestor of newer `origin/main`, Rat Dev uses `origin/main` instead so a stale product ref cannot install an older build. Lite/Pro families may also share a family branch such as `origin/product/macro-recorder`; Rat Dev discovers that branch by verifying which product branch actually contains `plugins/<slug>` or `widgets/_src/<slug>`. If multiple unrelated product branches contain the same slug, resolution fails closed instead of guessing.

For internal products, canonical product metadata and `plugins/<source>/rat-dev.json` are merged for development-only behavior such as preferred profiles, profile opening, plugin directories, and local inspection folders. Product metadata wins when both explicitly define the same field.

Missing `rat-dev.json` files are treated as normal probes for internal products, so a pre-merge product can still be built by source inference when the plugin directory and manifest are unambiguous.

For XENEON widgets Rat Dev automatically detects `widgets/_src/<slug>` and:

1. Reuses the ignored detached development worktree.
2. Runs local regression verification when present.
3. Regenerates the flattened shipping widget.
4. Runs the official CORSAIR validator.
5. Packages the widget.
6. Copies the package to `out\dev\packages\<slug>\<slug>.icuewidget`.
7. Opens the package for the final physical iCUE import boundary.

### Failure behavior

Rat Dev prints stage markers so the failed layer is obvious. A failed external candidate before activation leaves the existing live plugin alone. A failed activation attempts rollback. The inspection folder opened after a failure is for diagnostics only and is not presented as an installed build.

Normal iteration should not use Downloads, hand copied ZIP folders or manually installed development source folders. Product specific local state stays inside the host application or ignored RatPack `out` directories.

The first Stream Deck development run may install the official `@elgato/cli` once. Current Stream Deck local development requires Node.js 24 or newer. XENEON development uses the pinned official iCUE Widget CLI.

## `rat audit <slug> [--probe]`

This is the real host diagnostic companion to Rat Dev.

```text
rat dev voice-deck
rat audit voice-deck
rat audit voice-deck --probe
```

`rat audit <slug>` does not rebuild or reinstall the product. It resolves the exact development candidate that Rat Dev made active, prints its source identity and product root, then runs that product's `scripts/host-audit.ps1`.

For internal RatPack products, Rat Audit resolves the active product under the internal Rat Dev worktree. For registered external Stream Deck plugins, it reads `out\dev\state\<slug>.json` and audits the isolated validated build that is actually linked to Stream Deck. It does not substitute the controller checkout for that active build.

The optional `--probe` mode always runs the normal host audit first. If the product exposes an npm `host:probe` script and the audit succeeds, Rat Audit then runs the deeper transport or integration probe.

Rat Audit fails closed if the active build cannot be resolved, the product has no unambiguous host audit script, the normal audit fails, an unknown option is supplied, or `--probe` is requested for a product that does not expose a probe. Failures preserve the active build and its logs rather than reinstalling or switching source.

For Voice Deck, the normal physical workflow is simply:

```text
rat dev voice-deck
rat audit voice-deck
```

Use `rat audit voice-deck --probe` only when the Discord transport layer needs deeper isolation. The physical release checklist remains `plugins/voice-deck/REAL_WINDOWS_SMOKE.md`.

See `docs/RAT-AUDIT.md` for the full host audit contract and failure behavior.

## `rat status`

Shows local repo path, current branch, latest commit and whether local files changed.

## `rat help`

Prints the main command cheat sheet.

## Optional commands

### `rat dev-open <slug>`

Opens the local development controller folder without rebuilding or installing anything.

### `rat kit <slug> [slug...]`

Builds the full canonical ship kit locally without opening Maker Console.

### `rat stage <slug> [slug...]`

Builds locally and fills Maker Console but stops before final Submit.

### `rat submit <slug> [slug...]`

Alias for `rat ship`.

### `rat update`

Fetches GitHub and fast forwards the current branch if the local worktree is clean.

### `rat main`

Switches to `main` and pulls the latest canonical RatPack.

### `rat open`

Opens the RatPack repo folder in Explorer.

### `rat doctor`

Checks Git, Python, Node, npm, GitHub CLI, GitHub authentication, repo state and persistent Maker Console profile state.

# Local layout

Current preferred Windows location:

```text
C:\Users\Key\Videos\Claude Projects\Ratpack-GitHub
```

Generated output stays inside:

```text
C:\Users\Key\Videos\Claude Projects\Ratpack-GitHub\out
```

`out/` is ignored by Git.

External development controller checkouts live under:

```text
out\dev\worktrees
```

Validated external candidate deployments live under:

```text
out\dev\builds
```

Successful external deployment identity lives under:

```text
out\dev\state
```

Development XENEON packages live under:

```text
out\dev\packages
```

The Maker Console browser profile stays outside the repo under:

```text
%LOCALAPPDATA%\PackRat\maker-console-profile
```
