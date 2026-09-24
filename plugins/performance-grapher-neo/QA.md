# Performance Grapher Neo — QA / shipping gate

**Product:** Neo-only standalone edition, version 1.0.0.0
**Candidate branch:** product/performance-grapher-neo
**State:** BUILDING pending exact-head clean CI, Neo hardware smoke, and separate listing price/media approval.

## Automated (must pass on EXACT source commit)

- [ ] Existing shared sensor/history/render unit tests + new standalone Neo-only unit tests
- [ ] Build/publish and probe previously proven native Libre Hardware Monitor helper on Windows
- [ ] Official Elgato CLI Neo-only manifest/layout validation and actual package
- [ ] Inspect exact output archive: ONLY the one Neo action, no old UUIDs or profiles, correct manifest/package UUID, local layouts, images, PI and helper, no bundled PresentMon binary
- [ ] PI transport syntax, settings/save contract, Neo lifecycle initial settings, dis/appear and multiple-context guards
- [ ] Package checksum, build SHA, updated license notices and accurate Marketplace art/report

## Actual hardware (do NOT label PASS without a Neo)

- [ ] On Windows + Stream Deck 7.6+, add **Live Performance Infobar** to Neo’s 232×50 display and verify all three percentages align without clipping; GPU missing must display `--`, not `0%`.
- [ ] Select Single Metric: GPU load or CPU load; verify companion text/trend after 60s with history and labels toggled both ways; reopen PI and verify settings persist.
- [ ] Select Rotating Metrics and verify three selections/3s,5s,10s cycles and correct metric text; test no compatible GPU.
- [ ] Change layout modes repeatedly; remove/readd; confirm no stale feedback or timer storms and native sensor child stops with the last Infobar.
- [ ] When co-installed with original Performance Grapher, verify independent plugin identities, no original profiles/actions changed, and document measured extra resource use.

Release gate: exact-head CI success, complete standalone art and listing pricing, then physical Neo smoke or an explicitly accepted/deferred operator risk. Do not report previous original-plugin 1.0 proof as proof of this new package.
