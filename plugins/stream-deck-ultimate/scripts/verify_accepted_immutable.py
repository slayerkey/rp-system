#!/usr/bin/env python3
import argparse
import hashlib
from pathlib import Path
from apply_accepted_immutable import FILES


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("plugin_dir", type=Path)
    args = ap.parse_args()
    plugin = args.plugin_dir.resolve()
    errors = []
    for relative, expected in FILES.items():
        path = plugin / relative
        if not path.is_file():
            errors.append(f"missing {relative}")
            continue
        actual = hashlib.sha256(path.read_bytes()).hexdigest()
        if actual != expected:
            errors.append(f"sha mismatch {relative}: {actual}")
    if errors:
        raise SystemExit("accepted immutable contract failed:\n" + "\n".join(errors))
    print(f"accepted immutable contract passed: {len(FILES)}/{len(FILES)} exact files")


if __name__ == "__main__":
    main()
