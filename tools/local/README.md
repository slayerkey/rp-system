# RatPack local workspace

The local workspace is the execution environment; GitHub remains the canonical source of truth.

The repository can live anywhere on Windows. The current preferred checkout is:

`C:\Users\Key\Videos\Claude Projects\Ratpack-GitHub`

After one time setup, the repository root is added to the user's PATH so `rat` can be called from any terminal.

## Command freshness

Normal build and development commands self refresh the RatPack command layer before they do product work. `rat dev`, `rat ship`, `rat submit`, `rat stage`, `rat kit`, `rat ship-cloud`, and `rat kit-cloud` fetch canonical GitHub `main`, fast forward the local command checkout, and then re enter the freshly updated `rat.cmd` in the same invocation.

That means a committed update to Rat Dev or Rat Ship is picked up by the next command you run. You do not need to run `rat main` first. The bootstrap itself does not start GitHub Actions; it is only a Git fetch and fast forward of the canonical command repository.

The canonical RatPack checkout must be clean before a self updating command runs. Product development state belongs under ignored `out/` worktrees or in the external product repositories, not as edits in the command checkout.

## Normal commands

* `rat dev <slug>` refreshes the RatPack command layer, fetches the newest canonical product source, builds and tests it locally, runs the official platform validator, and installs or opens the development build for host testing. Stream Deck products are linked and restarted in developer mode. External products such as Valorant Tracker are fetched from the repository and ref registered in `plugins/<slug>/rat-dev.json` on RatPack `main`.
* `rat ship <slug> [slug...]` refreshes the RatPack command layer, then builds, validates, packages, captures, creates Rat Art, creates the ship kit, fills Maker Console, and submits locally on this PC. Existing dependencies are reused and missing runtime pieces are installed only when needed.
* `rat status` shows the current checkout state.
* `rat help` shows the command cheat sheet.

Rat Dev itself does not use a hosted GitHub Actions runner. GitHub is used for source freshness, while the build, tests, official Stream Deck or CORSAIR validation, development linking, and host smoke workflow happen on the Windows PC.

## Optional commands

* `rat ship-cloud <slug> [slug...]` explicitly uses the clean hosted Rat Ship workflow on GitHub Actions, downloads the kit, then submits through the local Maker Console browser. This is useful when you want an independent clean runner check rather than the normal local build.
* `rat kit-cloud <slug> [slug...]` runs the clean GitHub Actions build and downloads the resulting kit without submitting.
* `rat kit <slug> [slug...]` builds fresh ship kits locally and opens the output without submitting.
* `rat stage <slug> [slug...]` builds locally and fills Maker Console without final submission.
* `rat submit <slug> [slug...]` is an alias for the normal local `rat ship` path.
* `rat update` fetches and fast forwards the current branch when the worktree is clean.
* `rat main` switches to `main` and fast forwards it. This remains useful for explicit maintenance, but it is not required before normal `rat dev` or `rat ship` use.
* `rat open` opens the repository folder.
* `rat doctor` checks Git, Python, GitHub CLI, Node, repository state, and GitHub authentication.

The full GitHub Rat Ship, Rat Art, and deep XENEON CI workflows are opt in only. Normal pushes and pull requests use the lightweight RatPack CI instead, so routine development does not install Chromium, package widgets, or run the full shipping factory on hosted runners.

Generated local output belongs under `out/` and is ignored by Git. It should not go through Downloads.

The authenticated Maker Console browser profile remains under `%LOCALAPPDATA%\PackRat\maker-console-profile` and is never committed or uploaded to GitHub.

## Maker Console transient failures

If Maker Console shows **Unexpected error** with **Try again**, treat it as a transient service/UI condition first when the package has already passed local tests and official Elgato validation.

Rat Ship is allowed one in-place **Try again** recovery for that exact transient state. It should reacquire the current DOM step and continue without reopening the browser or replaying the whole draft.

A very strong isolation signal is the same failure appearing on an unrelated plugin, especially during a manual upload. In that case, stop changing the product package. Preserve the package hash, screenshot/log evidence, wait for Maker Console to recover, and retry the unchanged package later.

Do not respond to that platform symptom by changing UUIDs, versions, art, or otherwise manufacturing a new candidate.

## One time Windows setup

If the repo is already cloned into `C:\Users\Key\Videos\Claude Projects\Ratpack-GitHub`, run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "C:\Users\Key\Videos\Claude Projects\Ratpack-GitHub\setup-windows.ps1"
```

If it is not cloned yet, run:

```powershell
$dest='C:\Users\Key\Videos\Claude Projects\Ratpack-GitHub'; if (!(Test-Path "$dest\.git")) { git clone https://github.com/slayerkey/ratpack-system.git "$dest" }; powershell -NoProfile -ExecutionPolicy Bypass -File "$dest\setup-windows.ps1"
```

The setup script installs GitHub CLI with winget if needed and opens its browser login if required. Normal local Rat Dev and Rat Ship do not need a GitHub Actions runner; Git is still used to refresh canonical source before work starts.
