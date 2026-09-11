# PackRat Self-Hosted GitHub Actions Runner

## Purpose

PackRat uses a private GitHub repository for proprietary source while offloading selected Windows CI/build jobs to the owner's Windows PC through a GitHub Actions self-hosted runner.

This keeps source private without requiring GitHub-hosted Windows minutes for every build.

## Runner identity

- Repository: `slayerkey/rp-system`
- Runner name: `packrat-pc`
- Required labels: `self-hosted`, `Windows`, `X64`, `packrat`
- Runner directory: `C:\actions-runner-packrat`
- Work directory: `_work`

Workflows intended for this machine use:

```yaml
runs-on: [self-hosted, Windows, X64, packrat]
```

## Security boundary

The persistent PackRat runner must only be kept online while the canonical repository is private.

Do not enable the persistent self-hosted runner for arbitrary public pull requests. A self-hosted runner executes workflow commands on the owner's machine.

Keep workflow permissions least-privilege. Build/test jobs should normally use:

```yaml
permissions:
  contents: read
```

Do not put Maker Console profiles, browser authentication, local tokens, API keys, cookies, or other workstation credentials into the repository or workflow artifacts.

## AI usage boundary

The self-hosted runner is not Codex and does not invoke an AI model by itself.

GitHub queues a workflow and the Windows machine runs ordinary build/test tools such as PowerShell, Git, Node, Python, Stream Deck tooling, and Rat tooling. AI/API usage only occurs if a workflow explicitly calls an AI service.

## Migration strategy

1. Keep lightweight/cloud-specific CI on GitHub-hosted runners where useful.
2. Move expensive Windows build/package jobs to `packrat-pc` incrementally.
3. Prove each migrated workflow on the self-hosted runner before moving more jobs.
4. Keep physical hardware tests and authenticated Marketplace/Maker Console boundaries local/manual unless a deliberately secured automation is built for them.

## Smoke test

`.github/workflows/self-hosted-runner-smoke.yml` is manual-only and verifies that the private repository can be checked out and executed by `packrat-pc`.

## First real migration

`.github/workflows/claude-auto-queue-ci.yml` is the first real Windows build selected for self-hosted execution. It should be merged only after:

1. `rp-system` is private.
2. `packrat-pc` is installed as a Windows service.
3. The manual smoke test passes while the repository is private.
