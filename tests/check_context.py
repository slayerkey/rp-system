from pathlib import Path
import json
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
errors = []

required = [
    "RATPACK.md",
    "STREAMDECK.md",
    "products/index.json",
    "skills/rat/SKILL.md",
    "skills/rat-validate/SKILL.md",
    "skills/rat-build/SKILL.md",
    "skills/rat-art/SKILL.md",
    "skills/rat-qa/SKILL.md",
    "skills/rat-ship/SKILL.md",
    "skills/icue-widget-builder/SKILL.md",
    "platforms/streamdeck.md",
    "platforms/icue-xeneon.md",
    "docs/RAT-DEV-RELIABILITY.md",
    "docs/STREAMDECK_TROUBLESHOOTING_PLAYBOOK.md",
    "docs/FRESH_CHAT_ACCEPTANCE.md",
    "standards/product-state.md",
    "standards/streamdeck-plugin-design-system-v1.md",
    "standards/streamdeck-key-visuals-v1.md",
    "tools/qa/streamdeck-key-visual-audit.mjs",
    "tools/qa/streamdeck-plugin-design-audit.mjs",
    "tools/streamdeck/profile-builder.mjs",
]
for rel in required:
    if not (ROOT / rel).is_file():
        errors.append(f"missing required file: {rel}")


streamdeck_entry = ROOT / "STREAMDECK.md"
if streamdeck_entry.is_file():
    text = streamdeck_entry.read_text(encoding="utf-8")
    for required_ref in (
        "docs/RAT-DEV-RELIABILITY.md",
        "docs/STREAMDECK_TROUBLESHOOTING_PLAYBOOK.md",
        "standards/streamdeck-plugin-design-system-v1.md",
        "standards/streamdeck-key-visuals-v1.md",
        "skills/rat-qa/SKILL.md",
    ):
        if required_ref not in text:
            errors.append(f"STREAMDECK.md must reference {required_ref}")

design_standard = ROOT / "standards/streamdeck-plugin-design-system-v1.md"
if design_standard.is_file():
    text = design_standard.read_text(encoding="utf-8")
    required_contracts = (
        "#080A0E",
        "#FFB21E",
        "Lite → Pro upgrade pattern",
        "Upgrade to Pro ↗",
        "Product-specific rollout tasks consume this pattern",
        ".packrat-topbar",
        ".upsell",
        "Open <Product> Pro ↗",
    )
    folded = text.casefold()
    for contract in required_contracts:
        if contract.casefold() not in folded:
            errors.append(f"Stream Deck design system missing canonical contract: {contract}")

troubleshooting = ROOT / "docs/STREAMDECK_TROUBLESHOOTING_PLAYBOOK.md"
if troubleshooting.is_file():
    text = troubleshooting.read_text(encoding="utf-8")
    for required_ref in (
        "streamdeck-plugin-design-audit.mjs",
        "streamdeck-key-visual-audit.mjs",
        "RAT-DEV-RELIABILITY.md",
    ):
        if required_ref not in text:
            errors.append(f"Stream Deck troubleshooting playbook must reference {required_ref}")

product_index = ROOT / "products/index.json"
product_count = None
if product_index.is_file():
    try:
        payload = json.loads(product_index.read_text(encoding="utf-8"))
        products = payload.get("products")
        if not isinstance(products, list):
            errors.append("products/index.json: products must be a list")
        else:
            product_count = len(products)
            ids = []
            allowed_types = {"profile", "plugin", "widget", "icons", "idea"}
            for i, product in enumerate(products):
                if not isinstance(product, dict):
                    errors.append(f"products/index.json: product {i} is not an object")
                    continue
                for field in ("id", "name", "type", "status"):
                    if field not in product:
                        errors.append(f"products/index.json: product {i} missing {field}")
                if "id" in product:
                    ids.append(product["id"])
                if product.get("type") not in allowed_types:
                    errors.append(f"products/index.json: unsupported type {product.get('type')!r} for {product.get('id')}")
            if len(ids) != len(set(ids)):
                errors.append("products/index.json: duplicate product ids")
            # 88 is the preserved migration baseline, not a permanent ceiling.
            # New canonical products should grow the roster without breaking context CI.
            if len(products) < 88:
                errors.append(f"products/index.json: migrated baseline requires at least 88 products, found {len(products)}")
    except Exception as exc:
        errors.append(f"products/index.json could not be parsed: {exc}")

for f in ROOT.rglob("*"):
    if not f.is_file():
        continue
    if f.suffix.lower() in {".ttf", ".otf", ".woff", ".woff2"}:
        errors.append(f"font binary must not be distributed: {f.relative_to(ROOT)}")
    if f.name in {".env", ".env.local"}:
        errors.append(f"credential file must not be distributed: {f.relative_to(ROOT)}")

secret_patterns = [
    re.compile(r"BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY"),
    re.compile(r"gh[pousr]_[A-Za-z0-9_]{20,}"),
    re.compile(r"sk-[A-Za-z0-9]{20,}"),
]
for f in ROOT.rglob("*"):
    if not f.is_file() or f.suffix.lower() not in {".md", ".json", ".yaml", ".yml", ".py", ".txt"}:
        continue
    text = f.read_text(encoding="utf-8", errors="ignore")
    for pattern in secret_patterns:
        if pattern.search(text):
            errors.append(f"possible secret in {f.relative_to(ROOT)}: {pattern.pattern}")

if errors:
    print("FAIL")
    for error in errors:
        print(error)
    sys.exit(1)

print("PASS")
print(f"root={ROOT}")
print(f"files={sum(1 for p in ROOT.rglob('*') if p.is_file())}")
print(f"products={product_count if product_count is not None else 'unknown'}")
