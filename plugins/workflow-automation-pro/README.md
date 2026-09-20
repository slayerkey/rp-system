# Workflow Automation Pro

Paid superset of `plugins/workflow-automation`. Same single action, Run Sequence, with two more
step types and twenty five steps instead of five.

All behaviour lives in `plugins/_wf`. This plugin is `src/plugin.ts` plus a property inspector
that differs from the Lite one by a single constant. Adding a feature means editing `_wf`.

## How Pro and Lite coexist

Following the precedent better-hotkeys-pro set: separate plugin UUID, separate action namespace
(`com.packrat.workflowpro.run`), and separate persisted settings. Both can be installed at once
without either seeing the other's routines.

## The two step types Pro adds

**A condition.** "Only carry on if obs64.exe is running", or the inverse. When it does not
hold, the routine stops and says so on the key, in the warning colour rather than the failure
one, because stopping is the routine working as written.

These are gates, not branches. Nothing jumps to a different step. Real branching would need a
flowchart to build, and the sequence builder is already the fiddliest part of this product. A
gate covers what people actually describe wanting as one more row in the same list.

**A web request.** GET or POST to any URL, with an optional JSON body. Each one chooses whether
a failure stops the routine or is shrugged off, since a chat notice failing should usually not
stop a stream from starting. Requests time out after ten seconds so a dead endpoint cannot hold
a key hostage.

## Commands

```
npm install
npm install --force @koromix/koffi-darwin-x64@<koffi version> @koromix/koffi-darwin-arm64@<koffi version>
npm run build
npm test                                    # runs the shared core's suite
npx streamdeck validate com.packrat.workflowpro.sdPlugin
python plugins/workflow-automation-pro/scripts/gen-icons.py
python tools/qa/qa_gate.py workflow-automation-pro
```
