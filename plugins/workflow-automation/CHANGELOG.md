# Changelog

## 1.0.0.2 - 2026-08-23

- Added a quiet Workflow Automation Pro link at the bottom of the settings panel.

## 1.0.0.1 - 2026-08-21

- Fixed every action failing to run on macOS. The plugin shipped with two mismatched
  versions of a bundled native library, which is dependency drift on our end and not
  anything wrong with your setup or your Mac.

## 1.0.0.0 - 2026-08-14

First release.

- Build a routine of up to five steps and run the whole thing with one press.
- Steps can open a program, press a key combination, wait a set time, or open a link.
- A wait is a real step, so you can open something slow and then type into it once it is
  actually ready.
- The key counts the steps off as it runs, so you can see how far along it is at a glance.
- If a step goes wrong the routine stops there and the key names which step it was, instead of
  carrying on as though nothing happened.
- Half-finished steps are skipped rather than treated as errors, so you can build a routine a
  piece at a time.
