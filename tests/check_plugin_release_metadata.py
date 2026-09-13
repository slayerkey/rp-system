#!/usr/bin/env python3
"""Validate semantic consistency for Stream Deck plugin release metadata.

Only product records that explicitly declare submission_metadata participate.
Legacy/in-progress plugin records without submission metadata remain out of scope.
"""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PRODUCTS = ROOT / "products"

REQUIRED_EXTERNAL_ARTIFACT_FIELDS = (
    "repository",
    "run_id",
    "name",
    "commit",
    "package_path",
    "package_sha256",
)


def load(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def fail(errors: list[str], message: str) -> None:
    errors.append(message)


def main() -> int:
    errors: list[str] = []
    checked = 0

    for path in sorted(PRODUCTS.glob("*.json")):
        if path.name in {"index.json", "lite-pro-map.json"}:
            continue
        try:
            product = load(path)
        except Exception as exc:
            fail(errors, f"{path.relative_to(ROOT)}: invalid JSON: {exc}")
            continue

        if product.get("type") != "plugin":
            continue

        submission_rel = product.get("submission_metadata")
        if not submission_rel:
            continue

        checked += 1
        submission_path = ROOT / str(submission_rel)
        if not submission_path.is_file():
            fail(errors, f"{path.relative_to(ROOT)}: submission metadata missing: {submission_rel}")
            continue

        try:
            submission = load(submission_path)
        except Exception as exc:
            fail(errors, f"{submission_rel}: invalid JSON: {exc}")
            continue

        product_id = str(product.get("id") or "")
        if submission.get("slug") != product_id:
            fail(errors, f"{product_id}: submission slug {submission.get('slug')!r} does not match product id")
        if submission.get("type") != "plugin":
            fail(errors, f"{product_id}: submission type must be 'plugin'")

        if product.get("price_usd") is not None and submission.get("price_usd") is not None:
            if float(product["price_usd"]) != float(submission["price_usd"]):
                fail(
                    errors,
                    f"{product_id}: product price {product['price_usd']} != submission price {submission['price_usd']}",
                )

        if product.get("version") and submission.get("version"):
            if str(product["version"]) != str(submission["version"]):
                fail(
                    errors,
                    f"{product_id}: product version {product['version']} != submission version {submission['version']}",
                )

        state = str(product.get("workflow_state") or "").upper()
        external = bool(product.get("source_repository"))
        artifact = product.get("release_artifact")

        if external and state == "READY_TO_SHIP":
            if not isinstance(artifact, dict):
                fail(errors, f"{product_id}: READY_TO_SHIP external plugin must pin release_artifact")
            else:
                for field in REQUIRED_EXTERNAL_ARTIFACT_FIELDS:
                    value = artifact.get(field)
                    if value is None or str(value).strip() == "":
                        fail(errors, f"{product_id}: release_artifact missing {field!r}")

                artifact_commit = str(artifact.get("commit") or "")
                source_commit = str(product.get("source_commit") or "")
                if source_commit and artifact_commit and source_commit != artifact_commit:
                    fail(
                        errors,
                        f"{product_id}: source_commit {source_commit} != release_artifact.commit {artifact_commit}",
                    )

                media = artifact.get("media")
                if not isinstance(media, dict):
                    fail(errors, f"{product_id}: READY_TO_SHIP external plugin must pin release_artifact.media")
                else:
                    if not str(media.get("search_icon") or "").strip():
                        fail(errors, f"{product_id}: release_artifact.media.search_icon is required")
                    if not str(media.get("cover") or "").strip():
                        fail(errors, f"{product_id}: release_artifact.media.cover is required")
                    gallery = media.get("gallery")
                    if not isinstance(gallery, list) or len(gallery) != 4 or any(not str(x).strip() for x in gallery):
                        fail(errors, f"{product_id}: release_artifact.media.gallery must contain exactly four files")

        if external and state == "BLOCKED" and artifact:
            # A blocked release may already have an artifact, but if present it still must be internally coherent.
            artifact_commit = str(artifact.get("commit") or "")
            source_commit = str(product.get("source_commit") or "")
            if source_commit and artifact_commit and source_commit != artifact_commit:
                fail(
                    errors,
                    f"{product_id}: blocked external artifact commit does not match source_commit",
                )

    print(f"Plugin release metadata preflight: checked={checked} errors={len(errors)}")
    for error in errors:
        print(f"ERROR: {error}")
    if errors:
        return 1
    print("PLUGIN RELEASE METADATA PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
