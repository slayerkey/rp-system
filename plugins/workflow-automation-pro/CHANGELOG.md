# Changelog

## 1.0.0.1 - 2026-08-21

- Fixed every action failing to run on macOS. The plugin shipped with two mismatched
  versions of a bundled native library, which is dependency drift on our end and not
  anything wrong with your setup or your Mac.

## 1.0.0.0 - 2026-08-14

First release.

- Room for twenty five steps on one key instead of five.
- Add a condition and the routine only carries on when it makes sense. A key can check that
  your recorder is already running and stop quietly if it is not, rather than starting a
  second copy on top of the first.
- Stopping on a condition is shown differently from something going wrong, so you can tell the
  two apart at a glance.
- Send a web request as a step, so one press can also tell something else you have started,
  whether that is a home automation hook, a chat notice, or your own script.
- Each request decides for itself whether a failure should stop the routine or be shrugged off.
- Includes everything the free tier does: opening programs, pressing key combinations, waiting,
  and opening links.
