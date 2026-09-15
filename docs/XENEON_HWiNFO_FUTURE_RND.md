# HWiNFO future R&D boundary

Physical XENEON review raised a useful future idea: let Performance Grapher or PC Power Meter consume HWiNFO sensors in addition to iCUE sensors.

Do not mix this into the current V1 recovery.

A XENEON widget is browser JavaScript. HWiNFO publishes its broad sensor set through Windows shared memory and offers a native SDK/library. Neither interface is directly readable from an ordinary imported HTML widget. A production integration therefore needs a separate local/native bridge or a licensed embedded SDK path, plus installation, permissions, lifecycle, security, and support design.

If explored later, prefer a companion service with an explicit localhost API/WebSocket boundary so the XENEON widget remains a normal web client. Keep iCUE sensor mode independently usable. Do not make HWiNFO mandatory for the existing products.

Before commercial implementation, review HWiNFO licensing/integration terms and obtain approval where required.
