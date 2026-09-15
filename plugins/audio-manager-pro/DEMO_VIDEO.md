# Audio Manager Pro — Marketplace Demo Video Gate

Record this on the exact release candidate after automated QA and `REAL_WINDOWS_SMOKE.md` pass.

Elgato's current Marketplace review guidance says products that require hardware or paid-service integrations may require a real demonstration video showing the product is fully functional. Treat Audio Manager Pro as requiring real-hardware evidence because its core value is switching physical Windows audio devices.

## Evidence to capture

- [ ] Show the Stream Deck / Stream Deck + running the exact release candidate.
- [ ] Show Windows audio state before the first profile switch.
- [ ] Apply a HEADSET-style profile and visibly confirm Default output, Communications output, Default input, and Communications input changed to the intended devices.
- [ ] Apply a SPEAKERS-style profile and confirm normal output changes without incorrectly moving the Communications role when that profile preserves it.
- [ ] Apply a MEETING-style profile and confirm the intended microphone/output combination plus any configured volume or mute restoration.
- [ ] Demonstrate Audio Profile Status changing between ACTIVE and INACTIVE when Windows state is manually changed.
- [ ] Disconnect a configured USB or Bluetooth device and show the saved profile reporting the missing device / PARTIAL result instead of silently binding another device.
- [ ] Reconnect or explicitly rebind the intended device and show recovery.
- [ ] On Stream Deck +, rotate the profile-output dial, press to reapply the profile, and touch to toggle output mute.
- [ ] Show at least one SUCCESS result and one deliberate PARTIAL or FAILED result.
- [ ] Show that profiles remain available after a Stream Deck restart.

## Submission record

Before upload, record:

- candidate git SHA
- packaged `.streamDeckPlugin` SHA256
- Windows version
- Stream Deck software version
- Stream Deck hardware model
- audio devices used
- demo-video filename / link
- date recorded
- PASS / FAIL notes

Do not use simulated devices, edited fake UI, or generated evidence in place of the real hardware demonstration.
