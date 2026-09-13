# Rat Dev reliability contract

`rat dev <slug>` is the normal local development updater for hardware-bound products.

For registered external Stream Deck plugins, Rat Dev follows a build-before-switch contract:

1. Bootstrap the local RatPack command layer to the exact current `origin/main` commit.
2. Run preflight without disturbing a healthy existing development link.
3. Read `plugins/<slug>/rat-dev.json` and resolve the canonical external repository and ref.
4. Fetch the external ref into the controller checkout under `out/dev/worktrees/<slug>` without resetting or cleaning that working directory.
5. Create a fresh detached candidate worktree under `out/dev/builds/<slug>/<commit>-<timestamp>`.
6. Install dependencies, build, run product tests, regenerate/validate profiles when supported, run structural product QA when supported, and validate the plugin with the official Elgato CLI inside the isolated candidate.
7. Leave the currently linked plugin untouched if any step before activation fails.
8. Only after the candidate is validated, stop and unlink the previous plugin, link the candidate, and restart the plugin process.
9. If activation fails, attempt to relink and restart the previous known-good plugin path.
10. Persist the successful local deployment identity under `out/dev/state/<slug>.json`.
11. Print product version, repository, branch/ref, exact commit, UUID, linked plugin path, link result, restart result, and bundled profile locations.

## Why the controller checkout is not the live deployment

Windows can keep a Stream Deck plugin directory locked while the plugin process is running. More importantly, mutating a Git working tree that Stream Deck is executing from can silently change the active build before tests finish.

External Rat Dev therefore uses the checkout under `out/dev/worktrees/<slug>` only as a Git controller. Candidate code runs from a separate detached worktree. A successful candidate becomes the development link only after validation.

This means a failed fetch, build, test, profile generation, product QA, or Elgato validation cannot destroy the last working Stream Deck build.

## Build identity

A successful external Stream Deck run ends with an identity block similar to:

```text
Rat Dev updated valorant-tracker.
Product version:   1.0.0.0
Source repository: https://github.com/slayerkey/packrat-riot-tracker.git
Source branch:     product/valorant-tracker
Source commit:     <full SHA>
Plugin UUID:       com.packrat.valorant-tracker
Plugin path:       <isolated validated build path>
Link:              verified (CLI success)
Restart:           verified (CLI success)
```

When bundled profiles exist, Rat Dev also prints their names and profile folder. Development linking is intentionally described separately from Marketplace/package installation because Elgato profile auto-install behavior is tied to normal plugin installation, not guaranteed by a development link.

## Failure behavior

The stage name printed immediately before an error identifies the failed layer. Rat Dev does not open a generated or candidate directory as though it were installed. The existing inspection helper may open the controller folder after failure, but terminal output explicitly states that no new validated development build was activated.

## Canonical bootstrap

The Rat command bootstrap explicitly fetches:

```text
+refs/heads/main:refs/remotes/origin/main
```

It then fast-forwards local `main` and verifies local `HEAD` exactly equals `refs/remotes/origin/main`. A normal Git progress message written to stderr is not treated as a PowerShell failure; the real Git process exit code controls success.

## Shared-source internal product families

Internal Lite/Pro product families may share one source root while producing separate Stream Deck plugin directories. Rat Dev resolves these through canonical product metadata rather than folder-name guessing.

For each requested slug, `products/<slug>.json` supplies the shared `source` and the exact `ship_plugin_dir`. This allows a family branch such as `product/text-expander` to serve both `rat dev text-expander` and `rat dev text-expander-pro` while linking the correct UUID/build output for each SKU.

If no explicit plugin directory is configured, Rat Dev only accepts a single unambiguous top-level `.sdPlugin` directory. Multiple candidates fail closed and require product metadata or `rat-dev.json` configuration.
