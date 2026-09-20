# Workflow Automation (Lite)

Free tier. One action, Run Sequence: up to five steps of open a program, press keys, wait, or
open a link. The paid superset is `plugins/workflow-automation-pro`.

Shared logic lives in `plugins/_wf` and is imported as TypeScript source by relative path, the
same arrangement Calendar uses with `plugins/_calendar`. Reuse it; do not fork it.

## Layout

| Path | What it is |
|---|---|
| `src/plugin.ts` | The whole plugin. Pins the UUID and passes the tier to the shared action. |
| `../_wf/src/steps.ts` | What a step is, and which ones a tier allows. Pure. |
| `../_wf/src/runner.ts` | Runs a sequence against injected effects. Pure. |
| `../_wf/src/effects.ts` | The real launching, opening, waiting and checking. |
| `../_wf/src/input/` | koffi keystroke injection, plus the Windows to macOS key table. |
| `../_wf/src/badge.ts` | SVG key faces, including the progress pips. |
| `ui/run.js` | The sequence builder. One file, shared with Pro apart from its tier constant. |

## Four decisions worth knowing

**The tier is an argument, not a subclass.** Free and paid differ only in which step types are
allowed and how many. `usableSteps(steps, tier)` is the single gate, so a bug fixed in one tier
is fixed in both, and a Pro routine opened in Lite still runs its first few steps rather than
refusing outright.

**Effects are injected into the runner.** Ordering, failure and stop rules are tested without
launching a program or sending a keystroke at the machine running the tests. That is what makes
`runner.test.ts` able to assert "nothing after the failing step ran" at all.

**A gate stopping is not a failure.** A condition that does not hold means the routine did what
it was told, so it gets its own outcome and its own colour. Painting it red would train people
to ignore red.

**Steps store Windows virtual-key codes on both platforms.** A routine is written once and may
run on either OS, so it needs one key language. macOS translates on the way out through the
same `WIN_TO_MAC` table the profile builder uses, so a hotkey means the same thing everywhere
in the factory.

## A note on scope

Pro's conditions are gates, not branches: a step can stop the routine, but nothing jumps to a
different step. Real branching would need a flowchart to build, and the sequence builder is
already the fiddliest part of this product. A gate covers what people actually ask for, "only
do the rest of this if my recorder is already running", as one more row in the same list.

## Commands

```
npm install
npm install --force @koromix/koffi-darwin-x64@<koffi version> @koromix/koffi-darwin-arm64@<koffi version>
npm run build
npm test                                    # runs the shared core's suite
npx streamdeck validate com.packrat.workflow.sdPlugin
python plugins/workflow-automation/scripts/gen-icons.py
python tools/qa/qa_gate.py workflow-automation
```

The forced mac install is needed once per clone: npm only fetches the koffi binary matching the
host, and one artifact ships to both platforms.
