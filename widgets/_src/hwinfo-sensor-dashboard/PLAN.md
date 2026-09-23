# HWiNFO Sensor Dashboard

Architecture: HWiNFO Shared Memory -> PackRat HWiNFO Sensor Bridge -> localhost WebSocket -> XENEON Edge widget.

V1 is read-only. It does not start, modify, patch, redistribute, or license HWiNFO. The bridge requires HWiNFO's documented shared-memory mapping and consistency mutex and honors the application's availability/runtime behavior.

Marketplace position: **Any HWiNFO sensor on your XENEON Edge, with live graphs and history.**

Price: **$12.99 one time**. This sits above the generic Performance Grapher because it adds arbitrary HWiNFO discovery, HWiNFO source statistics, local companion integration, per-slot configuration, and broad motherboard/storage/cooling telemetry while remaining inside the expected $9.99-$12.99 range.
