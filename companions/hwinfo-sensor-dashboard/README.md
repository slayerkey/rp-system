# PackRat HWiNFO Bridge

Free local Windows companion required by **HWiNFO Sensor Dashboard** for CORSAIR XENEON Edge.

## Requirements
- Windows x64
- HWiNFO 7.0 or later installed separately; 7.34+ recommended for UTF-8 Shared Memory strings
- HWiNFO Sensors active
- HWiNFO **Shared Memory Support** enabled

The free HWiNFO64 edition may disable Shared Memory after 12 hours of continuous runtime. This bridge reports the loss and does not bypass or extend that limit.

## Install
1. Extract the ZIP.
2. Run `Install.cmd`.
3. The local setup page opens at `http://127.0.0.1:17489/`.
4. Copy the pairing key into the widget's **HWiNFO Bridge Pairing Key** field in iCUE.

## What it does
The bridge opens HWiNFO's documented `Global\HWiNFO_SENS_SM2` Shared Memory mapping read-only, uses HWiNFO's mutex while copying a snapshot, normalizes numeric sensor readings, and publishes them to authenticated WebSocket clients on localhost.

It does **not** bundle, launch, patch, modify, redistribute, or license HWiNFO. It does not write to HWiNFO Shared Memory. It does not send sensor data to PackRat.

## Status recovery
- **HWiNFO not running:** start HWiNFO in Sensors mode.
- **Shared Memory unavailable/inactive:** enable Shared Memory Support and keep Sensors active.
- **Shared Memory stopped after previously working:** free HWiNFO64 may have reached its 12-hour Shared Memory runtime limit; re-enable it or use a HWiNFO edition/license appropriate for your needs.
- **Access denied:** run HWiNFO and the PackRat bridge at compatible Windows privilege levels.
- **No sensors:** wait for the HWiNFO Sensors window to populate.
- **Pairing issue:** open the local setup page and copy/rotate the key.

HWiNFO is a third-party product and trademark of its respective owner. PackRat is independent and is not affiliated with, endorsed by, or sponsored by HWiNFO.
