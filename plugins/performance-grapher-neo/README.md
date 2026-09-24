# Performance Grapher Neo — dedicated Stream Deck Neo Infobar plugin

This is a **separate, Neo-only** PackRat product, not the 1.1 update to the existing Performance Grapher for Stream Deck. The original published plugin and its five Keypad actions, IDs and four bundled profiles remain untouched.

## Product experience

A dedicated `Controllers: ["Neo"]` **Live Performance Infobar** action for the 232×50 display below Neo's eight keys. No normal key actions and no profiles for non-Neo devices ship with this edition.

- **System Overview (default):** large CPU / GPU / RAM percentages with explicit unavailable state for missing GPU readings.
- **Single Metric:** choose a supported GPU, CPU, RAM, temperature, fan, power or advanced Libre Hardware Monitor sensor; optionally display 60 seconds of existing bounded sensor history.
- **Rotating Metrics:** three configurable selections, rotating every 3/5/10 seconds.
- **Settings:** simple mode, live metric, refresh cadence (1/2/5 seconds), labels, trend, and optional accent color.

Requires **Windows 10+**, **Stream Deck 7.6+**, and a **physical Stream Deck Neo** for the Infobar. SDK 3.0. No dedicated keypad feature is promised.

## Implementation, dependencies and performance

Uses existing PackRat sensor, bounded-history and feedback-layout sources from the sibling `plugins/performance-grapher-streamdeck/` directory in the canonical repository, plus the same proven native Libre Hardware Monitor helper build. Independent `com.packrat.performance-grapher-neo` plugin and `com.packrat.performance-grapher-neo.infobar` action UUIDs avoid hijacking the published plugin's existing customers/configuration.

A single sensor service is shared among **all visible Neo Infobar contexts inside this edition**. A rendering scheduler starts only while any Infobar is visible, deduplicates unchanged feedback, and stops the native helper when all Neo contexts disappear. SDK 3 settings come explicitly from `onWillAppear` and subsequent change events. No app/cloud account is needed.

**Scope choice:** the Neo edition does not start or ship PresentMon or advertise Game FPS; it focuses on quick system data and avoids a second game-capture process. Its local persistence lives under `PackRat/PerformanceGrapherNeo`, separate from the existing plugin. If the existing Performance Grapher and this new *separate* plugin run together, they still have independent OS sensor helpers; they cannot share a helper without new cross-plugin IPC. Never claim otherwise.

## Build

From the repository:
1. `cd plugins/performance-grapher-streamdeck && npm ci && npm test && npm run build` on Windows with Node 24 and .NET 8 installed. This generates the proven native helper and known-good license inventory. The upstream build also verifies its existing actions/profiles.
2. `node ../performance-grapher-neo/scripts/build.mjs`
3. `npx rollup -c rollup.neo.config.mjs`
4. `cd ../performance-grapher-neo && node --test tests/*.test.mjs`
5. From the upstream project working directory, `npx streamdeck validate ../performance-grapher-neo/com.packrat.performance-grapher-neo.sdPlugin --no-update-check` then package it.

GitHub Actions automates those steps and uploads the release candidate; see `.github/workflows/performance-grapher-neo.yml`.

A physical Neo smoke remains separate from the Windows build. See `QA.md`.
