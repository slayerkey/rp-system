#!/usr/bin/env python3
"""Scan files, directories, .streamDeckPlugin, .icuewidget, or generic ZIPs for PackRat canaries."""

from __future__ import annotations

import argparse
import json
import pathlib
import re
import sys
import zipfile

MARKER_RE = re.compile(rb"PKR1-[A-F0-9]{20}")
PROVENANCE_RE = re.compile(rb"PRV1-[A-F0-9]{40}")


def inspect_bytes(label: str, data: bytes) -> list[dict]:
    markers = sorted({m.decode("ascii") for m in MARKER_RE.findall(data)})
    provenance = sorted({m.decode("ascii") for m in PROVENANCE_RE.findall(data)})
    if not markers and not provenance:
        return []
    return [{"location": label, "markers": markers, "provenance_ids": provenance}]


def inspect_file(path: pathlib.Path) -> list[dict]:
    hits: list[dict] = []
    if zipfile.is_zipfile(path):
        with zipfile.ZipFile(path) as zf:
            for info in zf.infolist():
                if info.is_dir():
                    continue
                try:
                    data = zf.read(info)
                except Exception:
                    continue
                hits.extend(inspect_bytes(f"{path}!/{info.filename}", data))
        return hits

    try:
        data = path.read_bytes()
    except Exception:
        return []
    return inspect_bytes(str(path), data)


def scan(path: pathlib.Path) -> list[dict]:
    if path.is_dir():
        hits: list[dict] = []
        for child in path.rglob("*"):
            if child.is_file():
                hits.extend(inspect_file(child))
        return hits
    return inspect_file(path)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("target", type=pathlib.Path)
    ap.add_argument("--require-marker", help="Fail unless this exact PKR1 marker is found")
    args = ap.parse_args()

    if not args.target.exists():
        ap.error(f"target does not exist: {args.target}")

    hits = scan(args.target)
    markers = sorted({m for h in hits for m in h["markers"]})
    provenance = sorted({p for h in hits for p in h["provenance_ids"]})

    result = {
        "target": str(args.target),
        "markers": markers,
        "provenance_ids": provenance,
        "hits": hits,
    }
    print(json.dumps(result, indent=2))

    if args.require_marker and args.require_marker not in markers:
        print(f"Required PackRat marker not found: {args.require_marker}", file=sys.stderr)
        return 1
    if not markers and not provenance:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
