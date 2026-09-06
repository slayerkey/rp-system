#!/usr/bin/env python3
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PRODUCT = ROOT / "products" / "ultimate-rgb.json"
ROUTER = ROOT / "tools" / "local" / "rat-marketplace.ps1"
HELPER = ROOT / "tools" / "local" / "rat-ship-icon-pack.ps1"
RENDERER = ROOT / "tools" / "art" / "rat_art_icon_pack.py"
FINALIZER = ROOT / "tools" / "art" / "finalize_icon_pack_release.py"


def require(condition: bool, message: str) -> None:
    if not condition:
        raise SystemExit(message)


def main() -> None:
    for path in (PRODUCT, ROUTER, HELPER, RENDERER, FINALIZER):
        require(path.is_file(), f"missing icon-pack contract file: {path}")

    product = json.loads(PRODUCT.read_text(encoding="utf-8"))
    require(product.get("type") == "icon_pack", "Ultimate RGB must use type=icon_pack")
    require(product.get("workflow_state") == "BLOCKED", "Ultimate RGB public release must remain blocked before the physical/official packaging boundary")
    require(product.get("name") == "Ultimate RGB", "Marketplace product name must remain Ultimate RGB")
    require(not str(product.get("name", "")).casefold().startswith("packrat "), "Marketplace product name must not include the PackRat Maker prefix")
    require(len(str(product.get("description", "")).strip()) >= 250, "Marketplace description must be at least 250 characters")
    factory = product.get("icon_factory") or {}
    commit = str(factory.get("commit", ""))
    require(bool(re.fullmatch(r"[0-9a-f]{40}", commit)), "icon_factory.commit must be an exact lowercase 40-character SHA")
    require(commit == "22677e8124cc6415046f8b20eae2d95782e2dcaf", "Ultimate RGB factory pin drifted from validated #75 candidate")
    require(factory.get("validation_run") == 33356664223, "Ultimate RGB factory validation-run pin drifted")
    require(factory.get("product") == "ultimate-rgb", "factory product mismatch")
    require(str(product.get("marketplace_id", "")).startswith("com.packrat."), "production marketplace id is missing")
    require(product.get("expected_static_icons") == 627, "Ultimate RGB static-count guard drifted")
    require(product.get("expected_animated_icons") == 96, "Ultimate RGB animation-count guard drifted")
    require(product.get("expected_picker_entries") == 723, "Ultimate RGB picker-count guard drifted")
    require(product.get("expected_unique_glyphs") == 507, "Ultimate RGB distinct-glyph guard drifted")
    require(product.get("expected_reuse_groups") == 75, "Ultimate RGB structural-reuse guard drifted")
    require(product.get("expected_exact_visual_duplicate_groups") == 0, "Ultimate RGB exact-visual-duplicate guard drifted")
    license_sha = str(product.get("expected_license_sha256", ""))
    require(bool(re.fullmatch(r"[0-9a-f]{64}", license_sha)), "expected_license_sha256 must be an exact lowercase SHA-256")
    require(license_sha == "bf8e3dbc7cb0175f2783a7bd974106985c67d5d670b4826ee7f4d539b61a6b7d", "Ultimate RGB license hash guard drifted")

    router = ROUTER.read_text(encoding="utf-8")
    require('$product.type -eq "icon_pack"' in router, "Marketplace router does not recognize icon_pack")
    require('$Action -ne "kit"' in router, "icon_pack route must reject public stage/ship actions")
    require('rat-ship-icon-pack.ps1' in router, "Marketplace router does not call the icon-pack helper")
    require('will not create or modify a Maker Console draft' in router, "icon-pack public-route fail-closed explanation is missing")

    helper = HELPER.read_text(encoding="utf-8")
    for needle in (
        "icon_factory.commit must be one exact 40-character Git commit SHA",
        "source identity mismatch",
        "Static icon count drift",
        "Animated icon count drift",
        "Picker-entry count drift",
        "Distinct glyph count drift",
        "Structural reuse group drift",
        "duplicate picker names or paths",
        "does not match RatPack product marketplace_id",
        "audit_structural_reuse.py",
        "finalize_icon_pack_release.py",
        "FACTORY-RELEASE-AUDIT.json",
        "ICON_PACK_MAN_NEXT.txt",
        "PHYSICAL-TEST.txt",
        "SOURCE-IDENTITY.json",
    ):
        require(needle in helper, f"icon-pack helper lost required fail-closed contract: {needle}")

    finalizer = FINALIZER.read_text(encoding="utf-8")
    compile(finalizer, str(FINALIZER), "exec")
    for needle in (
        "MARKETPLACE_APP_ICON_SIZE = 288",
        "MIN_MARKETPLACE_DESCRIPTION_CHARS = 250",
        "Marketplace product name must not include the PackRat Maker prefix",
        "staged manifest name mismatch",
        "staged license content drift",
        "canonical_text_bytes",
        "expected_license_sha256",
        "raw_file_sha256",
        "canonical_sha256",
        "exact_visual_duplicate_groups",
        "structural-reuse-report.json",
        "staged icon.svg does not match the pinned product source icon.svg",
        "resvg_py.svg_to_bytes",
        "FACTORY-RELEASE-AUDIT.json",
        '"source": "package-staging/license.txt"',
        '"source": "package-staging/icon.svg"',
    ):
        require(needle in finalizer, f"icon-pack release finalizer lost required contract: {needle}")

    print("Icon-pack Rat kit contract PASS")


if __name__ == "__main__":
    main()
