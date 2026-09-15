# Performance Grapher real iCUE transparency regression — 2026-08-28

## Status

Physical XENEON Edge regression reported by the active Performance Grapher tester.

The current `ratpack-system` repository does not contain the Performance Grapher authored or shipping source, and GitHub path history does not contain `widgets/_src/perf-grapher/index.html`. The current working product is therefore still local-only until the real source/package is supplied.

Do not recreate the published product from scratch.

## Physical reproduction

Tester sequence:

1. Load Performance Grapher in iCUE/XENEON Edge.
2. Change the widget transparency setting.
3. Change to another iCUE/XENEON page.
4. Return to the page containing Performance Grapher.
5. Performance Grapher sensor graph/card backgrounds become dramatically more transparent than expected and the page wallpaper bleeds through the graph panels.

The screenshots show neighboring widgets retaining their normal dark panel backgrounds while Performance Grapher CPU/GPU graph regions become highly transparent. Graph strokes and text remain visible over the wallpaper.

This is a lifecycle/persistence regression, not a request to redesign the transparency feature.

## Investigation targets once real source is available

Trace the transparency value end to end:

* x-icue property declaration and default
* direct iCUE binding value
* any compatibility bridge/window mirror
* persisted/localStorage value if one exists
* page initialization and resume/re-entry lifecycle
* `onICUEInitialized`
* `onDataUpdated`
* any page visibility/resume listener
* CSS variable derived from transparency
* background color alpha conversion
* graph/card background declarations
* body/stage/card `opacity`

Check specifically for:

1. Applying the transparency factor twice after page re-entry.
2. Storing an already-normalized 0–1 alpha and dividing by 100 again on restore.
3. Mutating the saved background color to RGBA, then applying transparency to that RGBA again later.
4. Applying CSS `opacity` to a parent graph/card container instead of only the intended background paint.
5. Rehydrating a stale setting from localStorage after iCUE has already supplied the current binding.
6. `onDataUpdated` and initialization both accumulating alpha rather than assigning an idempotent value.
7. Page navigation causing duplicate settings/event handlers.

These are investigation targets, not assumed causes.

## Required fix semantics

The transparency setting must have one canonical representation and one canonical conversion to rendered alpha.

Reapplying the same setting must be idempotent:

`applyTransparency(x); applyTransparency(x);`

must produce exactly the same computed result as:

`applyTransparency(x);`

Switching away from the XENEON page and back must not alter the computed transparency.

Transparency must affect only the intended widget/panel backgrounds. Text, numeric readouts, graph strokes/fills, sensor labels, touch controls, and warning states must retain their intended opacity unless the existing product specification explicitly says otherwise.

## Mandatory exact-package regression

Add a Playwright test against the exact official `.icuewidget` package that:

1. Loads a deterministic Performance Grapher state with at least two sensor graphs.
2. Records computed background alpha and ancestor opacity at the default transparency.
3. Changes transparency through the same iCUE binding/lifecycle path used by the physical widget.
4. Records the new computed values.
5. Simulates page departure/re-entry or full widget lifecycle reinitialization using the closest supported host mechanism.
6. Applies the unchanged setting again.
7. Asserts the graph/card background alpha is unchanged from step 4.
8. Asserts text and graph stroke opacity remain unchanged.
9. Repeats multiple re-entry cycles to catch cumulative alpha drift.
10. Runs at the physical 2536×696 device viewport and the canonical eight slot compositions.

Also exercise transparency minimum, default, midpoint, and maximum values.

## Existing feedback batch that must remain covered

Do not regress the already-active Performance Grapher feedback work:

* sensor readout size slider
* Performance header size slider
* Ping numeric readout instead of permanent dashes when real data exists
* Celsius unit/degree marker remaining attached when FPS monitor is off
* graph, bar, and radial modes
* FPS on and off

## Source handoff

When the current local Performance Grapher source or package is supplied:

1. Identify authored source, generated shipping folder, manifest id, and exact version before editing.
2. Preserve the published identifier and existing settings keys.
3. Import the source into this recovery branch if doing so does not destroy product history/identity.
4. Reproduce the transparency regression before changing code.
5. Fix the lifecycle/persistence root cause rather than masking the visual symptom.
6. Run current RatPack XENEON build/QA, official CORSAIR validation/package, exact-package regression, Corsair Labs host, and physical candidate packaging.
7. Keep the branch unmerged until the tester confirms page switching no longer changes transparency.
