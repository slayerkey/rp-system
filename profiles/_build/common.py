"""Shared build library for Packrat Stream Deck profiles.

Encodes the verified .streamDeckProfile format (package.json at ZIP root, MK.2
5x3 layout) plus the Windows hotkey encoding derived from real local profiles:
VKeyCode == NativeCode == Windows virtual-key code, QTKeyCode = Qt key code,
KeyModifiers bits: Shift=1 Ctrl=2 Alt=4 Win=8.
"""
import copy
import hashlib
import json
import uuid as _uuid
import zipfile
from dataclasses import dataclass
from pathlib import Path

MARKETPLACE_URL = "https://marketplace.elgato.com/@packrat"
APP_VERSION = "7.2.1.22472"
BH_PLUGIN = "com.packrat.betterhotkeys"

# ---------------------------------------------------------------- devices / OS

@dataclass(frozen=True)
class Device:
    """A Stream Deck hardware target. `cols`x`rows` is the keypad grid; `dials` > 0
    adds a 4-dial Encoder controller (Stream Deck +). `slug` feeds product naming."""
    model: str
    cols: int
    rows: int
    dials: int = 0
    slug: str = ""

MK2 = Device("20GBA9901", 5, 3)                          # Stream Deck MK.2 (default)
XL = Device("20GAT9901", 8, 4, slug="XL")                # Stream Deck XL (verify model)
PLUS = Device("20GBD9901", 4, 2, dials=4, slug="Plus")   # Stream Deck +

# Virtual Stream Deck (NIGHTSWORD v2 WIRELESS SD and other VSD-unlock devices).
# Grid is CONFIRMED from Elgato's own SDK schema (elgatosf/schemas,
# streamdeck/plugins/device-type.ts): DeviceType.VirtualStreamDeck = 11, "1 to 64
# action (on-screen) ... maximum layout of 8 x 8". DeviceModel "UI Stream Deck" is
# CONFIRMED 2026-08-06 straight from this machine's own Stream Deck app data: a
# locally saved profile (ProfilesV3/F26F3935.../manifest.json) carries
# Device.Model == "UI Stream Deck", and the app's own log names the internal class
# ESDUiStreamDeck / module "UiSD" for this device -- not a guess, read directly
# off real app state, not an export.
VSD = Device("UI Stream Deck", 8, 8, slug="VSD")

MK2_MODEL = MK2.model  # back-compat alias

# package.json OSVersion string per OSType. Mac value is a placeholder — confirm
# against a real macOS profile export before shipping the Mac tier.
OS_VERSION = {"Windows": "10.0.26200", "Mac": "14.6.1"}

def positions(device: Device) -> list[str]:
    """Keypad coordinate strings 'col,row' in the device's native fill order."""
    return [f"{col},{row}" for row in range(device.rows) for col in range(device.cols)]

# ---------------------------------------------------------------- key codes

# Windows virtual-key codes (VKeyCode and NativeCode are both this on Windows)
VK = {
    **{c: ord(c) for c in "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"},
    # VK_SNAPSHOT. Deliberately absent from MAC below: Mac keyboards have no
    # PrintScreen, so mac_variant() raises rather than emitting a wrong keycode.
    "PRINTSCREEN": 44,
    "SHIFT": 16, "CTRL": 17, "ALT": 18, "CAPS": 20, "ESC": 27, "SPACE": 32,
    "TAB": 9, "ENTER": 13, "BACKSPACE": 8, "DELETE": 46, "INSERT": 45,
    "LEFT": 37, "UP": 38, "RIGHT": 39, "DOWN": 40,
    "HOME": 36, "END": 35, "PGUP": 33, "PGDN": 34,
    "COMMA": 188, "PERIOD": 190, "SLASH": 191, "SEMICOLON": 186,
    "QUOTE": 222, "LBRACKET": 219, "RBRACKET": 221, "BACKSLASH": 220,
    "MINUS": 189, "EQUALS": 187, "GRAVE": 0xC0,
    **{f"F{n}": 0x6F + n for n in range(1, 25)},  # F1=0x70 .. F24=0x87
    # Numeric keypad. DaVinci Resolve puts printer lights here by default
    # (keypad 7/4 red, 8/5 green, 9/6 blue, keypad-plus master), so the Color
    # dials can drive them with no keyboard preset at all.
    **{f"NUM{n}": 0x60 + n for n in range(10)},   # NUM0=0x60 .. NUM9=0x69
    # Keypad Enter is deliberately absent: it shares VK 0x0D with the main Enter,
    # so including it would silently remap every Enter to the keypad one on macOS.
    "NUMPLUS": 0x6B, "NUMMINUS": 0x6D, "NUMMULT": 0x6A, "NUMDIV": 0x6F,
}

# Qt key codes (QTKeyCode). Printable = ASCII of the character; specials below.
_QT_SPECIAL = {
    "PRINTSCREEN": 16777225,  # Qt::Key_Print (0x01000009)
    "ESC": 16777216, "TAB": 16777217, "BACKSPACE": 16777219, "ENTER": 16777220,
    "DELETE": 16777223, "INSERT": 16777222, "CAPS": 16777252,
    "HOME": 16777232, "END": 16777233,
    "LEFT": 16777234, "UP": 16777235, "RIGHT": 16777236, "DOWN": 16777237,
    "PGUP": 16777238, "PGDN": 16777239,
    "SHIFT": 16777248, "CTRL": 16777249, "ALT": 16777251,
    "SPACE": 32, "COMMA": 44, "PERIOD": 46, "SLASH": 47, "SEMICOLON": 59,
    "QUOTE": 39, "LBRACKET": 91, "RBRACKET": 93, "BACKSLASH": 92,
    "MINUS": 45, "EQUALS": 61, "GRAVE": 96,
    **{f"F{n}": 16777263 + n for n in range(1, 25)},  # F1=16777264
    # Qt has no separate key codes for the keypad (it flags them with
    # KeypadModifier instead), so these repeat the main-row codes. The numpad is
    # told apart by VKeyCode, which is why _mac_hotkey re-encodes off VKeyCode.
    **{f"NUM{n}": ord(str(n)) for n in range(10)},
    "NUMPLUS": 43, "NUMMINUS": 45, "NUMMULT": 42, "NUMDIV": 47,
}

def qt_code(key: str) -> int:
    if key in _QT_SPECIAL:
        return _QT_SPECIAL[key]
    return ord(key)  # A-Z, 0-9

# macOS virtual-key codes (kVK_* from Carbon HIToolbox Events.h). Unlike Windows,
# letters are NOT ord-based, so every key is listed. NativeCode == VKeyCode == this
# on Mac; QTKeyCode is platform-independent and stays the same across OSes.
# INSERT is deliberately absent: Mac keyboards have no Insert key, so mac_variant()
# raises on it rather than silently emitting a wrong keycode. Windows-only profiles
# (Elite Dangerous) may still use it.
MAC = {
    "A": 0, "B": 11, "C": 8, "D": 2, "E": 14, "F": 3, "G": 5, "H": 4, "I": 34,
    "J": 38, "K": 40, "L": 37, "M": 46, "N": 45, "O": 31, "P": 35, "Q": 12,
    "R": 15, "S": 1, "T": 17, "U": 32, "V": 9, "W": 13, "X": 7, "Y": 16, "Z": 6,
    "0": 29, "1": 18, "2": 19, "3": 20, "4": 21, "5": 23, "6": 22, "7": 26,
    "8": 28, "9": 25,
    "SHIFT": 56, "CTRL": 59, "ALT": 58, "CAPS": 57, "ESC": 53, "SPACE": 49,
    "TAB": 48, "ENTER": 36, "BACKSPACE": 51, "DELETE": 117,
    "LEFT": 123, "UP": 126, "RIGHT": 124, "DOWN": 125,
    "HOME": 115, "END": 119, "PGUP": 116, "PGDN": 121,
    "COMMA": 43, "PERIOD": 47, "SLASH": 44, "SEMICOLON": 41,
    "QUOTE": 39, "LBRACKET": 33, "RBRACKET": 30, "BACKSLASH": 42,
    "MINUS": 27, "EQUALS": 24, "GRAVE": 50,
    "F1": 122, "F2": 120, "F3": 99, "F4": 118, "F5": 96, "F6": 97, "F7": 98,
    "F8": 100, "F9": 101, "F10": 109, "F11": 103, "F12": 111, "F13": 105,
    "F14": 107, "F15": 113, "F16": 106, "F17": 64, "F18": 79, "F19": 80, "F20": 90,
    # kVK_ANSI_Keypad* from Carbon HIToolbox Events.h
    "NUM0": 82, "NUM1": 83, "NUM2": 84, "NUM3": 85, "NUM4": 86, "NUM5": 87,
    "NUM6": 88, "NUM7": 89, "NUM8": 91, "NUM9": 92,
    "NUMPLUS": 69, "NUMMINUS": 78, "NUMMULT": 67, "NUMDIV": 75,
}
# QTKeyCode -> macOS keycode, so a built (Windows) Elgato hotkey re-encodes for Mac.
# Keypad entries are excluded: they share Qt codes with the number row, and
# including them would silently remap every plain digit to its numpad twin.
# _mac_hotkey resolves off VKeyCode first, which IS distinct for the keypad.
QT_TO_MAC = {qt_code(k): v for k, v in MAC.items() if not k.startswith("NUM")}
# Windows VK -> macOS keycode, for Better Hotkeys actions whose Settings store raw vk.
WIN_TO_MAC = {VK[k]: MAC[k] for k in MAC}

EMPTY_HOTKEY = {
    "KeyCmd": False, "KeyCtrl": False, "KeyModifiers": 0, "KeyOption": False,
    "KeyShift": False, "NativeCode": -1, "QTKeyCode": 33554431, "VKeyCode": -1,
}

# ---------------------------------------------------------------- identity

def stable_uuid(seed: str, namespace: str = "packrat-profiles") -> str:
    h = hashlib.md5(f"{namespace}-{seed}".encode()).hexdigest()
    return str(_uuid.UUID(h)).upper()

# ---------------------------------------------------------------- states

def button_state(title: str, image: str = "Images/black.png",
                 font_size: int = 10, alignment: str = "middle",
                 color: str = "#ffffff") -> dict:
    return {
        "FontFamily": "Verdana", "FontSize": font_size, "FontStyle": "Regular",
        "FontUnderline": False, "Image": image, "OutlineThickness": 2,
        "ShowTitle": True, "Title": title, "TitleAlignment": alignment,
        "TitleColor": color,
    }

def icon_state(title: str, icon: str, color: str = "#ffffff") -> dict:
    """State for a button whose PNG carries the glyph; text sits at the bottom."""
    return button_state(title, f"Images/{icon}.png", font_size=9,
                        alignment="bottom", color=color)

def _base(name: str, plugin_name: str, plugin_uuid: str, settings,
          states: list, action_uuid: str | None = None) -> dict:
    return {
        "ActionID": str(_uuid.uuid4()),
        "LinkedTitle": False,
        "Name": name,
        "Plugin": {"Name": plugin_name, "UUID": plugin_uuid, "Version": "1.0"},
        "Resources": None,
        "Settings": settings,
        "State": 0,
        "States": states,
        "UUID": action_uuid or plugin_uuid,
    }

# ---------------------------------------------------------------- stock actions

def hotkey_action(title: str, icon: str, key: str, ctrl=False, shift=False,
                  alt=False, win=False, color="#ffffff") -> dict:
    hk = _hotkey(key, ctrl, shift, alt, win)
    return _base(title.replace("\n", " "), "Activate a Key Command",
                 "com.elgato.streamdeck.system.hotkey",
                 {"Coalesce": True, "Hotkeys": [hk] + [dict(EMPTY_HOTKEY) for _ in range(3)]},
                 [icon_state(title, icon, color)])

def _hotkey(key: str, ctrl=False, shift=False, alt=False, win=False) -> dict:
    mods = (1 if shift else 0) | (2 if ctrl else 0) | (4 if alt else 0) | (8 if win else 0)
    return {
        "KeyCmd": win, "KeyCtrl": ctrl, "KeyModifiers": mods,
        "KeyOption": alt, "KeyShift": shift,
        "NativeCode": VK[key], "QTKeyCode": qt_code(key), "VKeyCode": VK[key],
    }

# Dial spec: (key, ctrl, shift, alt, win) with everything after `key` optional.
Dial = tuple

def dial_action(title: str, icon: str, ccw: Dial, cw: Dial,
                press: Dial | None = None) -> dict:
    """A Stream Deck + dial. `ccw`/`cw` are (key, ctrl=, shift=, alt=, win=) tuples
    fired on counter-clockwise and clockwise rotation.

    Slot order is read off real Stream Deck app state (a local Plus profile encodes
    Undo on slot 0 and Redo on slot 1): [0] = counter-clockwise, [1] = clockwise.
    Slot [2] as dial-press is NOT confirmed by any local profile, so `press` stays
    opt-in until it is verified on hardware.
    """
    slots = [_hotkey(*ccw), _hotkey(*cw)]
    slots.append(_hotkey(*press) if press else dict(EMPTY_HOTKEY))
    slots.append(dict(EMPTY_HOTKEY))
    a = _base(title.replace("\n", " "), "Activate a Key Command",
              "com.elgato.streamdeck.system.hotkey",
              {"Coalesce": True, "Hotkeys": slots},
              [{"Title": title}])
    a["Encoder"] = {"Icon": f"Images/{icon}.png"}
    a["LinkedTitle"] = True
    return a

def hotkey_switch_action(title: str, icon_off: str, icon_on: str, key: str,
                         ctrl=False, shift=False, alt=False, win=False,
                         color="#ffffff") -> dict:
    """Two-state hotkey: the key face changes so the deck SHOWS whether something
    is on, instead of the buyer pressing blind.

    Slots [0] and [1] both carry the same shortcut, which is how a single toggle
    command (one key that flips a mode) is expressed. Schema read off a real local
    Stream Deck profile's Hotkey Switch action, not guessed.

    State is the deck's own, so it can drift if the user also toggles the mode by
    keyboard. Use it for modes the deck is expected to own.
    """
    hk = _hotkey(key, ctrl, shift, alt, win)
    return _base(title.replace("\n", " "), "Hotkey Switch",
                 "com.elgato.streamdeck.system.hotkeyswitch",
                 {"Coalesce": True,
                  "Hotkeys": [dict(hk), dict(hk)] + [dict(EMPTY_HOTKEY) for _ in range(2)]},
                 [icon_state(title, icon_off, color), icon_state(title, icon_on, color)])

def website_action(title: str, icon: str, url: str, color="#ffffff") -> dict:
    return _base(title.replace("\n", " "), "Website",
                 "com.elgato.streamdeck.system.website",
                 {"openInBrowser": True, "path": url},
                 [icon_state(title, icon, color)])

def open_action(title: str, icon: str, path: str, color="#ffffff") -> dict:
    return _base(title.replace("\n", " "), "Open",
                 "com.elgato.streamdeck.system.open",
                 {"openInBrowser": True, "path": path},
                 [icon_state(title, icon, color)])

def text_action(title: str, icon: str, text: str, color="#ffffff",
                typing: bool = False, send_enter: bool = False) -> dict:
    """Type or paste `text`.

    typing=True sends real per-character keystrokes instead of a clipboard paste,
    which is what games need (a paste usually does not reach a game's chat box).
    send_enter=True presses Enter afterwards. Together they let one key deliver a
    chat command: the leading '/' opens the chat box, the rest types into it,
    Enter submits. Still one action, not a key sequence.
    """
    return _base(title.replace("\n", " "), "Text",
                 "com.elgato.streamdeck.system.text",
                 {"Hotkey": {"KeyModifiers": 0, "QTKeyCode": 33554431, "VKeyCode": -1},
                  "isSendingEnter": send_enter, "isTypingMode": typing,
                  "pastedText": text},
                 [icon_state(title, icon, color)])

def folder_action(title: str, icon: str, child_uuid: str, color="#ffffff") -> dict:
    return _base(title.replace("\n", " "), "Create Folder",
                 "com.elgato.streamdeck.profile.openchild",
                 {"ProfileUUID": child_uuid},
                 [icon_state(title, icon, color)])

def back_action(icon: str = "arrow-back-up") -> dict:
    return _base("Back", "Open Parent Folder",
                 "com.elgato.streamdeck.profile.backtoparent", {},
                 [icon_state("Back", icon)])

def play_audio_action(title: str, icon: str, path: str = "", volume: int = 75,
                      color="#ffffff") -> dict:
    return _base(title.replace("\n", " "), "Soundboard",
                 "com.elgato.streamdeck.soundboard",
                 {"actionType": 0, "fadeLen": 1, "fadeType": 0,
                  "outputType": "", "path": path, "volume": volume},
                 [icon_state(title, icon, color)],
                 action_uuid="com.elgato.streamdeck.soundboard.playaudio")

# ---------------------------------------------------------------- Better Hotkeys

def bh_toggle_key(title: str, icon: str, keys: list[str], color="#ffffff") -> dict:
    a = _base(title.replace("\n", " "), "Toggle Key", BH_PLUGIN,
              {"keys": [{"vk": VK[k]} for k in keys], "mode": "scancode"},
              [icon_state(title, icon, color), icon_state(title, f"{icon}-on", color)],
              action_uuid=f"{BH_PLUGIN}.togglekey")
    return a

def bh_hold_key(title: str, icon: str, keys: list[str], color="#ffffff") -> dict:
    return _base(title.replace("\n", " "), "Hold Key", BH_PLUGIN,
                 {"keys": [{"vk": VK[k]} for k in keys], "mode": "scancode"},
                 [icon_state(title, icon, color), icon_state(title, f"{icon}-on", color)],
                 action_uuid=f"{BH_PLUGIN}.holdkey")

def bh_toggle_mouse(title: str, icon: str, button: str = "left", color="#ffffff") -> dict:
    return _base(title.replace("\n", " "), "Toggle Mouse Button", BH_PLUGIN,
                 {"button": button},
                 [icon_state(title, icon, color), icon_state(title, f"{icon}-on", color)],
                 action_uuid=f"{BH_PLUGIN}.togglemouse")

def bh_click_mouse(title: str, icon: str, button: str = "left", at_point=False,
                   x_pct: float = 50, y_pct: float = 50, area: str = "primary",
                   color="#ffffff") -> dict:
    settings = {"button": button, "atPoint": at_point}
    if at_point:
        settings.update({"xPct": x_pct, "yPct": y_pct, "area": area})
    return _base(title.replace("\n", " "), "Click Mouse", BH_PLUGIN, settings,
                 [icon_state(title, icon, color)],
                 action_uuid=f"{BH_PLUGIN}.clickmouse")

# ---------------------------------------------------------------- official Discord plugin

DISCORD_PLUGIN = "com.elgato.discord"

def discord_action(title: str, action: str, icon: str, icon_on: str | None = None,
                   color="#ffffff") -> dict:
    """Official Discord plugin action (com.elgato.discord.*). Two-state actions
    (mute, deafen, videotoggle, streamtoggle, pushtotalktoggle) get both icons so
    the key reflects live Discord state. Settings shape verified from real profiles."""
    states = [icon_state(title, icon, color)]
    if icon_on:
        states.append(icon_state(title, icon_on, color))
    return _base(title.replace("\n", " "), "Discord", DISCORD_PLUGIN,
                 {"isInMultiAction": False}, states,
                 action_uuid=f"{DISCORD_PLUGIN}.{action}")

# ---------------------------------------------------------------- shared buttons

def mute_button() -> dict:
    """Discord Toggle Mute (Ctrl+Shift+M). Identical everywhere it appears."""
    return hotkey_action("Mute\nMic", "microphone-off", "M", ctrl=True, shift=True)

def deafen_button() -> dict:
    """Discord Toggle Deafen (Ctrl+Shift+D). Identical everywhere it appears."""
    return hotkey_action("Deafen", "headphones-off", "D", ctrl=True, shift=True)

# ---------------------------------------------------------------- macOS variant

def mac_path(path: str) -> str:
    """Rewrite a Windows shell path to its macOS equivalent."""
    return {"%USERPROFILE%\\Videos": "~/Movies"}.get(path, path)

def _mac_hotkey(hk: dict) -> dict:
    """Re-encode one Elgato hotkey record for macOS: kVK keycodes + Ctrl->Cmd.
    Ctrl-based app/editing shortcuts follow the Mac convention and use Cmd."""
    out = dict(hk)
    if hk["VKeyCode"] != -1:  # a real key is set (empty fillers stay -1)
        vk, qt = hk["VKeyCode"], hk["QTKeyCode"]
        if vk in WIN_TO_MAC:      # unambiguous, and the only way to spot the keypad
            mac = WIN_TO_MAC[vk]
        elif qt in QT_TO_MAC:
            mac = QT_TO_MAC[qt]
        else:
            raise KeyError(f"no macOS keycode for VKeyCode {vk} / QTKeyCode {qt}")
        out["NativeCode"] = out["VKeyCode"] = mac
    if hk.get("KeyCtrl"):
        out["KeyCtrl"], out["KeyCmd"] = False, True
    out["KeyModifiers"] = ((1 if out["KeyShift"] else 0) | (2 if out["KeyCtrl"] else 0)
                           | (4 if out["KeyOption"] else 0) | (8 if out["KeyCmd"] else 0))
    return out

def mac_variant(pages: dict, old_seed: str, new_seed: str) -> dict:
    """Deep-copy `pages` into a macOS variant: hotkeys re-encoded, open-paths
    remapped, and folder targets reseeded old_seed -> new_seed so nav still works."""
    remap = {stable_uuid(f"{old_seed}-{ps}"): stable_uuid(f"{new_seed}-{ps}") for ps in pages}

    def convert(acts):
        new_acts = {}
        for coord, act in acts.items():
            a = copy.deepcopy(act)
            s = a.get("Settings")
            if isinstance(s, dict):
                if "Hotkeys" in s:  # Elgato system.hotkey (keypad and dial alike)
                    s["Hotkeys"] = [_mac_hotkey(hk) for hk in s["Hotkeys"]]
                if isinstance(s.get("keys"), list):  # Better Hotkeys toggle/hold key
                    s["keys"] = [{**k, "vk": WIN_TO_MAC.get(k["vk"], k["vk"])}
                                 for k in s["keys"]]
                if a.get("UUID") == "com.elgato.streamdeck.system.open":
                    s["path"] = mac_path(s.get("path", ""))
                if a.get("UUID") == "com.elgato.streamdeck.profile.openchild":
                    s["ProfileUUID"] = remap.get(s.get("ProfileUUID"), s.get("ProfileUUID"))
            new_acts[coord] = a
        return new_acts

    out = {}
    for ps, page in pages.items():
        name, acts = page[0], page[1]
        if len(page) > 2 and page[2]:
            out[ps] = (name, convert(acts), convert(page[2]))
        else:
            out[ps] = (name, convert(acts))
    return out

# ---------------------------------------------------------------- assembly

def build_profile(out_dir: Path, profile_name: str, seed: str,
                  pages: dict[str, tuple[str, dict]], home_seed: str,
                  images: dict[str, bytes], required_plugins: list[str],
                  zip_name: str | None = None,
                  device: Device = MK2, os_type: str = "Windows") -> Path:
    """Write <Name>.streamDeckProfile into out_dir.

    pages: {page_seed: (page_name, {"col,row": action_dict})}
    images: {icon_name: png_bytes} — written into every page's Images/ folder.
    device/os_type default to the Stream Deck MK.2 / Windows target.
    """
    root_uuid = stable_uuid(f"{seed}-root")
    prof = f"Profiles/{root_uuid}.sdProfile"
    page_uuids = {ps: stable_uuid(f"{seed}-{ps}") for ps in pages}
    home_uuid = page_uuids[home_seed]

    files: dict[str, object] = {
        "package.json": {
            "AppVersion": APP_VERSION, "DeviceModel": device.model,
            "DeviceSettings": None, "FormatVersion": 1, "OSType": os_type,
            "OSVersion": OS_VERSION[os_type], "RequiredPlugins": sorted(set(required_plugins)),
        },
        f"{prof}/manifest.json": {
            "Device": {"Model": device.model, "UUID": ""},
            "Name": profile_name,
            "Pages": {"Current": home_uuid, "Default": home_uuid,
                      "Pages": [home_uuid]},
            "Version": "3.0",
        },
    }
    for name, png in images.items():
        files[f"{prof}/Images/{name}.png"] = png

    for ps, page in pages.items():
        page_name, actions = page[0], page[1]
        encoders = page[2] if len(page) > 2 else None
        if encoders and not device.dials:
            raise ValueError(f"page {ps!r} defines dials but {device.slug or 'MK2'} has none")
        pu = page_uuids[ps]
        controllers = [{"Actions": actions, "Type": "Keypad"}]
        if encoders:
            controllers.append({"Actions": encoders, "Type": "Encoder"})
        files[f"{prof}/Profiles/{pu}/manifest.json"] = {
            "Controllers": controllers, "Icon": "", "Name": page_name,
        }
        for name, png in images.items():
            files[f"{prof}/Profiles/{pu}/Images/{name}.png"] = png

    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"{zip_name or profile_name}.streamDeckProfile"
    with zipfile.ZipFile(out_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for path, data in files.items():
            if isinstance(data, (bytes, bytearray)):
                zf.writestr(path, data)
            else:
                zf.writestr(path, json.dumps(data, indent=2, ensure_ascii=False))
    return out_path

def page_uuid_for(seed: str, page_seed: str) -> str:
    """UUID a folder_action must target for a page built by build_profile."""
    return stable_uuid(f"{seed}-{page_seed}")

def write_url_file(folder: Path, url: str = MARKETPLACE_URL,
                   filename: str = "Packrat Marketplace.url") -> None:
    """Write the buyer-facing marketplace shortcut.

    Most profiles point to the Packrat storefront. A Lite product with a specific
    Pro counterpart may provide that listing URL and an honest product filename.
    """
    default_path = folder / "Packrat Marketplace.url"
    target = folder / filename
    if target != default_path and default_path.exists():
        default_path.unlink()
    target.write_text(f"[InternetShortcut]\nURL={url}\n", encoding="ascii")

def export_icons(folder: Path, images: dict[str, bytes]) -> None:
    icon_dir = folder / "icons"
    if icon_dir.exists():
        for old in icon_dir.glob("*.png"):  # wipe first so the folder always mirrors the build
            old.unlink()
    icon_dir.mkdir(parents=True, exist_ok=True)
    for name, png in images.items():
        (icon_dir / f"{name}.png").write_bytes(png)
