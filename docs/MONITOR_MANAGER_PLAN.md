# Monitor Manager Lite + Pro

## Decision

GO.

The category is not empty. Current Stream Deck products already cover DDC brightness/contrast and Windows display settings. PackRat's differentiation is the unified workflow: Windows display configuration + capability-aware monitor hardware control + saved whole-setup profiles.

## Competitor gate

- Display Brightness Control: strong DDC/CI brightness and contrast, multi-monitor targeting, button + Stream Deck+ dial support.
- Windows Display Settings: HDR, resolution, orientation and Windows projection modes.
- Microsoft PowerToys Power Display outside Marketplace: validates broad demand for monitor-level control and also demonstrates real-world DDC compatibility variance.

Monitor Manager must not ship as another brightness plugin or another projection-mode shortcut.

## API plan

Use documented Windows APIs first.

- Display mode / Hz / resolution / orientation / primary: EnumDisplaySettingsEx + ChangeDisplaySettingsEx.
- Extend / Duplicate / internal-only / external-only: SetDisplayConfig topology flags.
- HDR: QueryDisplayConfig + DisplayConfigGetDeviceInfo / DisplayConfigSetDeviceInfo advanced-color packets.
- External hardware controls: Windows Monitor Configuration API / DDC/CI.
- Laptop internal brightness: WMI monitor brightness path, separate from DDC/CI.
- DDC capability string is parsed before low-level VCP writes. Unknown or absent VCP support is never treated as supported.

Capability states exposed to the plugin are SUPPORTED, NOT_SUPPORTED, UNKNOWN.

## Lite split

One configured monitor. No saved profiles. No multi-monitor orchestration.

- Monitor Brightness
- Brightness Up / Down
- Monitor Power when VCP D6 is advertised
- Refresh Rate Switch on the selected monitor
- Current Display Status
- Capability scan/status
- Stream Deck+ brightness dial

Lite reliability is not intentionally reduced.

The direct Pro CTA is fail-closed: it is rendered only after a verified Monitor Manager Pro Marketplace URL is committed. No generic PackRat or placeholder URL is allowed.

## Pro split

- Unlimited discovered monitors
- Brightness
- Contrast
- Monitor volume where advertised
- Input source where VCP 60 is advertised
- Monitor power where VCP D6 is advertised
- Refresh rate
- Resolution
- HDR
- Windows display topology
- Primary display
- Orientation
- Multi-monitor targeting
- Saved Monitor Profiles
- Stream Deck+ dials for brightness, contrast and volume

Night Light is intentionally excluded from v1 because this build does not rely on undocumented toggles.

## Monitor Profiles

A profile stores only settings the current hardware reports or Windows can query. Apply uses preflight + staged execution and returns COMPLETE, PARTIAL or FAILED.

Order:
1. preflight target matching and mode availability
2. Windows topology
3. Windows mode / primary / orientation
4. HDR
5. DDC/CI controls

Before changes, the current readable state is captured. If a later operation fails, reversible settings already changed are rolled back best-effort. Unsupported settings on the current topology are skipped and produce PARTIAL rather than a blind VCP write.

Example starter profiles:
- PC: DisplayPort, Extend, 165 Hz, 65% brightness
- CONSOLE: HDMI on main monitor, secondary remains PC
- WORK LAPTOP: USB-C input, work topology and brightness
- NIGHT: reduced brightness with explicitly supported display settings

## SEO map

Primary truthful phrases:
- Windows monitor manager
- display manager
- monitor control
- display control
- brightness
- refresh rate / Hz
- resolution
- HDR
- HDMI
- DisplayPort
- USB-C
- input switch
- multiple monitors
- DDC/CI
- screen
- Stream Deck

Marketplace snapshot anchors:
- Windows 198
- Monitor 71
- Screen 60
- Display 59

Do not infer purchases from search-popularity values and do not keyword-stuff unrelated keyboard/mouse terms.

## Bundled profile design

Use deterministic V2 .streamDeckProfile archives with real plugin actions.

Lite:
- Standard / MK
- XL
- Stream Deck+
- Virtual Stream Deck
- simple MONITOR / BRIGHTNESS / DISPLAY organization

Pro:
- Standard / MK
- XL
- Stream Deck+
- Virtual Stream Deck
- four real pages: MONITORS, PROFILES, DISPLAY MODES, BRIGHTNESS
- Stream Deck+ encoder controller uses brightness, contrast and volume actions

Profiles ship inside the plugins and are not separate products.

## Marketplace art

Deterministic Rat Art only.

Hero: CONTROL YOUR MONITORS.

The key grid must show real actions / configurations such as:
165 HZ, DP, HDMI, 65%, HDR, PC MODE.

## Price recommendation

- Monitor Manager Lite: Free
- Monitor Manager Pro: $9.99

$9.99 is justified only with working whole-setup Monitor Profiles and capability-aware multi-monitor control.
