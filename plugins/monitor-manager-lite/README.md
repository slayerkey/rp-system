# Monitor Manager Lite

Free brightness control for one configured Windows display.

## The Lite promise

Lite intentionally does one widely useful thing: **monitor brightness from Stream Deck**.

- exact brightness presets
- Brightness Up / Down
- Stream Deck+ brightness dial
- one configured monitor
- honest support reporting for external DDC/CI monitors and laptop internal panels

Everything else belongs in Monitor Manager Pro.

## Pro adds

Monitor Manager Pro adds multi-monitor targeting, monitor power, refresh rate, resolution, input switching, contrast, monitor volume, HDR, orientation, primary-display control, Windows topology, live status, and saved whole-setup Monitor Profiles.

The direct Pro button stays hidden until the exact public Marketplace product URL is verified. Lite can ship without a placeholder or generic link; the upsell is enabled in a post-publication update.

## Host QA

```powershell
npm ci
npm run build
npm test
..\..\rat.cmd audit monitor-manager-lite
```
