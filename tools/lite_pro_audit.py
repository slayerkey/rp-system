#!/usr/bin/env python3
"""Audit PackRat Lite/Free -> Pro relationships and fail closed for shipping.

Normal mode is portfolio visibility: unresolved publication/link state is reported.
Shipping mode is a release gate for one Lite product and fails unless its true Pro
counterpart is registered and both direct public Marketplace URLs are recorded.
"""
from __future__ import annotations

import argparse
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
INDEX = ROOT / "products" / "index.json"
MAP = ROOT / "products" / "lite-pro-map.json"

DIRECT_PRODUCT_RE = re.compile(
    r"^https://marketplace\.elgato\.com/product/[a-z0-9][a-z0-9-]*-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/?$",
    re.I,
)
BAD_URL_MARKERS = (
    "REPLACE_WITH",
    "TODO_PRO_URL",
    "example.com",
    "marketplace.elgato.com/search?",
    "marketplace.elgato.com/?search=",
    "marketplace.elgato.com/icue",
    "marketplace.elgato.com/@packrat",
)
SOURCE_SUFFIXES = {".html", ".js", ".mjs", ".json", ".ts", ".tsx", ".jsx"}


def load_json(path: pathlib.Path):
    return json.loads(path.read_text(encoding="utf-8"))


def product_table(index):
    return {item["id"]: item for item in index.get("products", []) if isinstance(item, dict) and item.get("id")}


def is_direct_product_url(value):
    return isinstance(value, str) and bool(DIRECT_PRODUCT_RE.fullmatch(value.strip()))


def marketplace_uuid_from_url(value):
    if not is_direct_product_url(value):
        return None
    match = re.search(
        r"-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/?$",
        value.strip(),
        re.I,
    )
    return match.group(1).lower() if match else None


def scan_path(relative: str):
    root = ROOT / relative
    if not root.exists():
        return [(relative, "missing source path")]
    files = [root] if root.is_file() else [p for p in root.rglob("*") if p.is_file() and p.suffix.lower() in SOURCE_SUFFIXES]
    findings = []
    for path in files:
        try:
            text = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        for marker in BAD_URL_MARKERS:
            if marker.lower() in text.lower():
                findings.append((str(path.relative_to(ROOT)).replace("\\", "/"), marker))
    return findings


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--shipping", metavar="LITE_ID", help="strict release gate for one Lite product")
    parser.add_argument("--json", action="store_true", help="emit machine-readable result")
    args = parser.parse_args()

    index = load_json(INDEX)
    relationship_map = load_json(MAP)
    products = product_table(index)

    warnings = []
    errors = []
    rows = []

    for pair in relationship_map.get("pairs", []):
        lite_id = pair.get("lite_id")
        pro_id = pair.get("pro_id")
        classification = pair.get("classification", "unknown")
        lite = products.get(lite_id)
        pro = products.get(pro_id) if pro_id else None
        strict = args.shipping == lite_id

        if classification == "lite_to_pro":
            if not lite:
                errors.append(f"{lite_id}: Lite product missing from products/index.json")
            if not pro:
                errors.append(f"{lite_id}: Pro product {pro_id!r} missing from products/index.json")
            if lite and float(lite.get("price_usd") or 0) != 0:
                errors.append(f"{lite_id}: Lite product is not free in canonical index")
            if pro and not (float(pro.get("price_usd") or 0) > 0):
                errors.append(f"{lite_id}: Pro counterpart is not paid in canonical index")
            if lite and pro and lite.get("type") != pro.get("type"):
                errors.append(
                    f"{lite_id}: Lite/Pro product type mismatch "
                    f"({lite.get('type')!r} -> {pro.get('type')!r}); "
                    "do not attach or substitute a profile/plugin edition accidentally"
                )

        elif classification == "lite_with_unregistered_pro":
            if strict:
                errors.append(f"{lite_id}: Pro source/name exists but {pro_id!r} is not a registered canonical product")
            elif not pro:
                warnings.append(f"{lite_id}: Pro counterpart {pro_id!r} is not registered in canonical index")

        elif classification.startswith("ambiguous"):
            if strict:
                errors.append(f"{lite_id}: relationship is {classification}; resolve before shipping")
            else:
                warnings.append(f"{lite_id}: relationship is {classification}")

        lite_url = pair.get("lite_marketplace_url")
        pro_url = pair.get("pro_marketplace_url")
        if lite_url and not is_direct_product_url(lite_url):
            errors.append(f"{lite_id}: Lite Marketplace URL is not a direct product URL: {lite_url}")
        if pro_url and not is_direct_product_url(pro_url):
            errors.append(f"{lite_id}: Pro Marketplace URL is not a direct product URL: {pro_url}")

        lite_marketplace_id = str(pair.get("lite_marketplace_product_id") or "").strip().lower()
        pro_marketplace_id = str(pair.get("pro_marketplace_product_id") or "").strip().lower()
        lite_url_id = marketplace_uuid_from_url(lite_url)
        pro_url_id = marketplace_uuid_from_url(pro_url)
        if lite_marketplace_id and lite_url_id and lite_marketplace_id != lite_url_id:
            errors.append(
                f"{lite_id}: Lite Marketplace URL UUID {lite_url_id} does not match "
                f"catalog UUID {lite_marketplace_id}"
            )
        if pro_marketplace_id and pro_url_id and pro_marketplace_id != pro_url_id:
            errors.append(
                f"{lite_id}: Pro Marketplace URL UUID {pro_url_id} does not match "
                f"catalog UUID {pro_marketplace_id}"
            )

        if strict:
            if classification != "lite_to_pro":
                pass
            else:
                if not is_direct_product_url(lite_url):
                    errors.append(f"{lite_id}: direct verified Lite Marketplace URL required for shipping")
                if not is_direct_product_url(pro_url):
                    errors.append(f"{lite_id}: direct verified Pro Marketplace URL required for shipping")
                if pro and str(pro.get("status", "")).lower() != "published":
                    errors.append(f"{lite_id}: Pro status is {pro.get('status')!r}, not 'published'")

        source_findings = []
        for source_path in pair.get("source_paths", []):
            source_findings.extend(scan_path(source_path))
        if source_findings:
            detail = "; ".join(f"{path} contains {marker!r}" for path, marker in source_findings)
            if strict:
                errors.append(f"{lite_id}: non-direct/placeholder upgrade destination in source: {detail}")
            else:
                warnings.append(f"{lite_id}: source contains non-direct/placeholder Marketplace destination: {detail}")

        rows.append({
            "lite_id": lite_id,
            "pro_id": pro_id,
            "classification": classification,
            "lite_status": lite.get("status") if lite else None,
            "pro_status": pro.get("status") if pro else None,
            "lite_url_verified": is_direct_product_url(lite_url),
            "pro_url_verified": is_direct_product_url(pro_url),
            "source_findings": source_findings,
        })

    if args.shipping and not any(row["lite_id"] == args.shipping for row in rows):
        errors.append(f"{args.shipping}: no Lite/Pro relationship record exists")

    result = {"ok": not errors, "shipping": args.shipping, "rows": rows, "warnings": warnings, "errors": errors}
    if args.json:
        print(json.dumps(result, indent=2))
    else:
        print("PackRat Lite -> Pro audit")
        print(f"pairs/ambiguous records: {len(rows)}")
        print(f"warnings: {len(warnings)}")
        print(f"errors: {len(errors)}")
        for item in warnings:
            print(f"WARN: {item}")
        for item in errors:
            print(f"ERROR: {item}")
        if args.shipping:
            print("SHIP GATE: " + ("PASS" if not errors else "FAIL"))
        else:
            print("AUDIT: " + ("PASS" if not errors else "FAIL"))

    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
