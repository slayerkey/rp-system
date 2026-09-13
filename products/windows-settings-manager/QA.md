# Windows Settings Manager QA

## Automated

- TypeScript strict compile
- deterministic Lite and Pro assembly
- official Elgato CLI validation
- official package creation
- seven bundled profile device families per edition
- Lite cannot expose Pro actions
- Pro ships five named but empty PC Mode slots
- backend rejects brittle UI automation patterns
- Windows backend process smoke: ping, snapshot, Keep Awake on/off
- live state polling regression
- COMPLETE / PARTIAL / FAILED policy regression

## Required physical Windows QA before Marketplace release

### Windows 11
- HDR-capable single display: read, On, Off, Toggle
- HDR unsupported display: N/A and no false success
- mixed HDR across multiple active displays
- external HDR change through Windows Settings is reflected on Stream Deck
- Extend, Duplicate, PC screen only, Second screen only
- multiple external monitors
- laptop internal panel + external monitor
- installed power plans and externally changed active plan
- screen and sleep timeout read/write on AC
- battery timeout behavior on a laptop
- Keep Awake enable/disable, plugin restart, sleep/resume
- lock workstation
- reboot and Stream Deck restart
- bundled profile install and page navigation on Standard, Mini, XL, Stream Deck +, Neo, Galleon 100 SD, and Stream Deck + XL
- partial mode failure, including one unsupported/failed step with other steps succeeding

### Windows 10
- power plans
- display topology
- screen/sleep timeout
- Keep Awake
- lock workstation
- HDR reports N/A and no HDR write is attempted

Windows 11 24H2+ (build 26100+) uses the separated Advanced Color Info 2 / HDR State path. Older Windows builds deliberately expose no PackRat HDR control path because legacy Advanced Color is ambiguous with SDR WCG/automatic color management. The runtime build comes from RtlGetVersion, not Environment.OSVersion or packet probing. QA must verify that pre-24H2 systems remain N/A and that an SDR automatic-color-management display is never surfaced as HDR.

## Not applicable in v1

Night Light, Do Not Disturb, Bluetooth, Wi-Fi, global theme, and audio controls are intentionally not shipped. Missing Bluetooth/Wi-Fi adapters therefore cannot produce a broken PackRat control because no such control exists.

## Release blockers

Physical display/HDR testing cannot be replaced by hosted CI. Keep both product records BLOCKED until the physical matrix above is completed and deterministic Marketplace media is reviewed.
