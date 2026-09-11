# PackRat Lighting Companion

Local Windows companion for **Smart Lighting Control for Hue + Govee** on XENEON Edge.

## Why a companion exists

The imported XENEON widget runs from a `file://` origin. A browser widget cannot reliably perform Hue local HTTPS discovery/pairing or Govee UDP LAN control, and putting Govee credentials in the widget would be a poor security boundary.

The companion therefore owns provider transport and exposes only normalized lighting state/control on `127.0.0.1:17486`.

## Security boundary

- binds to `127.0.0.1` only
- XENEON WebSocket accepts only local file/null origins
- first WebSocket frame must contain the random Companion Pairing Token
- Philips Hue application key is stored in Windows Credential Manager
- optional Govee Developer API key is stored in Windows Credential Manager
- Hue Bridge TLS certificate is trust-on-first-pair and SHA-256 pinned afterward
- setup HTTP mutations accept only the companion's own localhost origin
- no PackRat cloud, telemetry, credential upload, or repository secrets

## Philips Hue

1. Open the local companion setup page.
2. Discover a Hue Bridge using mDNS. If local discovery is unavailable, the companion can use Hue's official discovery endpoint as a fallback or the user can enter the bridge IP.
3. Press the physical bridge link button.
4. Pair.
5. The companion uses the local Hue API v2 for resources and control.

Supported when exposed by the resource:
- lights
- rooms and zones through their grouped-light service
- scenes
- on/off
- brightness
- color
- color temperature
- current state

## Govee

1. Enable **LAN Control** in Govee Home for compatible devices.
2. Scan LAN from the local setup page. The companion joins Govee LAN multicast on active IPv4 interfaces; if multicast is blocked by a router/VLAN, enter the device IPv4 address for a direct scan.
3. Core LAN-capable controls work without a cloud key.
4. Optionally paste a Govee Developer API key to add cloud-only devices/capabilities, current state and scenes.

LAN Control path (local interoperability transport; separate from Govee's public Developer API):
- UDP discovery on the user's LAN
- on/off
- brightness
- RGB
- color temperature only when capability support is known
- current state when returned by LAN status

Optional official Developer API path:
- device/capability discovery
- current state
- on/off
- brightness
- RGB
- color temperature using the device's advertised range
- static and dynamic scenes

Govee groups/rooms are not invented because the current Developer API is device/capability oriented and does not provide a Hue-style room resource for this use case.

## Local development

```powershell
dotnet run --project companions/smart-lighting-control/PackRat.SmartLighting.Companion.csproj
```

Fixture mode used by CI:

```powershell
dotnet run --project companions/smart-lighting-control/PackRat.SmartLighting.Companion.csproj -- --fixture --no-browser
```

Deterministic transport tests never require real Hue/Govee credentials.

For normal use, keep the companion process running while the XENEON widget is active. Closing the companion intentionally puts the widget into its offline/reconnect state.
