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

This is not limited to native helper executables. Ordinary JavaScript plugins run under a system `node.exe` outside the plugin directory, but the process command line/current working context can still reference the linked `.sdPlugin` tree and keep files/directories busy on Windows. Rat Dev therefore pauses the currently linked plugin before reset/clean/build and then releases any remaining build-owned helpers.


### Windows unlink-loop symptom

If Git asks repeatedly:

```text
Unlink of file '<plugin>/helpers/<native-helper>.exe' failed. Should I try again? (y/n)
```

do not keep answering `y`. The linked plugin is usually respawning the native helper.

The required order is:

1. identify the currently linked plugin/UUID
2. pause/stop and unlink that development plugin
3. terminate remaining build-owned helper processes
4. only then run `git reset --hard` / clean / worktree refresh
5. build and validate
6. relink/restart only after the candidate passes

The shared Rat Dev regression must enforce lock release **before** any reusable-worktree reset/clean operation.

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

## Bundled profile synchronization contract

Rat Dev must keep bundled Stream Deck profiles current without creating duplicate imports or trusting stale local state.

### Decision source

A stored bundle fingerprint is only a cache hint. It is **not** sufficient proof that the profile visible in Stream Deck matches the current bundle.

When a bundled profile already exists locally, Rat Dev must:

1. resolve the bundled profile's logical `Name`
2. enumerate **all** installed `.sdProfile` directories with that exact Name
3. compare installed manifests/pages/actions/settings/states semantically against the current exported bundle
4. ignore host-owned fields such as physical `Device` binding, host `AppIdentifier`, and current page selection
5. skip refresh only when every same-name installed copy semantically matches
6. treat any mismatch as installed-profile drift even when the bundle SHA/fingerprint is unchanged

This prevents the failure mode where Rat Dev prints `bundle unchanged` while the user is still looking at an older or manually drifted profile.

### In-place replacement

When the bundle changed, the installed copy is untracked, profile-state metadata was upgraded, or semantic drift is detected, Rat Dev refreshes the installed profile **in place** instead of importing another copy.

The replacement contract is transactional:

- validate/extract the incoming `.streamDeckProfile` to staging
- preserve the existing installed `.sdProfile` path
- preserve the physical Stream Deck `Device` binding
- preserve host-owned metadata only when compatible
- back up the existing installed profile under Rat Dev state
- stop Stream Deck once so the host cannot rewrite the profile mid-swap
- stage the replacement beside the installed profile
- verify root/page manifests and action UUIDs
- atomically swap the staged profile into the existing path
- verify the installed result
- rollback automatically from the old copy if verification fails
- restart Stream Deck after the swap

If multiple same-name installed copies already exist because of older import behavior, Rat Dev refreshes **all** of them during the same host stop/restart window. This prevents an inactive stale duplicate from later becoming the user's active profile.

Missing profiles still use the normal import/open path because there is nothing to replace in place.

### Profile state versioning

Profile state metadata should version the synchronization algorithm. A newer Rat Dev implementation may force one in-place refresh when it cannot trust state written by an older profile lifecycle.

Do not silently adopt an installed profile as current merely because its Name matches.

### Windows compatibility

Global Rat Dev PowerShell helpers must remain compatible with the Windows PowerShell environment used by the local PackRat command layer. Avoid relying on newer PowerShell/.NET-only path APIs when an equivalent portable path calculation exists.

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


## Source ownership and branch ambiguity

Rat Dev must never guess which product branch owns a slug.

Resolution order:

1. explicit external registration on canonical `origin/main` is authoritative for private/external products
2. exact `product/<slug>` branch is authoritative when it contains newer/divergent work
3. canonical product metadata may route Lite/Pro SKUs to one shared family source
4. ambiguous copies on multiple unrelated product branches fail closed

Do not “fix” branch ambiguity by duplicating the same product source onto more branches. Establish one owning source/ref and register it canonically.

A local clone with a restricted fetch refspec is not trusted to have fresh `origin/product/*` refs. Rat Dev explicitly fetches `main` and all product branches every run before source resolution.


### Stale-product-ref symptom

If Rat Dev prints a product-branch HEAD older than the branch head visible on GitHub, do not debug the product test failure yet. First verify the fetch step explicitly refreshes:

```text
+refs/heads/main:refs/remotes/origin/main
+refs/heads/product/*:refs/remotes/origin/product/*
```

A plain `git fetch origin` is insufficient because older/local clones may have a main-only `remote.origin.fetch` refspec. A successful fetch message does not prove product refs were updated.

## Candidate must pass before activation

A failing build/test/design audit must not activate a partially updated plugin merely because the source files look visually correct.

When a visual change intentionally changes a token or layout, update the matching regression test in the same candidate. A stale assertion should fail the candidate, be corrected, and then rerun; never bypass the test just to inspect the new build.

Rat Dev's goal is that the user's first local pass answers **“does this feel right on my hardware?”**, not **“does this source compile?”**

## Product-boundary changes

Rat Dev is not release evidence across a product-scope reset.

If a product is split, rolled back to an earlier behavior boundary, or has major features removed/moved elsewhere:

- freeze the pre-change exact state first so useful work is recoverable
- reset the shipping candidate deliberately
- invalidate old final QA/package/media evidence
- run fresh exact-commit QA before treating the new candidate as release-ready
