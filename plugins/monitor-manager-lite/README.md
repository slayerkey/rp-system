# Monitor Manager Lite

Free Windows monitor control for one configured display.

## Actions

- Monitor Brightness: set, up, down, plus native Stream Deck+ encoder rotation.
- Monitor Power: only when VCP D6 is advertised by the monitor.
- Refresh Rate Switch: only modes Windows enumerates for the current resolution.
- Current Display Status: current Hz and resolution.

## Capability policy

DDC/CI support varies by monitor, firmware, cable path, dock and monitor settings. The plugin exposes SUPPORTED, NOT SUPPORTED and UNKNOWN rather than assuming a VCP feature exists.

External brightness uses the Windows Monitor Configuration API. Internal laptop-panel brightness uses WMI. Low-level VCP writes are limited to input source 0x60, audio volume 0x62 and power mode 0xD6, with product code using only the controls relevant to the edition.

## Pro conversion

The property inspector contains a Pro CTA, but it is hidden while `PRO_MARKETPLACE_URL` is null. Commit the exact verified public Monitor Manager Pro Marketplace product URL only after the listing exists.

## Host QA

```powershell
npm ci
npm run build
npm test
..\..\rat.cmd audit monitor-manager-lite
```
