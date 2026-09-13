#!/usr/bin/env python3
"""Finalize and audit a deterministic PackRat Stream Deck icon-pack review kit.

This runs after the pinned external icon factory has completed its normal build,
QA, marketing, and package-staging steps. It deliberately re-checks the release
properties RatPack depends on instead of trusting historical CI alone:

* exact rendered RGBA duplicates
* the factory's reviewed structural-reuse report
* exact expected product counts
* zero-warning/zero-failure QA
* Marketplace product-name propagation
* pinned staged license content (newline-normalized across operating systems)
* package icon provenance
* review-kit product-mark provenance

The finalizer writes FACTORY-RELEASE-AUDIT.json into the Rat kit and replaces the
review-kit product mark with a deterministic 288px raster of the staged product
icon.svg. The staged SVG remains the source of truth. The authenticated Maker
Console Icons wizard remains the authority for its icon-preview upload fields.
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import re
from collections import defaultdict
from pathlib import Path
from typing import Any

from PIL import Image

MARKETPLACE_APP_ICON_SIZE = 288
MIN_MARKETPLACE_DESCRIPTION_CHARS = 250


def fail(message: str) -> None:
    raise SystemExit(f"RAT ICON RELEASE AUDIT FAIL: {message}")


def read_json(path: Path) -> Any:
    if not path.is_file():
        fail(f"missing required JSON: {path}")
    try:
        return json.loads(path.read_text(encoding="utf-8-sig"))
    except json.JSONDecodeError as exc:
        fail(f"invalid JSON in {path}: {exc}")


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def canonical_text_bytes(value: bytes) -> bytes:
    """Return UTF-8 text with BOM removed and all line endings normalized to LF."""
    try:
        text = value.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        fail(f"expected UTF-8 text payload: {exc}")
    return text.replace("\r\n", "\n").replace("\r", "\n").encode("utf-8")


def exact_visual_duplicate_groups(static_dir: Path) -> list[list[str]]:
    if not static_dir.is_dir():
        fail(f"missing static output directory: {static_dir}")
    groups: dict[str, list[str]] = defaultdict(list)
    for path in sorted(static_dir.glob("*.png")):
        with Image.open(path) as image:
            digest = sha256_bytes(image.convert("RGBA").tobytes())
        groups[digest].append(path.stem)
    return sorted(sorted(ids) for ids in groups.values() if len(ids) > 1)


def rasterize_product_icon(svg_path: Path, destination: Path) -> dict[str, Any]:
    if not svg_path.is_file():
        fail(f"staged product icon is missing: {svg_path}")
    svg_bytes = svg_path.read_bytes()
    try:
        import resvg_py
    except ImportError as exc:  # pragma: no cover - factory requirements provide it
        raise SystemExit("RAT ICON RELEASE AUDIT FAIL: resvg_py is required to rasterize the product icon") from exc

    try:
        png_bytes = bytes(
            resvg_py.svg_to_bytes(
                svg_string=svg_bytes.decode("utf-8"),
                width=MARKETPLACE_APP_ICON_SIZE,
                height=MARKETPLACE_APP_ICON_SIZE,
            )
        )
    except Exception as exc:
        fail(f"could not rasterize staged product icon.svg: {exc}")

    try:
        with Image.open(io.BytesIO(png_bytes)) as image:
            rendered = image.convert("RGBA")
            expected = (MARKETPLACE_APP_ICON_SIZE, MARKETPLACE_APP_ICON_SIZE)
            if rendered.size != expected:
                fail(f"product search icon rendered at {rendered.size}, expected {expected[0]}x{expected[1]}")
            if rendered.getbbox() is None:
                fail("product search icon rendered completely transparent")
            destination.parent.mkdir(parents=True, exist_ok=True)
            rendered.save(destination, "PNG", optimize=True)
    except OSError as exc:
        fail(f"rasterized product icon is not a valid PNG: {exc}")

    return {
        "source": "package-staging/icon.svg",
        "source_sha256": sha256_bytes(svg_bytes),
        "output": destination.name,
        "output_sha256": sha256_bytes(destination.read_bytes()),
        "width": MARKETPLACE_APP_ICON_SIZE,
        "height": MARKETPLACE_APP_ICON_SIZE,
    }


def expected_int(product: dict[str, Any], key: str) -> int:
    value = product.get(key)
    if isinstance(value, bool) or not isinstance(value, int):
        fail(f"RatPack product spec requires integer {key}")
    return value


def expected_sha256(product: dict[str, Any], key: str) -> str:
    value = str(product.get(key) or "").strip().lower()
    if not re.fullmatch(r"[0-9a-f]{64}", value):
        fail(f"RatPack product spec requires lowercase SHA-256 {key}")
    return value


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--factory-root", required=True)
    parser.add_argument("--factory-out", required=True)
    parser.add_argument("--product-spec", required=True)
    parser.add_argument("--kit", required=True)
    args = parser.parse_args()

    factory_root = Path(args.factory_root).resolve()
    factory_out = Path(args.factory_out).resolve()
    product_spec_path = Path(args.product_spec).resolve()
    kit = Path(args.kit).resolve()

    product = read_json(product_spec_path)
    slug = str(product.get("id") or "").strip()
    product_name = str(product.get("name") or "").strip()
    description = str(product.get("description") or "").strip()
    factory_meta = product.get("icon_factory") or {}
    factory_product = str(factory_meta.get("product") or "").strip()
    if product.get("type") != "icon_pack" or not slug or not factory_product or not product_name:
        fail("product spec is not a complete icon_pack registration")
    if product_name.casefold().startswith("packrat "):
        fail("Marketplace product name must not include the PackRat Maker prefix")
    if len(description) < MIN_MARKETPLACE_DESCRIPTION_CHARS:
        fail(
            f"Marketplace description is too short: {len(description)} < "
            f"{MIN_MARKETPLACE_DESCRIPTION_CHARS} characters"
        )

    expected_static = expected_int(product, "expected_static_icons")
    expected_animated = expected_int(product, "expected_animated_icons")
    expected_picker = expected_int(product, "expected_picker_entries")
    expected_unique = expected_int(product, "expected_unique_glyphs")
    expected_reuse = expected_int(product, "expected_reuse_groups")
    expected_visual_dupes = expected_int(product, "expected_exact_visual_duplicate_groups")
    expected_license_sha = expected_sha256(product, "expected_license_sha256")

    qa = read_json(factory_out / "qa" / "qa-report.json")
    qa_summary = qa.get("summary") or {}
    qa_failures = int(qa_summary.get("failures", -1))
    qa_warnings = int(qa_summary.get("warnings", -1))
    if not qa.get("pass") or qa_failures != 0 or qa_warnings != 0:
        fail(f"factory QA is not clean: failures={qa_failures}, warnings={qa_warnings}")

    structural = read_json(factory_out / "qa" / "structural-reuse-report.json")
    structural_summary = structural.get("summary") or {}
    selected_count = int(structural_summary.get("selected_count", -1))
    unique_glyphs = int(structural_summary.get("unique_glyphs", -1))
    reuse_groups = int(structural_summary.get("reuse_groups", -1))
    unexpected_groups = int(structural_summary.get("unexpected_groups", -1))
    if not structural.get("pass") or unexpected_groups != 0:
        fail(f"factory structural reuse audit is not clean: unexpected_groups={unexpected_groups}")
    if selected_count != expected_static:
        fail(f"structural selected count drift: expected {expected_static}, got {selected_count}")
    if unique_glyphs != expected_unique:
        fail(f"distinct glyph count drift: expected {expected_unique}, got {unique_glyphs}")
    if reuse_groups != expected_reuse:
        fail(f"structural reuse group drift: expected {expected_reuse}, got {reuse_groups}")

    duplicate_groups = exact_visual_duplicate_groups(factory_out / "static")
    if len(duplicate_groups) != expected_visual_dupes:
        for ids in duplicate_groups:
            print("EXACT VISUAL DUPLICATE:", ", ".join(ids))
        fail(
            "exact RGBA visual duplicate group drift: "
            f"expected {expected_visual_dupes}, got {len(duplicate_groups)}"
        )

    handoff = read_json(factory_out / "marketing" / "rat-art-icons.json")
    static_count = int(handoff.get("actual_icon_count", -1))
    animated_count = int(handoff.get("animated_icon_count", -1))
    handoff_name = str(handoff.get("name") or "").strip()
    if handoff_name != product_name:
        fail(f"Rat Art handoff name mismatch: expected {product_name!r}, got {handoff_name!r}")

    staging = factory_out / "package-staging"
    package_manifest = read_json(staging / "manifest.json")
    staged_name = str(package_manifest.get("Name") or "").strip()
    if staged_name != product_name:
        fail(f"staged manifest name mismatch: expected {product_name!r}, got {staged_name!r}")

    license_path = staging / "license.txt"
    if not license_path.is_file():
        fail("package staging license.txt is missing")
    license_bytes = license_path.read_bytes()
    staged_license_raw_sha = sha256_bytes(license_bytes)
    staged_license_sha = sha256_bytes(canonical_text_bytes(license_bytes))
    if staged_license_sha != expected_license_sha:
        fail(
            "staged license content drift: "
            f"expected canonical {expected_license_sha}, got {staged_license_sha} "
            f"(raw file SHA-256 {staged_license_raw_sha})"
        )

    staged_entries = read_json(staging / "icons.json")
    if not isinstance(staged_entries, list):
        fail("package-staging/icons.json must contain a list")
    if static_count != expected_static:
        fail(f"static icon count drift: expected {expected_static}, got {static_count}")
    if animated_count != expected_animated:
        fail(f"animated icon count drift: expected {expected_animated}, got {animated_count}")
    if len(staged_entries) != expected_picker:
        fail(f"picker-entry count drift: expected {expected_picker}, got {len(staged_entries)}")

    names = [str(entry.get("name", "")).strip().casefold() for entry in staged_entries]
    paths = [str(entry.get("path", "")).strip().casefold() for entry in staged_entries]
    if len(names) != len(set(names)) or len(paths) != len(set(paths)):
        fail("package staging contains duplicate picker names or paths")

    source_icon = factory_root / "icon-products" / factory_product / "icon.svg"
    staged_icon = staging / "icon.svg"
    if not source_icon.is_file() or not staged_icon.is_file():
        fail("product source icon.svg or staged icon.svg is missing")
    source_icon_bytes = source_icon.read_bytes()
    staged_icon_bytes = staged_icon.read_bytes()
    if source_icon_bytes != staged_icon_bytes:
        fail("staged icon.svg does not match the pinned product source icon.svg")

    search_icon = rasterize_product_icon(staged_icon, kit / "01_search_icon.png")

    result = {
        "schema_version": 2,
        "ratpack_product": slug,
        "factory_product": factory_product,
        "product_name": product_name,
        "pass": True,
        "marketplace_metadata": {
            "name": staged_name,
            "description_characters": len(description),
            "maker_prefix_absent": True,
        },
        "counts": {
            "static_icons": static_count,
            "animated_icons": animated_count,
            "picker_entries": len(staged_entries),
        },
        "qa": {
            "failures": qa_failures,
            "warnings": qa_warnings,
        },
        "structural_reuse": {
            "selected_count": selected_count,
            "unique_glyphs": unique_glyphs,
            "reuse_groups": reuse_groups,
            "unexpected_groups": unexpected_groups,
        },
        "exact_visual_duplicates": {
            "groups": len(duplicate_groups),
            "ids": duplicate_groups,
        },
        "license": {
            "source": "package-staging/license.txt",
            "expected_canonical_sha256": expected_license_sha,
            "canonical_sha256": staged_license_sha,
            "raw_file_sha256": staged_license_raw_sha,
            "newline_normalized": True,
            "provenance_match": True,
        },
        "package_icon": {
            "source": f"icon-products/{factory_product}/icon.svg",
            "source_sha256": sha256_bytes(source_icon_bytes),
            "staged_sha256": sha256_bytes(staged_icon_bytes),
            "provenance_match": True,
        },
        "search_icon": search_icon,
    }
    output = kit / "FACTORY-RELEASE-AUDIT.json"
    output.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(
        "Icon-pack release audit PASS:",
        f"{product_name};",
        f"{static_count} static + {animated_count} animated = {len(staged_entries)} picker entries;",
        f"{unique_glyphs} distinct glyphs; {reuse_groups} reviewed reuse groups;",
        f"{unexpected_groups} unexpected structural groups; {len(duplicate_groups)} exact RGBA duplicate groups;",
        f"license canonical {staged_license_sha[:12]}...;",
        f"review product mark {MARKETPLACE_APP_ICON_SIZE}x{MARKETPLACE_APP_ICON_SIZE}",
    )


if __name__ == "__main__":
    main()
