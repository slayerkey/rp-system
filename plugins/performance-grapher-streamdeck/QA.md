# Performance Grapher for Stream Deck QA

## Automated gates

The release workflow must pass all of the following before the product can move to `READY_FOR_HARDWARE_QA`:

- locked npm dependency install
- Node unit and fixture tests
- bounded long-session stress test
- PresentMon CSV parser fixtures
- process change / game start / game stop session fixtures
- corrupt history restore fixture
- 72, 96, and 144 pixel renderer checks
- self-contained .NET 8 sensor helper publish
- sensor helper one-shot probe on a Windows runner with no assumption that a supported GPU exists
- checksum verification of official PresentMon 2.5.1 x64 binary
- official Elgato manifest validation
- official Elgato .streamDeckPlugin packaging
- deterministic Marketplace media generation
- package/art SHA-256 evidence

## Required real Windows / hardware boundary

Do not move this product to `READY_TO_SHIP` based only on GitHub Actions.

1. Run `rat dev performance-grapher-streamdeck` or install the exact validated package.
2. Verify desktop idle does not create a game session.
3. Start and stop at least one real game.
4. Verify process changes finalize the previous session.
5. Verify current FPS, 1% low, 0.1% low, worst frametime, session length and peak sensors.
6. Verify PresentMon permission-required UX using a non-authorized Windows account where practical.
7. Verify NVIDIA GPU.
8. Verify AMD GPU.
9. Verify Intel GPU where feasible.
10. Verify no-GPU / unsupported sensor path remains usable through Windows CPU/RAM metrics.
11. Verify a disappearing sensor becomes unavailable without crashing.
12. Run a multi-hour session and restart the Stream Deck plugin.
13. Corrupt the local persistence file and verify it is quarantined.
14. Put multiple graph/metric keys on Mini, MK.2, XL, and + surfaces and check readability.
15. Measure plugin + helper CPU and private working set.
16. Compare game frametime with the plugin disabled vs enabled. Any meaningful repeatable regression blocks release.

### Performance budget

- hardware sensor polling: 1 Hz
- FPS image refresh: <= 4 Hz per visible FPS-like key
- hardware image refresh: <= 1 Hz per visible hardware key
- one shared PresentMon process
- one shared Libre Hardware Monitor helper
- target PackRat-owned average CPU: < 1% normalized CPU on the release test PC
- target plugin + helper private working set: < 150 MB
- no meaningful repeatable 1% low or frametime regression in the real-game A/B run
