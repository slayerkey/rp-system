"""Decode a DaVinci Resolve keyboard preset and check the Pro profile's defaults.

Resolve stores its keymap as a hex blob inside <PresetListBA>. Each entry is a
length-prefixed UTF-16BE command ID (4-byte big-endian byte count) followed by
a payload whose last 4 bytes are a Qt key sequence: the modifier bits OR'd with
the key code. Verified against known defaults (nodesAddSerial decodes to Alt+S,
the Deliver page to Shift+8).

The Pro profile targets Resolve defaults only, so this is how we confirm those
defaults still hold in a given Resolve version.

  --dump   <preset.xml>          every command and its binding
  --check  <preset.xml>          confirm the bindings Pro depends on

Preset lives at:
  %APPDATA%\\Blackmagic Design\\DaVinci Resolve\\Preferences\\keyboard.preset.xml
"""
import binascii
import re
import sys
from pathlib import Path

QT_MOD = {0x02000000: "Shift", 0x04000000: "Ctrl", 0x08000000: "Alt",
          0x10000000: "Meta", 0x20000000: "Keypad"}
QT_SPECIAL = {0x1000000: "Esc", 0x1000001: "Tab", 0x1000003: "Backspace",
              0x1000004: "Return", 0x1000005: "Enter", 0x1000007: "Delete",
              0x1000010: "Home", 0x1000011: "End", 0x1000012: "Left",
              0x1000013: "Up", 0x1000014: "Right", 0x1000015: "Down"}

# What the Pro profile presses -> the Resolve default it relies on.
EXPECTED = {
    "nodesAddSerial": "Alt+S", "nodesAddParallel": "Alt+P",
    "nodesAddLayer": "Alt+L", "nodesAddOutside": "Alt+O",
    "nodesToggleCurrent": "Ctrl+D", "nodesToggleAll": "Alt+D",
    "nodesPrevious": "Shift+Alt+;", "nodesNext": "Shift+Alt+'",
    "sessionMemoriesSaveA": "Alt+1", "sessionMemoriesSaveB": "Alt+2",
    "sessionMemoriesSaveC": "Alt+3",
    "sessionGradeFromOneClipPrior": "Shift+=",
    "sessionVersionAdd": "Ctrl+Y", "sessionVersionNext": "Ctrl+N",
    "sessionPrinterLightsRedMinus": "Keypad+4", "sessionPrinterLightsRedPlus": "Keypad+7",
    "sessionPrinterLightsGreenMinus": "Keypad+5", "sessionPrinterLightsGreenPlus": "Keypad+8",
    "sessionPrinterLightsBlueMinus": "Keypad+6", "sessionPrinterLightsBluePlus": "Keypad+9",
    "sessionPrinterLightsMasterPlus": "Keypad++",
}


def qt_to_str(v: int) -> str:
    mods = [n for m, n in QT_MOD.items() if v & m]
    k = v & 0x00FFFFFF
    if 0x01000030 <= k <= 0x0100003B:
        key = f"F{k - 0x0100002F}"
    elif k in QT_SPECIAL:
        key = QT_SPECIAL[k]
    elif 32 <= k < 127:
        key = chr(k)
    else:
        key = hex(k)
    return "+".join(mods + [key])


def bindings(xml_path: Path) -> dict[str, list[str]]:
    m = re.search(r"<PresetListBA>([0-9a-fA-F]*)</PresetListBA>",
                  xml_path.read_text(encoding="utf-8"))
    if not m:
        raise SystemExit(f"{xml_path.name}: no <PresetListBA> blob, not a Resolve preset")
    blob = binascii.unhexlify(m.group(1))

    spans, i = [], 0
    while i < len(blob) - 4:
        n = int.from_bytes(blob[i:i + 4], "big")
        if 4 <= n <= 200 and n % 2 == 0 and i + 4 + n <= len(blob):
            try:
                s = blob[i + 4:i + 4 + n].decode("utf-16-be")
            except UnicodeDecodeError:
                s = ""
            if s.isprintable() and s.strip():
                spans.append((s, i, i + 4 + n))
                i += 4 + n
                continue
        i += 1

    out = {}
    for idx, (name, _start, end) in enumerate(spans):
        stop = spans[idx + 1][1] if idx + 1 < len(spans) else len(blob)
        vals = [int.from_bytes(blob[end + j:end + j + 4], "big")
                for j in range(0, stop - end, 4)]
        out[name] = [qt_to_str(v) for v in vals[2:] if v]  # first two are counts
    return out


def main() -> int:
    if len(sys.argv) != 3 or sys.argv[1] not in ("--dump", "--check"):
        raise SystemExit(__doc__)
    mode, path = sys.argv[1], Path(sys.argv[2])
    binds = bindings(path)

    if mode == "--dump":
        for cmd in sorted(binds):
            print(f"  {cmd:44} {' / '.join(binds[cmd]) or '-'}")
        print(f"\n{len(binds)} commands, "
              f"{sum(1 for v in binds.values() if v)} bound")
        return 0

    bad = []
    for cmd, want in sorted(EXPECTED.items()):
        got = binds.get(cmd, [])
        ok = want in got
        if not ok:
            bad.append(cmd)
        print(f"  {'OK  ' if ok else 'DIFF'}  {cmd:32} want {want:14} got {' / '.join(got) or '-'}")
    if bad:
        print(f"\n{len(bad)}/{len(EXPECTED)} defaults differ. The Pro profile "
              f"assumes stock bindings; these keys will not fire.")
        return 1
    print(f"\nAll {len(EXPECTED)} defaults match. Pro profile works as shipped.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
