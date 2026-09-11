PackRat Audio Bridge 1.0.0 for Windows x64
Required companion for Audio Control Center on CORSAIR XENEON Edge.

RECOMMENDED SETUP
1. Extract this entire ZIP to a normal folder.
2. Double-click INSTALL_STARTUP.cmd.
3. Open/use Audio Control Center in iCUE. It reconnects automatically.

INSTALL_STARTUP.cmd copies only the bridge executable and documentation to:
%LOCALAPPDATA%\PackRat\AudioBridge

It creates one per-user Startup entry so the bridge starts when you sign in.
Installed uninstaller: %LOCALAPPDATA%\PackRat\UNINSTALL_AUDIO_BRIDGE.cmd
It does not require administrator access and does not install a Windows service.

PORTABLE MODE
Double-click START_AUDIO_BRIDGE.cmd instead. Keep the bridge running while using Audio Control Center.

REMOVE STARTUP INSTALL
Double-click UNINSTALL_STARTUP.cmd.

SECURITY
The bridge listens only on 127.0.0.1:17484.
There is no PackRat cloud service, account, telemetry, analytics, token, or API key.
See SECURITY.md for the full local security boundary.

If Audio Control Center shows BRIDGE UPDATE REQUIRED, install the companion version linked by the product listing.
