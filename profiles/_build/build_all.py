"""Builds all six Packrat profiles into profiles/<name>/.

Run from profiles/_build:  python build_all.py
"""
from pathlib import Path

import common as c
import icons

ROOT = Path(__file__).resolve().parent.parent  # profiles/

WHITE = (255, 255, 255)
GREEN_DOT = (76, 217, 100)
DARK = (20, 20, 20)

# Accent colors (glyph tint for profile-specific buttons)
VAL_RED = (255, 70, 85)
STARTER_PURPLE = (170, 120, 255)
DAVINCI_ORANGE = (255, 150, 70)
PAL_BLUE = (90, 200, 250)
DISCORD_BLURPLE = (130, 140, 250)
SU_GOLD = (217, 164, 65)
SU_MAROON = (42, 12, 20)
VW_TEAL = (0, 178, 169)
FN_BLUE = (80, 155, 255)
SF_ORANGE = (250, 149, 73)
WOW_GOLD = (255, 200, 90)
ED_ORANGE = (255, 122, 0)
OSRS_GOLD = (232, 185, 90)
FORZA_MAGENTA = (225, 60, 140)
SW_RED = (215, 35, 42)

# Shared, byte-identical across every profile (consistency requirement).
SHARED_SPEC = {
    "mute": {"icon": "microphone-off", "fg": WHITE},
    "deafen": {"icon": "headphones-off", "fg": WHITE},
    "back": {"icon": "arrow-back-up", "fg": WHITE},
}
SHARED = icons.build_set(SHARED_SPEC, bg=DARK)  # includes black.png

def merged(extra_spec: dict, bg=DARK) -> dict[str, bytes]:
    imgs = dict(SHARED)
    imgs.update(icons.build_set(extra_spec, bg=bg))
    imgs["black"] = SHARED["black"]  # keep the shared dark key background
    return imgs

# Shared action builders wired to the shared icon names
def mute_btn():
    return c.hotkey_action("Mute\nMic", "mute", "M", ctrl=True, shift=True)

def deafen_btn():
    return c.hotkey_action("Deafen", "deafen", "D", ctrl=True, shift=True)

def back_btn():
    return c.back_action("back")

# OBS documented keybinds (buyer binds these in OBS Settings > Hotkeys)
def clip_btn(icon="clip"):
    return c.hotkey_action("Save\nClip", icon, "C", ctrl=True, alt=True)

def marker_btn(icon="markerflag"):
    return c.hotkey_action("Marker", icon, "M", ctrl=True, alt=True)

def record_btn(icon="record"):
    return c.hotkey_action("Record", icon, "R", ctrl=True, alt=True)

def stream_btn(icon="stream"):
    return c.hotkey_action("Stream", icon, "B", ctrl=True, alt=True)


def _variants(out, name, seed, pages, home_seed, imgs, plugins, device, tag, mac):
    """Write one device's Windows profile, plus its macOS variant when mac=True.
    `tag` is the marketplace suffix (''/'XL'/...) folded into the product name.
    Mac variants re-encode hotkeys and reseed folder UUIDs so nothing collides."""
    label = f" {tag}" if tag else ""
    c.build_profile(out, f"{name}{label}", seed, pages, home_seed, imgs, plugins,
                    zip_name=f"{name} ({tag})" if tag else name, device=device)
    if mac:
        mseed = f"{seed}-mac"
        c.build_profile(out, f"{name}{label} (Mac)", mseed,
                        c.mac_variant(pages, seed, mseed), home_seed, imgs, plugins,
                        zip_name=f"{name} ({tag} Mac)" if tag else f"{name} (Mac)",
                        device=device, os_type="Mac")


def emit(out, name, seed, pages, home_seed, imgs, plugins, *, mac=False,
         xl_pages=None, xl_mac=False):
    """Write the MK.2 profile (+ Mac), and the XL profile (+ Mac) when xl_pages given.
    XL layouts are passed separately because the 8x4 grid is a different layout,
    not a reflow of the 5x3 one."""
    _variants(out, name, seed, pages, home_seed, imgs, plugins, c.MK2, "", mac)
    if xl_pages is not None:
        _variants(out, name, f"{seed}-xl", xl_pages, home_seed, imgs, plugins,
                  c.XL, "XL", xl_mac)


# ------------------------------------------------------------------ 1. Valorant
def build_valorant():
    """Match companion (comms/clips/intel) + Game page: one-tap presses of
    Valorant's own DEFAULT keybinds. One press = one action — no macros, no
    sequences, the same model the existing marketplace Valorant profile ships."""
    seed = "packrat-valorant"
    R = VAL_RED
    spec = {
        "clip": {"icon": "scissors", "fg": R},
        "markerflag": {"icon": "flag", "fg": R},
        "record": {"icon": "player-record", "fg": R},
        "stream": {"icon": "broadcast", "fg": R},
        "ptt": {"icon": "microphone", "fg": WHITE},
        "ptt-on": {"icon": "microphone", "fg": R, "dot": GREEN_DOT},
        "teamvoice": {"icon": "microphone", "fg": R},
        "teamvoice-on": {"icon": "microphone", "fg": R, "dot": GREEN_DOT},
        "tracker": {"icon": "chart-bar", "fg": R},
        "news": {"icon": "world", "fg": R},
        "xhair": {"icon": "crosshair", "fg": R, "nav": True},
        "game": {"icon": "device-gamepad-2", "fg": R, "nav": True},
        "code": {"icon": "target", "fg": R},
        "voteyes": {"icon": "thumb-up", "fg": (95, 200, 120)},
        "voteno": {"icon": "thumb-down", "fg": R},
        "w1": {"icon": "number-1", "fg": WHITE},
        "w2": {"icon": "number-2", "fg": WHITE},
        "w3": {"icon": "number-3", "fg": WHITE},
        "w4": {"icon": "bomb", "fg": R},
        "abq": {"icon": "letter-q", "fg": R},
        "abe": {"icon": "letter-e", "fg": R},
        "abc": {"icon": "letter-c", "fg": R},
        "abx": {"icon": "letter-x", "fg": (255, 200, 80)},
        "reload": {"icon": "refresh", "fg": WHITE},
        "use": {"icon": "hand-click", "fg": WHITE},
        "drop": {"icon": "hand-off", "fg": WHITE},
        "inspect": {"icon": "eye", "fg": WHITE},
        "buy": {"icon": "shopping-bag", "fg": R},
    }
    imgs = merged(spec)
    xhair_uuid = c.page_uuid_for(seed, "xhair")
    game_uuid = c.page_uuid_for(seed, "game")

    CODES = {  # style-named community crosshair codes; buyer pastes in import box
        "Dot": "0;P;c;5;o;1;d;1;z;3;f;0;0t;0;0l;0;0o;0;0a;1;0f;0;1b;0",
        "Small\nCross": "0;s;1;P;c;1;h;0;m;1;0l;3;0o;2;0a;1;0f;0;1b;0",
        "Classic": "0;P;c;1;h;0;0l;4;0o;2;0a;1;0f;0;1b;0",
        "Precise": "0;s;1;P;c;5;o;1;0t;1;0l;2;0o;2;0a;1;0f;0;1b;0;S;c;4;o;1",
    }
    xhair_actions = {"0,0": back_btn()}
    for i, (name, code) in enumerate(CODES.items()):
        xhair_actions[f"{i + 1},0"] = c.text_action(name, "code", code, color="#ffffff")

    game = {
        "0,0": back_btn(),
        "1,0": c.hotkey_action("Primary\n1", "w1", "1"),
        "2,0": c.hotkey_action("Pistol\n2", "w2", "2"),
        "3,0": c.hotkey_action("Knife\n3", "w3", "3"),
        "4,0": c.hotkey_action("Spike\n4", "w4", "4"),
        "0,1": c.hotkey_action("Ability\nQ", "abq", "Q"),
        "1,1": c.hotkey_action("Ability\nE", "abe", "E"),
        "2,1": c.hotkey_action("Ability\nC", "abc", "C"),
        "3,1": c.hotkey_action("Ult\nX", "abx", "X"),
        "4,1": c.hotkey_action("Buy\nB", "buy", "B"),
        "0,2": c.hotkey_action("Reload\nR", "reload", "R"),
        "1,2": c.hotkey_action("Use\nF", "use", "F"),
        "2,2": c.hotkey_action("Drop\nG", "drop", "G"),
        "3,2": c.hotkey_action("Inspect\nY", "inspect", "Y"),
    }
    home = {
        "0,0": mute_btn(), "1,0": deafen_btn(),
        "2,0": c.bh_hold_key("Push to\nTalk", "ptt", ["F13"]),
        "3,0": clip_btn(), "4,0": marker_btn(),
        "0,1": record_btn(), "1,1": stream_btn(),
        "2,1": c.website_action("Tracker", "tracker", "https://tracker.gg/valorant"),
        "3,1": c.folder_action("Cross\nhairs", "xhair", xhair_uuid),
        "4,1": c.website_action("VLR\nNews", "news", "https://www.vlr.gg"),
        "0,2": c.folder_action("Game", "game", game_uuid),
        "1,2": c.hotkey_action("Vote\nYes F5", "voteyes", "F5"),
        "2,2": c.hotkey_action("Vote\nNo F6", "voteno", "F6"),
        "3,2": c.bh_hold_key("Team\nVoice V", "teamvoice", ["V"]),
    }
    # XL (8x4): comms row, match-tools + crosshair codes row, then the full Game
    # keybind grid — all three pages flat, no folders. 30 keys of 32.
    xl_home = {
        "0,0": home["0,0"], "1,0": home["1,0"], "2,0": home["2,0"], "3,0": home["3,2"],
        "4,0": home["3,0"], "5,0": home["4,0"], "6,0": home["0,1"], "7,0": home["1,1"],
        "0,1": home["2,1"], "1,1": home["4,1"], "2,1": home["1,2"], "3,1": home["2,2"],
        "4,1": xhair_actions["1,0"], "5,1": xhair_actions["2,0"],
        "6,1": xhair_actions["3,0"], "7,1": xhair_actions["4,0"],
        "0,2": game["1,0"], "1,2": game["2,0"], "2,2": game["3,0"], "3,2": game["4,0"],
        "4,2": game["0,1"], "5,2": game["1,1"], "6,2": game["2,1"], "7,2": game["3,1"],
        "0,3": game["4,1"], "1,3": game["0,2"], "2,3": game["1,2"], "3,3": game["2,2"],
        "4,3": game["3,2"],
    }
    out = ROOT / "valorant"
    plugins = ["com.elgato.streamdeck.system.hotkey",
               "com.elgato.streamdeck.system.website",
               "com.elgato.streamdeck.system.text", c.BH_PLUGIN]
    # Valorant has no macOS client, so Windows only — no Mac variants.
    emit(out, "Valorant", seed,
         {"home": ("Valorant", home), "xhair": ("Crosshairs", xhair_actions),
          "game": ("Game", game)},
         "home", imgs, plugins, mac=False,
         xl_pages={"home": ("Valorant", xl_home)}, xl_mac=False)
    c.write_url_file(out)
    c.export_icons(out, imgs)

# ------------------------------------------------------- 2. Streamer Starter Pack
def build_starter(sfx_paths=None, name="Streamer Starter Pack",
                  seed="packrat-streamer-starter", out_folder="streamer-starter-pack"):
    """sfx_paths: optional {label: absolute audio path} to pre-wire the soundboard
    (personal builds only — never ship third-party audio in the sellable ZIP)."""
    P = STARTER_PURPLE
    spec = {
        "clip": {"icon": "scissors", "fg": P},
        "markerflag": {"icon": "flag", "fg": P},
        "record": {"icon": "player-record", "fg": P},
        "stream": {"icon": "broadcast", "fg": P},
        "vo": {"icon": "microphone", "fg": P},
        "subs": {"icon": "badge-cc", "fg": P},
        "videos": {"icon": "folder", "fg": P},
        "sounds": {"icon": "music", "fg": P, "nav": True},
        "sfx": {"icon": "volume", "fg": WHITE},
    }
    imgs = merged(spec)
    sb_uuid = c.page_uuid_for(seed, "sounds")

    SFX = list(sfx_paths) if sfx_paths else \
        ["Hype", "Applause", "Wow", "Sad", "Boo", "Suspense", "Drum\nRoll",
         "Win", "Fail", "Laugh", "Boom", "Intro", "Outro"]
    POS = [f"{col},{row}" for row in range(3) for col in range(5)]
    sb_actions = {"0,0": back_btn()}
    free_slots = [p for p in POS if p not in sb_actions]
    for label, pos in zip(SFX, free_slots):
        path = sfx_paths[label] if sfx_paths else ""
        sb_actions[pos] = c.play_audio_action(label, "sfx", path=path)

    home = {
        "0,0": mute_btn(), "1,0": deafen_btn(), "2,0": clip_btn(),
        "3,0": marker_btn(), "4,0": record_btn(),
        "0,1": stream_btn(),
        "1,1": c.hotkey_action("Voice\nover", "vo", "V", ctrl=True, alt=True),
        "2,1": c.hotkey_action("Subtitles", "subs", "L", ctrl=True, shift=True, alt=True),
        "3,1": c.open_action("Videos", "videos", "%USERPROFILE%\\Videos"),
        "4,1": c.folder_action("Sounds", "sounds", sb_uuid),
    }
    # XL (8x4): stream controls on row 0, all 13 soundboard slots below — the
    # Sounds folder disappears because everything fits on one screen.
    # Only the slots SFX actually filled: free_slots has one spare (the old More
    # Profiles position), so indexing it directly would miss a key.
    sfx_objs = [sb_actions[p] for p in free_slots if p in sb_actions]
    xl_home = {
        "0,0": home["0,0"], "1,0": home["1,0"], "2,0": home["1,1"], "3,0": home["2,1"],
        "4,0": home["2,0"], "5,0": home["3,0"], "6,0": home["4,0"], "7,0": home["0,1"],
        **{f"{i},1": sfx_objs[i] for i in range(8)},
        **{f"{i},2": sfx_objs[8 + i] for i in range(len(sfx_objs) - 8)},
        "6,2": home["3,1"],  # Videos
    }
    out = ROOT / out_folder
    plugins = ["com.elgato.streamdeck.system.hotkey",
               "com.elgato.streamdeck.system.website",
               "com.elgato.streamdeck.system.open",
               "com.elgato.streamdeck.soundboard"]
    sellable = sfx_paths is None  # Mac/XL variants for the sellable build only
    emit(out, name, seed,
         {"home": ("Streamer", home), "sounds": ("Sounds", sb_actions)},
         "home", imgs, plugins, mac=sellable,
         xl_pages={"home": ("Streamer", xl_home)} if sellable else None,
         xl_mac=sellable)
    c.write_url_file(out)
    c.export_icons(out, imgs)

# ------------------------------------------------------------ 3. DaVinci Resolve
# Resolve clip colors exposed on the Colors page. No default binds exist for
# these, so the README maps each to a documented custom shortcut.
RESOLVE_COLORS = [
    ("Orange", (255, 150, 60), "1"), ("Yellow", (240, 215, 80), "2"),
    ("Green", (95, 200, 120), "3"), ("Teal", (70, 200, 200), "4"),
    ("Blue", (95, 145, 255), "5"), ("Purple", (185, 125, 255), "6"),
    ("Pink", (255, 130, 185), "7"),
]

def build_davinci():
    """v2: Edit home page (defaults, zero setup) + Pro page (insert/overwrite/
    append F9-F12 family, trim, retime) + Captions & Colors page (transcribe +
    clip colors on documented custom binds)."""
    seed = "packrat-davinci-starter"
    O = DAVINCI_ORANGE
    spec = {
        "blade": {"icon": "cut", "fg": O},
        "select": {"icon": "pointer", "fg": O},
        "trim": {"icon": "scissors", "fg": O},
        "snap": {"icon": "magnet", "fg": O},
        "markerflag": {"icon": "flag", "fg": O},
        "jrev": {"icon": "player-play", "fg": WHITE, "flip": True},
        "kstop": {"icon": "player-stop", "fg": WHITE},
        "lplay": {"icon": "player-play", "fg": WHITE},
        "in": {"icon": "arrow-bar-to-left", "fg": O},
        "out": {"icon": "arrow-bar-to-right", "fg": O},
        "split": {"icon": "slash", "fg": O},
        "undo": {"icon": "arrow-back", "fg": WHITE},
        "redo": {"icon": "arrow-back", "fg": WHITE, "flip": True},
        "ripple": {"icon": "trash", "fg": O},
        "zoomfit": {"icon": "zoom-scan", "fg": O},
        "pro": {"icon": "bolt", "fg": O, "nav": True},
        "colorspg": {"icon": "wand", "fg": O, "nav": True},
        "insert": {"icon": "row-insert-bottom", "fg": O},
        "overwrite": {"icon": "layers-intersect", "fg": O},
        "replace": {"icon": "repeat", "fg": O},
        "placetop": {"icon": "arrow-up", "fg": O},
        "append": {"icon": "plus", "fg": O},
        "transition": {"icon": "transition-right", "fg": O},
        "retime": {"icon": "clock-play", "fg": O},
        "disable": {"icon": "ban", "fg": O},
        "prevedit": {"icon": "player-track-prev", "fg": WHITE},
        "nextedit": {"icon": "player-track-next", "fg": WHITE},
        "captions": {"icon": "badge-cc", "fg": O},
        "normalize": {"icon": "wave-sine", "fg": O},
        "clearcolor": {"icon": "circle-off", "fg": WHITE},
        **{f"col-{n.lower()}": {"icon": "circle", "fg": rgb}
           for n, rgb, _ in RESOLVE_COLORS},
    }
    imgs = merged(spec)
    pro_uuid = c.page_uuid_for(seed, "pro")
    colors_uuid = c.page_uuid_for(seed, "colors")

    home = {
        "0,0": c.hotkey_action("Blade\nB", "blade", "B"),
        "1,0": c.hotkey_action("Select\nA", "select", "A"),
        "2,0": c.hotkey_action("Marker\nM", "markerflag", "M"),
        "3,0": c.folder_action("Pro", "pro", pro_uuid),
        "4,0": c.folder_action("Colors", "colorspg", colors_uuid),
        "0,1": c.hotkey_action("Rev", "jrev", "J"),
        "1,1": c.hotkey_action("Stop", "kstop", "K"),
        "2,1": c.hotkey_action("Play", "lplay", "L"),
        "3,1": c.hotkey_action("In\nI", "in", "I"),
        "4,1": c.hotkey_action("Out\nO", "out", "O"),
        "0,2": c.hotkey_action("Split", "split", "B", ctrl=True),
        "1,2": c.hotkey_action("Undo", "undo", "Z", ctrl=True),
        "2,2": c.hotkey_action("Ripple\nDel", "ripple", "BACKSPACE", shift=True),
        "3,2": c.hotkey_action("Zoom\nFit", "zoomfit", "Z", shift=True),
    }
    pro = {
        "0,0": back_btn(),
        "1,0": c.hotkey_action("Insert\nF9", "insert", "F9"),
        "2,0": c.hotkey_action("Overwrite", "overwrite", "F10"),
        "3,0": c.hotkey_action("Replace\nF11", "replace", "F11"),
        "4,0": c.hotkey_action("Place\nTop F12", "placetop", "F12"),
        "0,1": c.hotkey_action("Append", "append", "F12", shift=True),
        "1,1": c.hotkey_action("Add\nTrans", "transition", "T", ctrl=True),
        "2,1": c.hotkey_action("Retime", "retime", "R", ctrl=True),
        "3,1": c.hotkey_action("Disable\nD", "disable", "D"),
        "4,1": c.hotkey_action("Trim\nT", "trim", "T"),
        "0,2": c.hotkey_action("Snap\nN", "snap", "N"),
        "1,2": c.hotkey_action("Redo", "redo", "Z", ctrl=True, shift=True),
        "2,2": c.hotkey_action("Prev\nEdit", "prevedit", "UP"),
        "3,2": c.hotkey_action("Next\nEdit", "nextedit", "DOWN"),
    }
    colors = {
        "0,0": back_btn(),
        "1,0": c.hotkey_action("Captions", "captions", "L", ctrl=True, alt=True, shift=True),
        "2,0": c.hotkey_action("Normalize", "normalize", "N", ctrl=True, alt=True, shift=True),
    }
    slots = ["0,1", "1,1", "2,1", "3,1", "4,1", "0,2", "1,2", "2,2"]
    for (name, _rgb, digit), pos in zip(RESOLVE_COLORS, slots):
        colors[pos] = c.hotkey_action(name, f"col-{name.lower()}", digit,
                                      ctrl=True, alt=True, shift=True)
    colors[slots[len(RESOLVE_COLORS)]] = c.hotkey_action(
        "Clear\nColor", "clearcolor", "0", ctrl=True, alt=True, shift=True)

    # XL (8x4): Edit + Pro folded onto one flat page (folders gone), with the 10
    # color/caption keys kept in a Colors folder — 35 content keys overflow 32.
    xl_colors_uuid = c.page_uuid_for(f"{seed}-xl", "colors")
    xl_home = {
        "0,0": home["0,0"], "1,0": home["1,0"], "2,0": pro["0,2"], "3,0": home["2,0"],
        "5,0": home["0,1"], "6,0": home["1,1"], "7,0": home["2,1"],
        "0,1": home["3,1"], "1,1": home["4,1"], "2,1": home["0,2"],
        "4,1": home["1,2"], "5,1": pro["1,2"], "6,1": home["2,2"], "7,1": home["3,2"],
        "0,2": pro["1,0"], "1,2": pro["2,0"], "2,2": pro["3,0"], "3,2": pro["4,0"],
        "4,2": pro["0,1"], "6,2": pro["1,1"], "7,2": pro["2,1"],
        "0,3": pro["4,1"], "1,3": pro["3,1"], "2,3": pro["2,2"], "3,3": pro["3,2"],
        "5,3": c.folder_action("Colors", "colorspg", xl_colors_uuid),
    }
    out = ROOT / "davinci-resolve"
    plugins = ["com.elgato.streamdeck.system.hotkey",
               "com.elgato.streamdeck.system.website"]
    emit(out, "DaVinci Resolve", seed,
         {"home": ("Resolve", home), "pro": ("Pro", pro),
          "colors": ("Captions & Colors", colors)},
         "home", imgs, plugins, mac=True,
         xl_pages={"home": ("Resolve", xl_home),
                   "colors": ("Captions & Colors", colors)}, xl_mac=True)
    c.write_url_file(out)
    c.export_icons(out, imgs)

# --------------------------------------------------- 3c. DaVinci Resolve Lite (free)
def build_davinci_lite():
    """Free tier: playback and marking on Resolve defaults, zero setup.

    Ships MK.2, XL and Stream Deck + so it is visible on every device facet the
    marketplace filters by.

    Deliberately does NOT ship the edit workflow. Blade, split, ripple delete and
    the whole Assembly page belong to DaVinci Resolve Pro, and a Get Pro key on the
    deck itself says where they went. Trimmed 2026-09-04 after 225 installs
    converted nobody: the old build handed over the entire cut, so there was
    nothing left to buy.
    """
    seed = "packrat-davinci-lite"
    O = DAVINCI_ORANGE
    spec = {
        "select": {"icon": "pointer", "fg": O},
        "markerflag": {"icon": "flag", "fg": O},
        "jrev": {"icon": "player-play", "fg": WHITE, "flip": True},
        "kstop": {"icon": "player-stop", "fg": WHITE},
        "lplay": {"icon": "player-play", "fg": WHITE},
        "in": {"icon": "arrow-bar-to-left", "fg": O},
        "out": {"icon": "arrow-bar-to-right", "fg": O},
        "undo": {"icon": "arrow-back", "fg": WHITE},
        "redo": {"icon": "arrow-back", "fg": WHITE, "flip": True},
        "snap": {"icon": "magnet", "fg": O},
        "zoomfit": {"icon": "zoom-scan", "fg": O},
        "scrub": {"icon": "arrows-horizontal", "fg": WHITE},
        "upsell": {"icon": "crown", "fg": O},
    }
    imgs = icons.build_set(spec, bg=DARK)

    from marketplace_policy import PRO_URL

    def get_pro():
        """The upsell, on a key. A .url file in the profile folder never gets seen."""
        return c.website_action("Get\nPro", "upsell", PRO_URL)

    # Row 1 keeps the transport slots it has always had, so an existing installer's
    # muscle memory for J/K/L and in/out still lands on the same keys.
    edit = {
        "0,0": c.hotkey_action("Select\nA", "select", "A"),
        "1,0": c.hotkey_action("Marker\nM", "markerflag", "M"),
        "2,0": c.hotkey_action("Snap\nN", "snap", "N"),
        "3,0": c.hotkey_action("Zoom\nFit", "zoomfit", "Z", shift=True),
        "4,0": get_pro(),
        "0,1": c.hotkey_action("Rev", "jrev", "J"),
        "1,1": c.hotkey_action("Stop", "kstop", "K"),
        "2,1": c.hotkey_action("Play", "lplay", "L"),
        "3,1": c.hotkey_action("In\nI", "in", "I"),
        "4,1": c.hotkey_action("Out\nO", "out", "O"),
        "0,2": c.hotkey_action("Undo", "undo", "Z", ctrl=True),
        "1,2": c.hotkey_action("Redo", "redo", "Z", ctrl=True, shift=True),
    }

    plus_dials = {
        # controlStep (plain arrows) moves the PLAYHEAD one frame per detent.
        # controlJump (Ctrl+Alt+arrows) was tried and rejected on hardware: it pans
        # the timeline view and leaves the playhead where it is, which is not what a
        # scrub dial should do. Resolve's only other default is controlLargeStep at
        # a whole second, so one frame is the finest honest option here.
        #
        # One dial, not four. Zoom, Undo and Edit Pt are Pro's Edit-side dial set.
        "0,0": c.dial_action("Scrub", "scrub", ("LEFT",), ("RIGHT",)),
    }
    plus = {
        "0,0": c.hotkey_action("Select\nA", "select", "A"),
        "1,0": c.hotkey_action("Marker\nM", "markerflag", "M"),
        "2,0": c.hotkey_action("Zoom\nFit", "zoomfit", "Z", shift=True),
        "3,0": get_pro(),
        "0,1": c.hotkey_action("In\nI", "in", "I"),
        "1,1": c.hotkey_action("Out\nO", "out", "O"),
    }

    out = ROOT / "davinci-resolve-lite"
    # The Get Pro key is a Website action, so its plugin has to be declared or the
    # profile refuses to import.
    plugins = ["com.elgato.streamdeck.system.hotkey",
               "com.elgato.streamdeck.system.website"]
    # One page now, so the XL build is the same page on the bigger grid: there is no
    # second page left to flatten into the spare columns.
    def used_images(actions, dials=None):
        names = {"black"}
        for action in [*actions.values(), *(dials or {}).values()]:
            for state in action.get("States", []):
                if state.get("Image"):
                    names.add(Path(state["Image"]).stem)
            if action.get("Encoder", {}).get("Icon"):
                names.add(Path(action["Encoder"]["Icon"]).stem)
        return {name: imgs[name] for name in names}

    pages = {"edit": ("Resolve", edit)}
    emit(out, "DaVinci Resolve Lite", seed, pages, "edit", used_images(edit), plugins, mac=True,
         xl_pages={"edit": ("Resolve", edit)}, xl_mac=True)
    _variants(out, "DaVinci Resolve Lite", f"{seed}-plus",
              {"edit": ("Resolve", plus, plus_dials)}, "edit", used_images(plus, plus_dials), plugins,
              c.PLUS, "Plus", mac=True)
    c.write_url_file(out, url=PRO_URL, filename="DaVinci Resolve Pro.url")
    c.export_icons(out, imgs)

# --------------------------------------------------- 3a. DaVinci Resolve Pro (Plus)
# Ctrl+Alt+Shift is the Packrat bind namespace; nothing in Resolve's default
# keymap uses it. Every key below marked CAS comes from the buyer-imported
# keyboard preset documented in profiles/davinci-resolve-pro/KEYBIND_SPEC.md.
def _cas(title, icon, key):
    return c.hotkey_action(title, icon, key, ctrl=True, alt=True, shift=True)


def build_davinci_pro():
    """Stream Deck + build: 4x2 keys plus 4 dials per page.

    The Color page dials drive Resolve's printer lights (one channel each), which
    is the control-surface behaviour the category's $44.99 specialist sells. Edit
    dials use Resolve defaults only, so they work before the preset is imported.
    """
    seed = "packrat-davinci-pro"
    O = DAVINCI_ORANGE
    spec = {
        "blade": {"icon": "cut", "fg": O},
        "select": {"icon": "pointer", "fg": O},
        "split": {"icon": "slash", "fg": O},
        "ripple": {"icon": "trash", "fg": O},
        "snap": {"icon": "magnet", "fg": O},
        "trim": {"icon": "scissors", "fg": O},
        "zoomfit": {"icon": "zoom-scan", "fg": O},
        "markerflag": {"icon": "flag", "fg": O},
        "lplay": {"icon": "player-play", "fg": WHITE},
        "kstop": {"icon": "player-stop", "fg": WHITE},
        "jrev": {"icon": "player-play", "fg": WHITE, "flip": True},
        "redo": {"icon": "arrow-back", "fg": WHITE, "flip": True},
        "prevedit": {"icon": "player-track-prev", "fg": WHITE},
        "nextedit": {"icon": "player-track-next", "fg": WHITE},
        # Frame step on keys. The Plus gets this on a dial, but MK.2 and XL have
        # no dials and stepping the playhead is too common to leave out.
        "framerev": {"icon": "caret-left", "fg": WHITE},
        "framefwd": {"icon": "caret-right", "fg": WHITE},
        "in": {"icon": "arrow-bar-to-left", "fg": O},
        "out": {"icon": "arrow-bar-to-right", "fg": O},
        "editpg": {"icon": "cut", "fg": O, "nav": True},
        "colorpg": {"icon": "palette", "fg": O, "nav": True},
        "asmpg": {"icon": "bolt", "fg": O, "nav": True},
        "gradepg": {"icon": "wand", "fg": O, "nav": True},
        "insert": {"icon": "row-insert-bottom", "fg": O},
        "overwrite": {"icon": "layers-intersect", "fg": O},
        "replace": {"icon": "repeat", "fg": O},
        "placetop": {"icon": "arrow-up", "fg": O},
        "append": {"icon": "plus", "fg": O},
        "transition": {"icon": "transition-right", "fg": O},
        "retime": {"icon": "clock-play", "fg": O},
        "nodeserial": {"icon": "binary-tree", "fg": O},
        "nodeparallel": {"icon": "hierarchy-2", "fg": O},
        "nodelayer": {"icon": "stack-2", "fg": O},
        "nodeoutside": {"icon": "layers-subtract", "fg": O},
        "bypassnode": {"icon": "eye-off", "fg": O},
        "bypassall": {"icon": "eye", "fg": O},
        "prevnode": {"icon": "chevron-left", "fg": WHITE},
        "nextnode": {"icon": "chevron-right", "fg": WHITE},
        "mema": {"icon": "circle-letter-a", "fg": O},
        "memb": {"icon": "circle-letter-b", "fg": O},
        "memc": {"icon": "circle-letter-c", "fg": O},
        "memsave": {"icon": "device-floppy", "fg": O},
        "grabgrade": {"icon": "copy", "fg": O},
        # Two faces for the Printer Lights switch: dim/struck-through when the mode
        # is off, lit orange when on. Nothing on the Color page responds until it
        # is on, so the deck has to say so.
        "plights": {"icon": "bulb-off", "fg": (135, 138, 148)},
        "plights-on": {"icon": "bulb", "fg": O},
        "version": {"icon": "versions", "fg": O},
        # dial faces
        "scrub": {"icon": "arrows-horizontal", "fg": WHITE},
        "zoomdial": {"icon": "zoom-in", "fg": WHITE},
        "undo": {"icon": "arrow-back", "fg": WHITE},
        "editpoint": {"icon": "arrows-vertical", "fg": WHITE},
        "plmaster": {"icon": "brightness", "fg": WHITE},
        "plred": {"icon": "circle", "fg": (255, 80, 80)},
        "plgreen": {"icon": "circle", "fg": (80, 230, 120)},
        "plblue": {"icon": "circle", "fg": (90, 160, 255)},
    }
    imgs = merged(spec)

    edit_uuid = c.page_uuid_for(seed, "edit")
    asm_uuid = c.page_uuid_for(seed, "asm")
    color_uuid = c.page_uuid_for(seed, "color")
    grade_uuid = c.page_uuid_for(seed, "grade")

    # Edit-side dials need no preset: all four are Resolve defaults.
    # Scrub uses controlJump (Ctrl+Alt+arrows). Tried on hardware: controlStep
    # (plain arrows, one frame) is too fine to spin, controlLargeStep (Shift,
    # one second) overshoots. Jump sits between the two.
    edit_dials = {
        # controlStep (plain arrows) moves the PLAYHEAD one frame per detent.
        # controlJump (Ctrl+Alt+arrows) was tried and rejected on hardware: it pans
        # the timeline view and leaves the playhead where it is, which is not what a
        # scrub dial should do. Resolve's only other default is controlLargeStep at
        # a whole second, so one frame is the finest honest option here.
        "0,0": c.dial_action("Scrub", "scrub", ("LEFT",), ("RIGHT",)),
        "1,0": c.dial_action("Zoom", "zoomdial", ("MINUS", True), ("EQUALS", True)),
        "2,0": c.dial_action("Undo", "undo", ("Z", True), ("Z", True, True)),
        "3,0": c.dial_action("Edit Pt", "editpoint", ("UP",), ("DOWN",)),
    }
    # Color dials drive Resolve's printer lights, which are already on the numeric
    # keypad by default (decoded straight out of keyboard.preset.xml: red 4/7,
    # green 5/8, blue 6/9, master keypad-plus). No keyboard preset needed.
    color_dials = {
        "0,0": c.dial_action("Master", "plmaster", ("NUMMINUS",), ("NUMPLUS",)),
        "1,0": c.dial_action("Red", "plred", ("NUM4",), ("NUM7",)),
        "2,0": c.dial_action("Green", "plgreen", ("NUM5",), ("NUM8",)),
        "3,0": c.dial_action("Blue", "plblue", ("NUM6",), ("NUM9",)),
    }

    home = {
        "0,0": c.folder_action("Edit", "editpg", edit_uuid),
        "1,0": c.folder_action("Assembly", "asmpg", asm_uuid),
        "2,0": c.folder_action("Color", "colorpg", color_uuid),
        "3,0": c.folder_action("Grade", "gradepg", grade_uuid),
        "0,1": c.hotkey_action("Play", "lplay", "L"),
        "1,1": c.hotkey_action("Marker\nM", "markerflag", "M"),
        "2,1": c.hotkey_action("In\nI", "in", "I"),
        "3,1": c.hotkey_action("Out\nO", "out", "O"),
    }
    edit = {
        "0,0": back_btn(),
        "1,0": c.hotkey_action("Blade\nB", "blade", "B"),
        "2,0": c.hotkey_action("Select\nA", "select", "A"),
        "3,0": c.hotkey_action("Split", "split", "B", ctrl=True),
        "0,1": c.hotkey_action("Ripple\nDel", "ripple", "BACKSPACE", shift=True),
        "1,1": c.hotkey_action("Snap\nN", "snap", "N"),
        "2,1": c.hotkey_action("Trim\nT", "trim", "T"),
        "3,1": c.hotkey_action("Zoom\nFit", "zoomfit", "Z", shift=True),
    }
    asm = {
        "0,0": back_btn(),
        "1,0": c.hotkey_action("Insert\nF9", "insert", "F9"),
        "2,0": c.hotkey_action("Overwrite", "overwrite", "F10"),
        "3,0": c.hotkey_action("Replace\nF11", "replace", "F11"),
        "0,1": c.hotkey_action("Place\nTop", "placetop", "F12"),
        "1,1": c.hotkey_action("Append", "append", "F12", shift=True),
        "2,1": c.hotkey_action("Add\nTrans", "transition", "T", ctrl=True),
        "3,1": c.hotkey_action("Retime", "retime", "R", ctrl=True),
    }
    # Every key below is a Resolve default, decoded from keyboard.preset.xml.
    # Printer Lights sits first because the dials below it do nothing until it is
    # on: with printer lights off, Resolve swallows the keypad as timecode entry.
    color = {
        "0,0": back_btn(),
        "1,0": c.hotkey_switch_action("Printer\nLights", "plights", "plights-on",
                                      "GRAVE", ctrl=True, alt=True),
        "2,0": c.hotkey_action("Serial\nNode", "nodeserial", "S", alt=True),
        "3,0": c.hotkey_action("Parallel", "nodeparallel", "P", alt=True),
        "0,1": c.hotkey_action("Layer", "nodelayer", "L", alt=True),
        "1,1": c.hotkey_action("Bypass", "bypassnode", "D", ctrl=True),
        "2,1": c.hotkey_action("Prev\nNode", "prevnode", "SEMICOLON", shift=True, alt=True),
        "3,1": c.hotkey_action("Next\nNode", "nextnode", "QUOTE", shift=True, alt=True),
    }
    grade = {
        "0,0": back_btn(),
        "1,0": c.hotkey_action("Save A", "mema", "1", alt=True),
        "2,0": c.hotkey_action("Save B", "memb", "2", alt=True),
        "3,0": c.hotkey_action("Save C", "memc", "3", alt=True),
        "0,1": c.hotkey_action("Outside\nNode", "nodeoutside", "O", alt=True),
        "1,1": c.hotkey_action("Grab\nGrade", "grabgrade", "EQUALS", shift=True),
        "2,1": c.hotkey_action("Add\nVersion", "version", "Y", ctrl=True),
        "3,1": c.hotkey_action("Next\nVersion", "memsave", "N", ctrl=True),
    }

    pages = {
        "home": ("Resolve Pro", home, edit_dials),
        "edit": ("Edit", edit, edit_dials),
        "asm": ("Assembly", asm, edit_dials),
        "color": ("Color", color, color_dials),
        "grade": ("Grade", grade, color_dials),
    }

    # MK.2 and XL have no dials, so the printer lights the Plus drives with its
    # Color dials become plain keys here. Same numeric-keypad defaults either way,
    # so the colour control surface is not a Plus-only feature.
    pl = [
        ("Mstr +", "plmaster", "NUMPLUS"), ("Mstr -", "plmaster", "NUMMINUS"),
        ("Red +", "plred", "NUM7"), ("Red -", "plred", "NUM4"),
        ("Grn +", "plgreen", "NUM8"), ("Grn -", "plgreen", "NUM5"),
        ("Blue +", "plblue", "NUM9"), ("Blue -", "plblue", "NUM6"),
    ]
    pl_keys = [c.hotkey_action(t, i, k) for t, i, k in pl]
    pl_toggle = c.hotkey_switch_action("Printer\nLights", "plights", "plights-on",
                                       "GRAVE", ctrl=True, alt=True)

    # --- MK.2 (5x3): five pages behind a home hub -------------------------------
    m_edit_u = c.page_uuid_for(f"{seed}-mk2", "edit")
    m_asm_u = c.page_uuid_for(f"{seed}-mk2", "asm")
    m_col_u = c.page_uuid_for(f"{seed}-mk2", "color")
    m_grd_u = c.page_uuid_for(f"{seed}-mk2", "grade")
    m_home = {
        "0,0": c.folder_action("Edit", "editpg", m_edit_u),
        "1,0": c.folder_action("Assembly", "asmpg", m_asm_u),
        "2,0": c.folder_action("Color", "colorpg", m_col_u),
        "3,0": c.folder_action("Grade", "gradepg", m_grd_u),
        "4,0": c.hotkey_action("Marker\nM", "markerflag", "M"),
        "0,1": c.hotkey_action("Rev", "jrev", "J"),
        "1,1": c.hotkey_action("Stop", "kstop", "K"),
        "2,1": c.hotkey_action("Play", "lplay", "L"),
        "3,1": c.hotkey_action("In\nI", "in", "I"),
        "4,1": c.hotkey_action("Out\nO", "out", "O"),
        "0,2": c.hotkey_action("Blade\nB", "blade", "B"),
        "1,2": c.hotkey_action("Select\nA", "select", "A"),
        "2,2": c.hotkey_action("Split", "split", "B", ctrl=True),
        "3,2": c.hotkey_action("Ripple\nDel", "ripple", "BACKSPACE", shift=True),
        "4,2": c.hotkey_action("Zoom\nFit", "zoomfit", "Z", shift=True),
    }
    frame_rev = c.hotkey_action("Frame\nBack", "framerev", "LEFT")
    frame_fwd = c.hotkey_action("Frame\nFwd", "framefwd", "RIGHT")
    m_edit = {"0,0": back_btn(), **{k: v for k, v in zip(
        ["1,0", "2,0", "3,0", "4,0", "0,1", "1,1", "2,1", "3,1", "4,1", "0,2", "1,2",
         "2,2", "3,2"],
        [edit["1,0"], edit["2,0"], edit["3,0"], edit["0,1"], edit["1,1"], edit["2,1"],
         edit["3,1"], c.hotkey_action("Undo", "undo", "Z", ctrl=True),
         c.hotkey_action("Redo", "redo", "Z", ctrl=True, shift=True),
         c.hotkey_action("Prev\nEdit", "prevedit", "UP"),
         c.hotkey_action("Next\nEdit", "nextedit", "DOWN"),
         frame_rev, frame_fwd])}}
    m_asm = {"0,0": back_btn(), **{k: asm[a] for k, a in zip(
        ["1,0", "2,0", "3,0", "4,0", "0,1", "1,1", "2,1"],
        ["1,0", "2,0", "3,0", "0,1", "1,1", "2,1", "3,1"])}}
    # The whole point of Pro on a deck with no dials: printer lights on keys.
    m_color = {"0,0": back_btn(), "1,0": pl_toggle,
               **{f"{(i + 2) % 5},{(i + 2) // 5}": kk for i, kk in enumerate(pl_keys)},
               "0,2": color["2,0"], "1,2": color["3,0"], "2,2": color["0,1"],
               "3,2": color["1,1"], "4,2": color["3,1"]}
    m_grade = {"0,0": back_btn(), **{k: grade[a] for k, a in zip(
        ["1,0", "2,0", "3,0", "4,0", "0,1", "1,1", "2,1"],
        ["1,0", "2,0", "3,0", "0,1", "1,1", "2,1", "3,1"])}}
    mk2_pages = {"home": ("Resolve Pro", m_home), "edit": ("Edit", m_edit),
                 "asm": ("Assembly", m_asm), "color": ("Color", m_color),
                 "grade": ("Grade", m_grade)}

    # --- XL (8x4): everything flat, no folder hops ------------------------------
    xl_pages_rows = [
        [edit["1,0"], edit["2,0"], m_home["4,0"], edit["3,0"], edit["0,1"],
         edit["1,1"], edit["2,1"], edit["3,1"]],
        [m_home["0,1"], m_home["1,1"], m_home["2,1"], m_home["3,1"], m_home["4,1"],
         m_edit["3,1"], m_edit["4,1"], m_edit["0,2"]],
        [asm["1,0"], asm["2,0"], asm["3,0"], asm["0,1"], asm["1,1"], asm["2,1"],
         asm["3,1"], m_edit["1,2"]],
        # Frame step earns its slots on the XL: no dials here, and stepping the
        # playhead is far more frequent than the last three printer-light keys,
        # which move to the Color page.
        # 8 slots exactly: toggle + 4 printer lights + 2 frame keys + the Color
        # folder that gets written at 7,3 below. The remaining printer lights
        # live on the Color page.
        [pl_toggle] + pl_keys[:4] + [frame_rev, frame_fwd],
    ]
    xl = {f"{col},{row}": act for row, acts in enumerate(xl_pages_rows)
          for col, act in enumerate(acts)}
    # emit() derives the XL seed as "<seed>-xl" from what it is handed, and it is
    # handed "<seed>-mk2", so the folder target has to match that chain exactly.
    xl_color_u = c.page_uuid_for(f"{seed}-mk2-xl", "color")
    xl["7,3"] = c.folder_action("Color", "colorpg", xl_color_u)
    xl_color_rest = [color["2,0"], color["3,0"], color["0,1"], color["1,1"],
                     color["2,1"], color["3,1"], grade["1,0"], grade["2,0"],
                     grade["3,0"], grade["0,1"], grade["1,1"], grade["2,1"],
                     grade["3,1"]]
    # Explicit free slots beat index arithmetic here: the arithmetic version ran
    # one past the 8x4 grid and the validator caught it.
    xl_color_slots = [f"{col},0" for col in range(2, 8)] + \
                     [f"{col},1" for col in range(2, 8)] + \
                     [f"{col},2" for col in range(8)]
    xl_color = {"0,0": back_btn(), "1,0": pl_keys[4], "0,1": pl_keys[5],
                "1,1": pl_keys[6], "0,2": pl_keys[7],
                **dict(zip(xl_color_slots, xl_color_rest))}
    xl_pages = {"home": ("Resolve Pro", xl), "color": ("Color", xl_color)}

    out = ROOT / "davinci-resolve-pro"
    plugins = ["com.elgato.streamdeck.system.hotkey"]
    emit(out, "DaVinci Resolve Pro", f"{seed}-mk2", mk2_pages, "home", imgs, plugins,
         mac=True, xl_pages=xl_pages, xl_mac=True)
    _variants(out, "DaVinci Resolve Pro", seed, pages, "home", imgs, plugins,
              c.PLUS, "Plus", mac=True)
    c.write_url_file(out)
    c.export_icons(out, imgs)


# --------------------------------------------------- 3b. DaVinci Resolve (VSD)
def build_davinci_vsd():
    """Virtual Stream Deck variant: same content as the MK.2/XL profile, reflowed
    flat across the 8x8/64-key VSD canvas -- folders removed (Pro and Colors pages
    fold into the same screen as Edit), since the bigger canvas has room for the
    whole 35-key command set at once.

    UNVERIFIED-ON-HARDWARE like the other VSD variants -- see common.VSD's model
    confirmation note, but this content itself is a straight reuse of build_davinci(),
    already QA'd and shipped on MK.2/XL."""
    seed = "packrat-davinci-starter-vsd"
    O = DAVINCI_ORANGE
    spec = {
        "blade": {"icon": "cut", "fg": O},
        "select": {"icon": "pointer", "fg": O},
        "trim": {"icon": "scissors", "fg": O},
        "snap": {"icon": "magnet", "fg": O},
        "markerflag": {"icon": "flag", "fg": O},
        "jrev": {"icon": "player-play", "fg": WHITE, "flip": True},
        "kstop": {"icon": "player-stop", "fg": WHITE},
        "lplay": {"icon": "player-play", "fg": WHITE},
        "in": {"icon": "arrow-bar-to-left", "fg": O},
        "out": {"icon": "arrow-bar-to-right", "fg": O},
        "split": {"icon": "slash", "fg": O},
        "undo": {"icon": "arrow-back", "fg": WHITE},
        "redo": {"icon": "arrow-back", "fg": WHITE, "flip": True},
        "ripple": {"icon": "trash", "fg": O},
        "zoomfit": {"icon": "zoom-scan", "fg": O},
        "insert": {"icon": "row-insert-bottom", "fg": O},
        "overwrite": {"icon": "layers-intersect", "fg": O},
        "replace": {"icon": "repeat", "fg": O},
        "placetop": {"icon": "arrow-up", "fg": O},
        "append": {"icon": "plus", "fg": O},
        "transition": {"icon": "transition-right", "fg": O},
        "retime": {"icon": "clock-play", "fg": O},
        "disable": {"icon": "ban", "fg": O},
        "prevedit": {"icon": "player-track-prev", "fg": WHITE},
        "nextedit": {"icon": "player-track-next", "fg": WHITE},
        "captions": {"icon": "badge-cc", "fg": O},
        "normalize": {"icon": "wave-sine", "fg": O},
        "clearcolor": {"icon": "circle-off", "fg": WHITE},
        **{f"col-{n.lower()}": {"icon": "circle", "fg": rgb} for n, rgb, _ in RESOLVE_COLORS},
    }
    imgs = merged(spec)

    home = {
        "0,0": c.hotkey_action("Blade\nB", "blade", "B"),
        "1,0": c.hotkey_action("Select\nA", "select", "A"),
        "2,0": c.hotkey_action("Marker\nM", "markerflag", "M"),
        "3,0": c.hotkey_action("Rev", "jrev", "J"),
        "4,0": c.hotkey_action("Stop", "kstop", "K"),
        "5,0": c.hotkey_action("Play", "lplay", "L"),
        "6,0": c.hotkey_action("In\nI", "in", "I"),
        "7,0": c.hotkey_action("Out\nO", "out", "O"),
        "0,1": c.hotkey_action("Split", "split", "B", ctrl=True),
        "1,1": c.hotkey_action("Undo", "undo", "Z", ctrl=True),
        "2,1": c.hotkey_action("Redo", "redo", "Z", ctrl=True, shift=True),
        "3,1": c.hotkey_action("Ripple\nDel", "ripple", "BACKSPACE", shift=True),
        "4,1": c.hotkey_action("Zoom\nFit", "zoomfit", "Z", shift=True),
        "5,1": c.hotkey_action("Snap\nN", "snap", "N"),
        "6,1": c.hotkey_action("Prev\nEdit", "prevedit", "UP"),
        "7,1": c.hotkey_action("Next\nEdit", "nextedit", "DOWN"),
        # Row 3-4: Pro page content (was a folder on the desk-deck version).
        "0,3": c.hotkey_action("Insert\nF9", "insert", "F9"),
        "1,3": c.hotkey_action("Overwrite", "overwrite", "F10"),
        "2,3": c.hotkey_action("Replace\nF11", "replace", "F11"),
        "3,3": c.hotkey_action("Place\nTop F12", "placetop", "F12"),
        "4,3": c.hotkey_action("Append", "append", "F12", shift=True),
        "5,3": c.hotkey_action("Add\nTrans", "transition", "T", ctrl=True),
        "6,3": c.hotkey_action("Retime", "retime", "R", ctrl=True),
        "7,3": c.hotkey_action("Disable\nD", "disable", "D"),
        "0,4": c.hotkey_action("Trim\nT", "trim", "T"),
        # Row 6-7: Captions & Colors page content (was a folder).
        "0,6": c.hotkey_action("Captions", "captions", "L", ctrl=True, alt=True, shift=True),
        "1,6": c.hotkey_action("Normalize", "normalize", "N", ctrl=True, alt=True, shift=True),
    }
    color_slots = ["2,6", "3,6", "4,6", "5,6", "6,6", "7,6", "0,7"]
    for (name, _rgb, digit), pos in zip(RESOLVE_COLORS, color_slots):
        home[pos] = c.hotkey_action(name, f"col-{name.lower()}", digit,
                                    ctrl=True, alt=True, shift=True)
    home["1,7"] = c.hotkey_action("Clear\nColor", "clearcolor", "0",
                                  ctrl=True, alt=True, shift=True)

    out = ROOT / "davinci-resolve"
    plugins = ["com.elgato.streamdeck.system.hotkey"]
    # DaVinci ships Mac on the desk-deck version, so it ships here too.
    _variants(out, "DaVinci Resolve", seed, {"home": ("Resolve", home)}, "home",
              imgs, plugins, c.VSD, "VSD", mac=True)


# ----------------------------------------------------------------- 4. Palworld
def build_palworld():
    seed = "packrat-palworld"
    B = PAL_BLUE
    spec = {
        "sprint": {"icon": "run", "fg": WHITE},
        "sprint-on": {"icon": "run", "fg": B, "dot": GREEN_DOT},
        "autohit": {"icon": "pick", "fg": WHITE},
        "autohit-on": {"icon": "pick", "fg": B, "dot": GREEN_DOT},
        "sort": {"icon": "backpack", "fg": B},
        "map": {"icon": "map-2", "fg": B},
        "inv": {"icon": "backpack", "fg": WHITE},
        "build": {"icon": "hammer", "fg": B},
        "throw": {"icon": "target", "fg": B},
        "guide": {"icon": "book", "fg": B, "nav": True},
        "wiki": {"icon": "book", "fg": WHITE},
        "db": {"icon": "database", "fg": B},
        "gmap": {"icon": "map-2", "fg": WHITE},
        "patch": {"icon": "news", "fg": B},
    }
    imgs = merged(spec)
    guide_uuid = c.page_uuid_for(seed, "guide")
    guide = {
        "0,0": back_btn(),
        "1,0": c.website_action("Wiki", "wiki", "https://palworld.wiki.gg"),
        "2,0": c.website_action("Pal DB", "db", "https://paldb.cc"),
        "3,0": c.website_action("Full\nMap", "gmap", "https://mapgenie.io/palworld"),
        "4,0": c.website_action("Patch\nNotes", "patch",
                                "https://store.steampowered.com/news/app/1623730"),
    }
    home = {
        "0,0": c.bh_toggle_key("Auto\nSprint", "sprint", ["SHIFT", "W"]),
        "1,0": c.bh_toggle_mouse("Auto\nHit", "autohit", "left"),
        "2,0": c.bh_click_mouse("Sort\nInv", "sort", "left", at_point=True,
                                x_pct=50, y_pct=50),
        "3,0": c.hotkey_action("Map\nM", "map", "M"),
        "4,0": c.hotkey_action("Bag\nTab", "inv", "TAB"),
        "0,1": c.hotkey_action("Build\nB", "build", "B"),
        "1,1": c.hotkey_action("Throw\nPal Q", "throw", "Q"),
        "2,1": c.folder_action("Guide", "guide", guide_uuid),
    }
    # XL (8x4): actions row + blank separator + guide/reference links. No folder.
    xl_home = {
        "0,0": home["0,0"], "1,0": home["1,0"], "2,0": home["2,0"],
        "4,0": home["3,0"], "5,0": home["4,0"], "6,0": home["0,1"], "7,0": home["1,1"],
        "0,2": guide["1,0"], "1,2": guide["2,0"], "2,2": guide["3,0"], "3,2": guide["4,0"],
    }
    out = ROOT / "palworld"
    plugins = ["com.elgato.streamdeck.system.hotkey",
               "com.elgato.streamdeck.system.website", c.BH_PLUGIN]
    # Palworld has a native macOS client, so Mac variants ship (functional once the
    # Better Hotkeys macOS build lands — see docs/HANDOFF in the plugin repo).
    emit(out, "Palworld", seed,
         {"home": ("Palworld", home), "guide": ("Guide", guide)},
         "home", imgs, plugins, mac=True,
         xl_pages={"home": ("Palworld", xl_home)}, xl_mac=True)
    c.write_url_file(out)
    c.export_icons(out, imgs)

# ---------------------------------------------------------- 5. Discord Essentials
def build_discord():
    """v2: built on the official Discord plugin — keys reflect LIVE Discord state
    (muted, camera on, sharing) and need zero keybind setup, just a one-time
    'Request access' OAuth in the Stream Deck app."""
    seed = "packrat-discord-essentials"
    D = DISCORD_BLURPLE
    RED = (255, 95, 95)
    spec = {
        # two-state pairs: state 0 = idle/off, state 1 = engaged
        "dmute": {"icon": "microphone", "fg": WHITE},
        "dmute-on": {"icon": "microphone-off", "fg": RED},
        "ddeafen": {"icon": "headphones", "fg": WHITE},
        "ddeafen-on": {"icon": "headphones-off", "fg": RED},
        "cam": {"icon": "video-off", "fg": WHITE},
        "cam-on": {"icon": "video", "fg": D, "dot": GREEN_DOT},
        "share": {"icon": "screen-share-off", "fg": WHITE},
        "share-on": {"icon": "screen-share", "fg": D, "dot": GREEN_DOT},
        "mode-va": {"icon": "activity", "fg": WHITE},
        "mode-ptt": {"icon": "microphone", "fg": D},
        "ptt": {"icon": "microphone", "fg": D},
        "notif": {"icon": "bell", "fg": D},
        "audio": {"icon": "device-speaker", "fg": D},
        "quick": {"icon": "keyboard", "fg": D},
        "discord": {"icon": "brand-discord", "fg": D},
    }
    imgs = merged(spec)
    home = {
        "0,0": c.discord_action("Mute\nMic", "mute", "dmute", "dmute-on"),
        "1,0": c.discord_action("Deafen", "deafen", "ddeafen", "ddeafen-on"),
        "2,0": c.discord_action("Push to\nTalk", "pushto.talk", "ptt"),
        "3,0": c.discord_action("Voice\nMode", "pushtotalktoggle", "mode-va", "mode-ptt"),
        "4,0": c.discord_action("Camera", "videotoggle", "cam", "cam-on"),
        "0,1": c.discord_action("Screen\nShare", "streamtoggle", "share", "share-on"),
        "1,1": c.discord_action("Notifs", "notifications", "notif"),
        "2,1": c.discord_action("Audio\nDevice", "setaudiodevice", "audio"),
        "3,1": c.hotkey_action("Quick\nSwitch", "quick", "K", ctrl=True),
        "4,1": c.website_action("Open\nDiscord", "discord", "https://discord.com/app"),
    }
    # XL (8x4): one flat page — comms row, a blank separator row, session + links.
    xl_home = {
        "0,0": home["0,0"], "1,0": home["1,0"], "2,0": home["2,0"],
        "3,0": home["3,0"], "4,0": home["4,0"], "5,0": home["0,1"],
        "0,2": home["1,1"], "1,2": home["2,1"], "2,2": home["3,1"], "3,2": home["4,1"],
    }
    out = ROOT / "discord-essentials"
    plugins = ["com.elgato.streamdeck.system.hotkey",
               "com.elgato.streamdeck.system.website", c.DISCORD_PLUGIN]
    emit(out, "Discord", seed,
         {"home": ("Discord", home)}, "home", imgs, plugins, mac=True,
         xl_pages={"home": ("Discord", xl_home)}, xl_mac=True)
    c.write_url_file(out)
    c.export_icons(out, imgs)

# ------------------------------------------------------- 6. Streamer University
def build_streamer_u():
    seed = "packrat-streamer-university"
    G = SU_GOLD
    spec = {
        "clip": {"icon": "scissors", "fg": G},
        "markerflag": {"icon": "flag", "fg": G},
        "record": {"icon": "player-record", "fg": G},
        "stream": {"icon": "broadcast", "fg": G},
        "campus": {"icon": "school", "fg": G},
        "shop": {"icon": "shopping-cart", "fg": G},
        "kai": {"icon": "brand-twitch", "fg": G},
        "clips24": {"icon": "clock", "fg": G},
        "clips7d": {"icon": "calendar", "fg": G},
        "grow": {"icon": "dashboard", "fg": G, "nav": True},
        "twdash": {"icon": "dashboard", "fg": G},
        "yt": {"icon": "brand-youtube", "fg": G},
        "tiktok": {"icon": "brand-tiktok", "fg": G},
        "ideas": {"icon": "wand", "fg": G},
        "videos": {"icon": "folder", "fg": G},
    }
    imgs = merged(spec, bg=SU_MAROON)
    # The real SU crest (site favicon asset). "suhub" is the nav-folder variant
    # on the home page; "campus" is the plain action key inside the hub.
    crest = Path(__file__).parent / "assets" / "logos" / "su-crest-raw.png"
    if crest.exists():
        imgs["campus"] = icons.image_key(crest, bg=SU_MAROON)
        imgs["suhub"] = icons.image_key(crest, bg=SU_MAROON, nav=True, nav_color=SU_GOLD)

    hub_uuid = c.page_uuid_for(seed, "hub")
    grow_uuid = c.page_uuid_for(seed, "grow")

    hub = {
        "0,0": back_btn(),
        "1,0": c.website_action("Campus\nLive", "campus", "https://streameruniversity.com/"),
        "2,0": c.website_action("SU\nShop", "shop", "https://shop.streameruniversity.com"),
        "3,0": c.website_action("Kai\nLive", "kai", "https://www.twitch.tv/kaicenat"),
        "1,1": c.website_action("Clips\n24h", "clips24",
                                "https://www.twitch.tv/directory/category/streamer-university/clips?range=24hr"),
        "2,1": c.website_action("Clips\n7 Days", "clips7d",
                                "https://www.twitch.tv/directory/category/streamer-university/clips?range=7d"),
    }
    IDEAS_PROMPT = (
        "Give me 10 stream title ideas for today's stream. Make them punchy, "
        "clickable, under 60 characters, and true to what I'm actually doing. "
        "My stream today: ")
    grow = {
        "0,0": back_btn(),
        "1,0": c.website_action("Twitch\nDash", "twdash", "https://dashboard.twitch.tv"),
        "2,0": c.website_action("YT\nStudio", "yt", "https://studio.youtube.com"),
        "3,0": c.website_action("TikTok\nStudio", "tiktok", "https://www.tiktok.com/tiktokstudio"),
        "1,1": c.text_action("Title\nIdeas", "ideas", IDEAS_PROMPT),
    }
    home = {
        "0,0": mute_btn(), "1,0": deafen_btn(), "2,0": clip_btn(),
        "3,0": marker_btn(), "4,0": record_btn(),
        "0,1": stream_btn(),
        "1,1": c.folder_action("SU Hub", "suhub", hub_uuid),
        "2,1": c.folder_action("Dash\nboards", "grow", grow_uuid),
        "3,1": c.open_action("Videos", "videos", "%USERPROFILE%\\Videos"),
    }
    # XL (8x4): controls row, SU Hub row, Dashboards row — both folders unfolded.
    xl_home = {
        "0,0": home["0,0"], "1,0": home["1,0"], "2,0": home["2,0"],
        "3,0": home["3,0"], "4,0": home["4,0"], "5,0": home["0,1"],
        "7,0": home["3,1"],  # Videos
        "0,1": hub["1,0"], "1,1": hub["2,0"], "2,1": hub["3,0"],
        "3,1": hub["1,1"], "4,1": hub["2,1"],
        "0,2": grow["1,0"], "1,2": grow["2,0"], "2,2": grow["3,0"], "3,2": grow["1,1"],
    }
    out = ROOT / "streamer-university"
    plugins = ["com.elgato.streamdeck.system.hotkey",
               "com.elgato.streamdeck.system.website",
               "com.elgato.streamdeck.system.open",
               "com.elgato.streamdeck.system.text"]
    emit(out, "Streamer University", seed,
         {"home": ("Campus", home), "hub": ("SU Hub", hub),
          "grow": ("Dashboards", grow)},
         "home", imgs, plugins, mac=True,
         xl_pages={"home": ("Campus", xl_home)}, xl_mac=True)
    c.write_url_file(out)
    c.export_icons(out, imgs)


# ------------------------------------------------------------- 7. Vectorworks
def build_vectorworks():
    """CAD/BIM shortcut profile, same shape as DaVinci Resolve: every key is a
    Vectorworks 2026 DEFAULT shortcut, so the buyer imports and works with zero
    keyboard-customization setup. One bundled profile across editions rather than
    SideshowFX's per-edition SKU split (VALIDATION.md).

    Only shortcuts that are identical on Windows and Mac, or that differ purely by
    the Ctrl->Cmd convention mac_variant() already applies, are used. Vectorworks'
    genuinely divergent binds (Clip, Connect/Combine, Attribute Mapping, Window)
    are deliberately cut so one layout is correct on both platforms."""
    seed = "packrat-vectorworks"
    T = VW_TEAL
    spec = {
        "select": {"icon": "pointer", "fg": T},
        "pan": {"icon": "hand-grab", "fg": WHITE},
        "zoomtool": {"icon": "zoom-in", "fg": WHITE},
        "line": {"icon": "slash", "fg": T},
        "rect": {"icon": "square", "fg": T},
        "circle": {"icon": "circle", "fg": T},
        "arc": {"icon": "circle-half", "fg": T},
        "polyline": {"icon": "vector", "fg": T},
        "polygon": {"icon": "polygon", "fg": T},
        "wall": {"icon": "wall", "fg": T},
        "undo": {"icon": "arrow-back", "fg": WHITE},
        "redo": {"icon": "arrow-back", "fg": WHITE, "flip": True},
        "save": {"icon": "device-floppy", "fg": WHITE},
        "modifypg": {"icon": "adjustments", "fg": T, "nav": True},
        "viewspg": {"icon": "cube", "fg": T, "nav": True},
        "move": {"icon": "arrows-move", "fg": T},
        "dupe": {"icon": "copy", "fg": T},
        "grp": {"icon": "layers-union", "fg": T},
        "ungrp": {"icon": "layers-subtract", "fg": T},
        "mirror": {"icon": "flip-horizontal", "fg": T},
        "offset": {"icon": "border-outer", "fg": T},
        "fillet": {"icon": "radius-bottom-left", "fg": T},
        "split": {"icon": "cut", "fg": T},
        "trim": {"icon": "scissors", "fg": T},
        "front": {"icon": "arrow-bar-to-up", "fg": T},
        "back2": {"icon": "arrow-bar-to-down", "fg": T},
        "rotl": {"icon": "rotate-2", "fg": T},
        "rotr": {"icon": "rotate-clockwise-2", "fg": T},
        "dropper": {"icon": "color-picker", "fg": T},
        "pushpull": {"icon": "cube-plus", "fg": T},
        "extrude": {"icon": "cube", "fg": T},
        "addsolid": {"icon": "layers-union", "fg": T},
        "subsolid": {"icon": "layers-subtract", "fg": T},
        "flyover": {"icon": "3d-rotate", "fg": T},
        "walkthru": {"icon": "walk", "fg": T},
        "topplan": {"icon": "layout-grid", "fg": T},
        "view3d": {"icon": "perspective", "fg": T},
        "fitobj": {"icon": "zoom-scan", "fg": T},
        "wire": {"icon": "grid-3x3", "fg": T},
        "shaded": {"icon": "circle-half-2", "fg": T},
        "hidden": {"icon": "line-dashed", "fg": T},
        "render": {"icon": "sparkles", "fg": T},
        "objinfo": {"icon": "info-circle", "fg": T},
    }
    imgs = merged(spec)
    modify_uuid = c.page_uuid_for(seed, "modify")
    views_uuid = c.page_uuid_for(seed, "views")

    # Tool shortcuts are single keys on the NUMBER ROW (the numeric keypad is
    # reserved by Vectorworks for standard views and cannot be rebound).
    draw = {
        "0,0": c.hotkey_action("Select\nX", "select", "X"),
        "1,0": c.hotkey_action("Pan\nH", "pan", "H"),
        "2,0": c.hotkey_action("Zoom\nC", "zoomtool", "C"),
        "3,0": c.hotkey_action("Line\n2", "line", "2"),
        "4,0": c.hotkey_action("Rect\n4", "rect", "4"),
        "0,1": c.hotkey_action("Circle\n6", "circle", "6"),
        "1,1": c.hotkey_action("Arc\n3", "arc", "3"),
        "2,1": c.hotkey_action("Polyline\n5", "polyline", "5"),
        "3,1": c.hotkey_action("Polygon\n8", "polygon", "8"),
        "4,1": c.hotkey_action("Wall\n9", "wall", "9"),
        "0,2": c.hotkey_action("Undo", "undo", "Z", ctrl=True),
        "1,2": c.hotkey_action("Redo", "redo", "Y", ctrl=True),
        "2,2": c.hotkey_action("Save", "save", "S", ctrl=True),
        "3,2": c.folder_action("Modify", "modifypg", modify_uuid),
        "4,2": c.folder_action("3D &\nViews", "viewspg", views_uuid),
    }
    modify = {
        "0,0": back_btn(),
        "1,0": c.hotkey_action("Move", "move", "M", ctrl=True),
        "2,0": c.hotkey_action("Duplic\nate", "dupe", "D", ctrl=True),
        "3,0": c.hotkey_action("Group", "grp", "G", ctrl=True),
        "4,0": c.hotkey_action("Ungroup", "ungrp", "U", ctrl=True),
        "0,1": c.hotkey_action("Mirror\n=", "mirror", "EQUALS"),
        "1,1": c.hotkey_action("Offset", "offset", "MINUS", shift=True),
        "2,1": c.hotkey_action("Fillet\n7", "fillet", "7"),
        "3,1": c.hotkey_action("Split\nL", "split", "L"),
        "4,1": c.hotkey_action("Trim", "trim", "T", ctrl=True),
        "0,2": c.hotkey_action("Bring\nFront", "front", "F", ctrl=True),
        "1,2": c.hotkey_action("Send\nBack", "back2", "B", ctrl=True),
        "2,2": c.hotkey_action("Rotate\nLeft", "rotl", "L", ctrl=True),
        "3,2": c.hotkey_action("Rotate\nRight", "rotr", "R", ctrl=True, shift=True),
        "4,2": c.hotkey_action("Eye\ndropper", "dropper", "E", shift=True),
    }
    views = {
        "0,0": back_btn(),
        "1,0": c.hotkey_action("Push\nPull", "pushpull", "R", shift=True),
        "2,0": c.hotkey_action("Extrude", "extrude", "E", ctrl=True),
        "3,0": c.hotkey_action("Add\nSolids", "addsolid", "A", ctrl=True, alt=True),
        "4,0": c.hotkey_action("Sub\nSolids", "subsolid", "S", ctrl=True, alt=True),
        "0,1": c.hotkey_action("Flyover", "flyover", "C", shift=True),
        "1,1": c.hotkey_action("Walk\nthrough", "walkthru", "U", shift=True),
        "2,1": c.hotkey_action("Top /\nPlan", "topplan", "5", ctrl=True),
        "3,1": c.hotkey_action("Set 3D\nView", "view3d", "0", ctrl=True),
        "4,1": c.hotkey_action("Fit to\nObjects", "fitobj", "6", ctrl=True),
        "0,2": c.hotkey_action("Wire\nframe", "wire", "W", ctrl=True, shift=True),
        "1,2": c.hotkey_action("Shaded", "shaded", "G", ctrl=True, shift=True),
        "2,2": c.hotkey_action("Hidden\nLine", "hidden", "E", ctrl=True, shift=True),
        "3,2": c.hotkey_action("Render", "render", "F", ctrl=True, shift=True),
        "4,2": c.hotkey_action("Object\nInfo", "objinfo", "I", ctrl=True),
    }
    # XL (8x4): Draw and Modify fold onto one flat page (both folders gone); the
    # 3D & Views page stays a folder because 41 content keys overflow 32.
    xl_views_uuid = c.page_uuid_for(f"{seed}-xl", "views")
    xl_draw = {
        "0,0": draw["0,0"], "1,0": draw["1,0"], "2,0": draw["2,0"], "3,0": draw["3,0"],
        "4,0": draw["4,0"], "5,0": draw["0,1"], "6,0": draw["1,1"], "7,0": draw["2,1"],
        "0,1": draw["3,1"], "1,1": draw["4,1"], "2,1": modify["2,1"], "3,1": modify["3,1"],
        "4,1": modify["0,1"], "5,1": modify["1,1"], "6,1": modify["4,2"], "7,1": modify["4,1"],
        "0,2": modify["1,0"], "1,2": modify["2,0"], "2,2": modify["3,0"], "3,2": modify["4,0"],
        "4,2": modify["0,2"], "5,2": modify["1,2"], "6,2": modify["2,2"], "7,2": modify["3,2"],
        "0,3": draw["0,2"], "1,3": draw["1,2"], "2,3": draw["2,2"],
        "6,3": c.folder_action("3D &\nViews", "viewspg", xl_views_uuid),
    }
    out = ROOT / "vectorworks"
    plugins = ["com.elgato.streamdeck.system.hotkey"]
    emit(out, "Vectorworks", seed,
         {"home": ("Draw", draw), "modify": ("Modify", modify),
          "views": ("3D & Views", views)},
         "home", imgs, plugins, mac=True,
         xl_pages={"home": ("Draw", xl_draw), "views": ("3D & Views", views)},
         xl_mac=True)
    c.write_url_file(out)
    c.export_icons(out, imgs)


# ---------------------------------------------------------------- 8. Fortnite
def build_fortnite():
    """Battle Royale defaults only (VALIDATION.md scopes v1 away from Creative and
    Zero Build). Same model as the published Valorant profile: comms, capture and
    intel on home, one-tap presses of Fortnite's own DEFAULT keybinds on the Game
    page. One press = one action, no macros, no sequences.

    Deliberately NOT here: the building pieces (Z/X/C/V), Building Edit (G) and
    Rotate. Those are the highest-APM inputs in the game and a deck press is
    slower than the keyboard key sitting under the player's hand, so putting them
    on a key would sell a button that makes the buyer worse. Better Hotkeys is
    used for Push to Talk only, matching Valorant -- a comms key, never movement."""
    seed = "packrat-fortnite"
    B = FN_BLUE
    spec = {
        "clip": {"icon": "scissors", "fg": B},
        "markerflag": {"icon": "flag", "fg": B},
        "record": {"icon": "player-record", "fg": B},
        "stream": {"icon": "broadcast", "fg": B},
        "ptt": {"icon": "microphone", "fg": WHITE},
        "ptt-on": {"icon": "microphone", "fg": B, "dot": GREEN_DOT},
        "map": {"icon": "map-2", "fg": B},
        "inv": {"icon": "backpack", "fg": WHITE},
        "emote": {"icon": "mood-smile", "fg": B},
        "chat": {"icon": "message", "fg": WHITE},
        "squad": {"icon": "users-group", "fg": B},
        "game": {"icon": "device-gamepad-2", "fg": B, "nav": True},
        "links": {"icon": "world", "fg": B, "nav": True},
        "s1": {"icon": "number-1", "fg": WHITE},
        "s2": {"icon": "number-2", "fg": WHITE},
        "s3": {"icon": "number-3", "fg": WHITE},
        "s4": {"icon": "number-4", "fg": WHITE},
        "s5": {"icon": "number-5", "fg": WHITE},
        "pickaxe": {"icon": "pick", "fg": B},
        "reload": {"icon": "refresh", "fg": WHITE},
        "use": {"icon": "hand-click", "fg": WHITE},
        "trap": {"icon": "alert-triangle", "fg": B},
        "upgrade": {"icon": "arrow-big-up", "fg": B},
        "tracker": {"icon": "chart-bar", "fg": B},
        "shop": {"icon": "shopping-bag", "fg": B},
        "news": {"icon": "news", "fg": B},
        "poi": {"icon": "map-pin", "fg": B},
    }
    imgs = merged(spec)
    game_uuid = c.page_uuid_for(seed, "game")
    links_uuid = c.page_uuid_for(seed, "links")

    game = {
        "0,0": back_btn(),
        "1,0": c.hotkey_action("Slot 1", "s1", "1"),
        "2,0": c.hotkey_action("Slot 2", "s2", "2"),
        "3,0": c.hotkey_action("Slot 3", "s3", "3"),
        "4,0": c.hotkey_action("Slot 4", "s4", "4"),
        "0,1": c.hotkey_action("Slot 5", "s5", "5"),
        "1,1": c.hotkey_action("Pickaxe\nF", "pickaxe", "F"),
        "2,1": c.hotkey_action("Reload\nR", "reload", "R"),
        "3,1": c.hotkey_action("Pick Up\nE", "use", "E"),
        "4,1": c.hotkey_action("Trap\nY", "trap", "Y"),
        "0,2": c.hotkey_action("Upgrade\nH", "upgrade", "H"),
    }
    links = {
        "0,0": back_btn(),
        "1,0": c.website_action("Stats", "tracker", "https://fortnitetracker.com"),
        "2,0": c.website_action("Item\nShop", "shop", "https://www.fortnite.com/item-shop"),
        "3,0": c.website_action("Patch\nNotes", "news", "https://www.fortnite.com/news"),
        "4,0": c.website_action("Map &\nPOIs", "poi", "https://fortnite.gg/map"),
    }
    home = {
        "0,0": mute_btn(), "1,0": deafen_btn(),
        "2,0": c.bh_hold_key("Push to\nTalk", "ptt", ["T"]),
        "3,0": clip_btn(), "4,0": marker_btn(),
        "0,1": record_btn(), "1,1": stream_btn(),
        "2,1": c.hotkey_action("Map\nM", "map", "M"),
        "3,1": c.hotkey_action("Bag\nTab", "inv", "TAB"),
        "4,1": c.hotkey_action("Emote\nB", "emote", "B"),
        "0,2": c.folder_action("Game", "game", game_uuid),
        "1,2": c.folder_action("Links", "links", links_uuid),
        "2,2": c.hotkey_action("Chat", "chat", "ENTER"),
        "3,2": c.hotkey_action("Squad\nF4", "squad", "F4"),
    }
    # XL (8x4): all three pages flat, no folders. 26 keys of 32.
    xl_home = {
        "0,0": home["0,0"], "1,0": home["1,0"], "2,0": home["2,0"], "3,0": home["3,0"],
        "4,0": home["4,0"], "5,0": home["0,1"], "6,0": home["1,1"],
        "0,1": home["2,1"], "1,1": home["3,1"], "2,1": home["4,1"],
        "3,1": home["2,2"], "4,1": home["3,2"],
        "0,2": game["1,0"], "1,2": game["2,0"], "2,2": game["3,0"], "3,2": game["4,0"],
        "4,2": game["0,1"], "5,2": game["1,1"], "6,2": game["2,1"], "7,2": game["3,1"],
        "0,3": game["4,1"], "1,3": game["0,2"],
        "4,3": links["1,0"], "5,3": links["2,0"], "6,3": links["3,0"], "7,3": links["4,0"],
    }
    out = ROOT / "fortnite"
    plugins = ["com.elgato.streamdeck.system.hotkey",
               "com.elgato.streamdeck.system.website", c.BH_PLUGIN]
    # Windows only for v1, same call as Valorant: PC is the dominant competitive
    # population even though Fortnite has a Mac client (VALIDATION.md).
    emit(out, "Fortnite", seed,
         {"home": ("Fortnite", home), "game": ("Game", game), "links": ("Links", links)},
         "home", imgs, plugins, mac=False,
         xl_pages={"home": ("Fortnite", xl_home)}, xl_mac=False)
    c.write_url_file(out)
    c.export_icons(out, imgs)


# ------------------------------------------------------------ 9. Satisfactory
def build_satisfactory():
    """Factory-builder profile on Satisfactory's own DEFAULT 1.0+ keybinds
    (official wiki, patch 1.1.0.6). Single-player/co-op PvE with no anti-cheat,
    and the useful actions here are menus and tools rather than twitch inputs, so
    this genre suits a deck better than the shooters do.

    The hotbar page sends the number-row digits 1-9 and 0 (slot 10), which is what
    Satisfactory binds by default."""
    seed = "packrat-satisfactory"
    O = SF_ORANGE
    spec = {
        "build": {"icon": "hammer", "fg": O},
        "dismantle": {"icon": "trash", "fg": O},
        "buildmode": {"icon": "adjustments", "fg": O},
        "lockholo": {"icon": "lock", "fg": O},
        "customizer": {"icon": "palette", "fg": O},
        "inv": {"icon": "backpack", "fg": WHITE},
        "map": {"icon": "map-2", "fg": O},
        "scan": {"icon": "radar", "fg": O},
        "codex": {"icon": "book", "fg": O},
        "torch": {"icon": "bulb", "fg": WHITE},
        "photo": {"icon": "camera", "fg": O},
        "use": {"icon": "hand-click", "fg": WHITE},
        "hotbar": {"icon": "layout-grid", "fg": O, "nav": True},
        "guide": {"icon": "world", "fg": O, "nav": True},
        **{f"h{n}": {"icon": f"number-{n}", "fg": WHITE} for n in range(10)},
        "wiki": {"icon": "book", "fg": WHITE},
        "calc": {"icon": "calculator", "fg": O},
        "tools": {"icon": "list-check", "fg": O},
        "news": {"icon": "news", "fg": O},
    }
    imgs = merged(spec)
    hotbar_uuid = c.page_uuid_for(seed, "hotbar")
    guide_uuid = c.page_uuid_for(seed, "guide")

    # Hotbar slots 1-9 then 0 for slot 10, all number-row keys.
    HOT = [("Slot 1", "1"), ("Slot 2", "2"), ("Slot 3", "3"), ("Slot 4", "4"),
           ("Slot 5", "5"), ("Slot 6", "6"), ("Slot 7", "7"), ("Slot 8", "8"),
           ("Slot 9", "9"), ("Slot 10", "0")]
    hotbar = {"0,0": back_btn()}
    slots = [p for p in c.positions(c.MK2) if p != "0,0"]
    for (label, key), pos in zip(HOT, slots):
        hotbar[pos] = c.hotkey_action(label, f"h{key}", key)

    guide = {
        "0,0": back_btn(),
        "1,0": c.website_action("Wiki", "wiki", "https://satisfactory.wiki.gg"),
        "2,0": c.website_action("Calc", "calc", "https://satisfactory-calculator.com"),
        "3,0": c.website_action("Recipes", "tools", "https://satisfactorytools.com"),
        "4,0": c.website_action("Patch\nNotes", "news",
                                "https://store.steampowered.com/news/app/526870"),
    }
    home = {
        "0,0": c.hotkey_action("Build\nQ", "build", "Q"),
        "1,0": c.hotkey_action("Dismant\nle F", "dismantle", "F"),
        "2,0": c.hotkey_action("Build\nMode R", "buildmode", "R"),
        "3,0": c.hotkey_action("Lock\nHolo H", "lockholo", "H"),
        "4,0": c.hotkey_action("Custom\nizer X", "customizer", "X"),
        "0,1": c.hotkey_action("Bag\nTab", "inv", "TAB"),
        "1,1": c.hotkey_action("Map\nM", "map", "M"),
        "2,1": c.hotkey_action("Scanner\nV", "scan", "V"),
        "3,1": c.hotkey_action("Codex\nO", "codex", "O"),
        "4,1": c.hotkey_action("Torch\nB", "torch", "B"),
        "0,2": c.folder_action("Hotbar", "hotbar", hotbar_uuid),
        "1,2": c.folder_action("Guide", "guide", guide_uuid),
        "2,2": c.hotkey_action("Photo\nP", "photo", "P"),
        "3,2": c.hotkey_action("Use\nE", "use", "E"),
    }
    # XL (8x4): all three pages flat, no folders. 26 keys of 32.
    hot_objs = [hotbar[p] for p in slots[:len(HOT)]]
    xl_home = {
        "0,0": home["0,0"], "1,0": home["1,0"], "2,0": home["2,0"], "3,0": home["3,0"],
        "4,0": home["4,0"], "5,0": home["0,1"], "6,0": home["1,1"], "7,0": home["2,1"],
        "0,1": home["3,1"], "1,1": home["4,1"], "2,1": home["2,2"], "3,1": home["3,2"],
        **{f"{i},2": hot_objs[i] for i in range(8)},
        "0,3": hot_objs[8], "1,3": hot_objs[9],
        "4,3": guide["1,0"], "5,3": guide["2,0"], "6,3": guide["3,0"], "7,3": guide["4,0"],
    }
    out = ROOT / "satisfactory"
    plugins = ["com.elgato.streamdeck.system.hotkey",
               "com.elgato.streamdeck.system.website"]
    # No native macOS client, so Windows only (VALIDATION.md).
    emit(out, "Satisfactory", seed,
         {"home": ("Satisfactory", home), "hotbar": ("Hotbar", hotbar),
          "guide": ("Guide", guide)},
         "home", imgs, plugins, mac=False,
         xl_pages={"home": ("Satisfactory", xl_home)}, xl_mac=False)
    c.write_url_file(out)
    c.export_icons(out, imgs)


# -------------------------------------------------------- 10. World of Warcraft
def build_wow():
    """Utility layer only, per VALIDATION.md: the UI panels a player opens dozens
    of times a session, plus the twelve DEFAULT action bar keys.

    This is deliberately NOT a rotation or automation helper. WoW's ToS has the
    sharpest anti-automation posture of anything in the roster, so every key here
    is one tap of one key the game already binds. Hearthstone, mounts and
    consumables are not default-bound to anything -- they are items the player
    drags onto an action bar -- so the deck sends the bar slot and the README
    tells the buyer which slot to park them in. That is what 'mapped to keys the
    player already bound' means, and it is the whole legal position."""
    seed = "packrat-world-of-warcraft"
    G = WOW_GOLD
    spec = {
        "char": {"icon": "user", "fg": G},
        "spellbook": {"icon": "book", "fg": G},
        "talents": {"icon": "hierarchy", "fg": G},
        "achieve": {"icon": "trophy", "fg": G},
        "map": {"icon": "map-2", "fg": G},
        "bags": {"icon": "backpack", "fg": WHITE},
        "mounts": {"icon": "horse", "fg": G},
        "finder": {"icon": "users-group", "fg": G},
        "guild": {"icon": "shield", "fg": G},
        "social": {"icon": "users", "fg": WHITE},
        "chat": {"icon": "message", "fg": WHITE},
        "reply": {"icon": "corner-up-left", "fg": WHITE},
        "hideui": {"icon": "eye-off", "fg": WHITE},
        "readycheck": {"icon": "circle-check", "fg": (110, 230, 140)},
        "barpg": {"icon": "layout-grid", "fg": G, "nav": True},
        "guide": {"icon": "world", "fg": G, "nav": True},
        **{f"b{n}": {"icon": f"number-{n}", "fg": WHITE} for n in range(10)},
        "bminus": {"icon": "minus", "fg": WHITE},
        "bequal": {"icon": "equal", "fg": WHITE},
        "wowhead": {"icon": "world", "fg": WHITE},
        "raiderio": {"icon": "chart-bar", "fg": G},
        "logs": {"icon": "file-analytics", "fg": G},
        "news": {"icon": "news", "fg": G},
    }
    imgs = merged(spec)
    bar_uuid = c.page_uuid_for(seed, "bar")
    guide_uuid = c.page_uuid_for(seed, "guide")

    # The default primary action bar: 1-9, 0, -, = for slots 1-12.
    BAR = [("Bar 1", "1", "b1"), ("Bar 2", "2", "b2"), ("Bar 3", "3", "b3"),
           ("Bar 4", "4", "b4"), ("Bar 5", "5", "b5"), ("Bar 6", "6", "b6"),
           ("Bar 7", "7", "b7"), ("Bar 8", "8", "b8"), ("Bar 9", "9", "b9"),
           ("Bar 10", "0", "b0"), ("Bar 11", "MINUS", "bminus"),
           ("Bar 12", "EQUALS", "bequal")]
    bar = {"0,0": back_btn()}
    slots = [p for p in c.positions(c.MK2) if p != "0,0"]
    for (label, key, icon), pos in zip(BAR, slots):
        bar[pos] = c.hotkey_action(label, icon, key)

    guide = {
        "0,0": back_btn(),
        "1,0": c.website_action("Wowhead", "wowhead", "https://www.wowhead.com"),
        "2,0": c.website_action("Raider\nIO", "raiderio", "https://raider.io"),
        "3,0": c.website_action("Logs", "logs", "https://www.warcraftlogs.com"),
        "4,0": c.website_action("Patch\nNotes", "news",
                                "https://worldofwarcraft.blizzard.com/en-us/news"),
    }
    home = {
        "0,0": c.hotkey_action("Charac\nter C", "char", "C"),
        "1,0": c.hotkey_action("Spells\nP", "spellbook", "P"),
        "2,0": c.hotkey_action("Talents\nN", "talents", "N"),
        "3,0": c.hotkey_action("Achieve\nY", "achieve", "Y"),
        "4,0": c.hotkey_action("Map\nM", "map", "M"),
        "0,1": c.hotkey_action("Bags\nB", "bags", "B"),
        "1,1": c.hotkey_action("Mounts", "mounts", "P", shift=True),
        "2,1": c.hotkey_action("Group\nFinder", "finder", "I"),
        "3,1": c.hotkey_action("Guild\nJ", "guild", "J"),
        # Raid-leader tool, the one community-requested action the panel keys miss.
        # Typed (not pasted) so the leading '/' really opens WoW's chat box.
        "4,1": c.text_action("Ready\nCheck", "readycheck", "/readycheck",
                             typing=True, send_enter=True),
        "0,2": c.folder_action("Action\nBar", "barpg", bar_uuid),
        "1,2": c.folder_action("Guide", "guide", guide_uuid),
        "2,2": c.hotkey_action("Chat", "chat", "ENTER"),
        "3,2": c.hotkey_action("Reply\nR", "reply", "R"),
        "4,2": c.hotkey_action("Hide UI", "hideui", "Z", alt=True),
    }
    # XL (8x4): all three pages flat, no folders. The Social panel comes back here
    # because the 8x4 grid has room; on the MK.2 its slot went to Ready Check,
    # which a raid leader presses far more than the friends list.
    bar_objs = [bar[p] for p in slots[:len(BAR)]]
    social = c.hotkey_action("Social\nO", "social", "O")
    xl_home = {
        "0,0": home["0,0"], "1,0": home["1,0"], "2,0": home["2,0"], "3,0": home["3,0"],
        "4,0": home["4,0"], "5,0": home["0,1"], "6,0": home["1,1"], "7,0": home["2,1"],
        "0,1": home["3,1"], "1,1": home["4,1"], "2,1": home["2,2"], "3,1": home["3,2"],
        "4,1": home["4,2"], "5,1": social,
        **{f"{i},2": bar_objs[i] for i in range(8)},
        "0,3": bar_objs[8], "1,3": bar_objs[9], "2,3": bar_objs[10], "3,3": bar_objs[11],
        "4,3": guide["1,0"], "5,3": guide["2,0"], "6,3": guide["3,0"], "7,3": guide["4,0"],
    }
    out = ROOT / "world-of-warcraft"
    plugins = ["com.elgato.streamdeck.system.hotkey",
               "com.elgato.streamdeck.system.website"]
    # WoW is fully native on macOS, unlike most of this batch, so Mac ships.
    emit(out, "World of Warcraft", seed,
         {"home": ("Warcraft", home), "bar": ("Action Bar", bar),
          "guide": ("Guide", guide)},
         "home", imgs, plugins, mac=True,
         xl_pages={"home": ("Warcraft", xl_home)}, xl_mac=True)
    c.write_url_file(out)
    c.export_icons(out, imgs)


# -------------------------------------------- 10b. World of Warcraft (VSD)
def build_wow_vsd():
    """Virtual Stream Deck variant (NIGHTSWORD and other VSD-unlock devices): same
    content as the MK.2/XL profile, reflowed flat across the 8x8/64-key VSD canvas.
    Folders are gone -- the canvas has room for everything at once, and a panel
    summoned mid-fight shouldn't cost a folder tap the way a desk deck can afford
    to.

    Ships as its OWN product (world-of-warcraft-vsd), not as a variant inside the
    desk-deck listing. Elgato rejected the combined listing on 2026-08-17 because
    the uploaded zip carried no profile for the mice it was tagged for, and the
    VSD-only shelf (minecraft, cs2, league-of-legends, dota2, fl-studio) is already
    how every other mouse product here is packaged."""
    seed = "packrat-world-of-warcraft-vsd"
    G = WOW_GOLD
    spec = {
        "char": {"icon": "user", "fg": G},
        "spellbook": {"icon": "book", "fg": G},
        "talents": {"icon": "hierarchy", "fg": G},
        "achieve": {"icon": "trophy", "fg": G},
        "map": {"icon": "map-2", "fg": G},
        "bags": {"icon": "backpack", "fg": WHITE},
        "mounts": {"icon": "horse", "fg": G},
        "finder": {"icon": "users-group", "fg": G},
        "guild": {"icon": "shield", "fg": G},
        "chat": {"icon": "message", "fg": WHITE},
        "reply": {"icon": "corner-up-left", "fg": WHITE},
        "hideui": {"icon": "eye-off", "fg": WHITE},
        "readycheck": {"icon": "circle-check", "fg": (110, 230, 140)},
        **{f"b{n}": {"icon": f"number-{n}", "fg": WHITE} for n in range(10)},
        "bminus": {"icon": "minus", "fg": WHITE},
        "bequal": {"icon": "equal", "fg": WHITE},
        "wowhead": {"icon": "world", "fg": WHITE},
        "raiderio": {"icon": "chart-bar", "fg": G},
        "logs": {"icon": "file-analytics", "fg": G},
        "news": {"icon": "news", "fg": G},
    }
    imgs = merged(spec)

    # Same default primary action bar as the desk-deck version: 1-9, 0, -, = .
    BAR = [("Bar 1", "1", "b1"), ("Bar 2", "2", "b2"), ("Bar 3", "3", "b3"),
           ("Bar 4", "4", "b4"), ("Bar 5", "5", "b5"), ("Bar 6", "6", "b6"),
           ("Bar 7", "7", "b7"), ("Bar 8", "8", "b8"), ("Bar 9", "9", "b9"),
           ("Bar 10", "0", "b0"), ("Bar 11", "MINUS", "bminus"),
           ("Bar 12", "EQUALS", "bequal")]

    home = {
        "0,0": c.hotkey_action("Charac\nter C", "char", "C"),
        "1,0": c.hotkey_action("Spells\nP", "spellbook", "P"),
        "2,0": c.hotkey_action("Talents\nN", "talents", "N"),
        "3,0": c.hotkey_action("Achieve\nY", "achieve", "Y"),
        "4,0": c.hotkey_action("Map\nM", "map", "M"),
        "5,0": c.hotkey_action("Bags\nB", "bags", "B"),
        "6,0": c.hotkey_action("Mounts", "mounts", "P", shift=True),
        "7,0": c.hotkey_action("Group\nFinder", "finder", "I"),
        "0,1": c.hotkey_action("Guild\nJ", "guild", "J"),
        "1,1": c.text_action("Ready\nCheck", "readycheck", "/readycheck",
                             typing=True, send_enter=True),
        "2,1": c.hotkey_action("Chat", "chat", "ENTER"),
        "3,1": c.hotkey_action("Reply\nR", "reply", "R"),
        "4,1": c.hotkey_action("Hide UI", "hideui", "Z", alt=True),
    }
    # Row 3-4: the full 12-slot action bar, one flat row and change (no folder).
    for i, (label, key, icon) in enumerate(BAR):
        col, row = i % 8, 3 + i // 8
        home[f"{col},{row}"] = c.hotkey_action(label, icon, key)
    # Row 6: reference links (was the Guide folder on the desk-deck version).
    home.update({
        "1,6": c.website_action("Wowhead", "wowhead", "https://www.wowhead.com"),
        "2,6": c.website_action("Raider\nIO", "raiderio", "https://raider.io"),
        "3,6": c.website_action("Logs", "logs", "https://www.warcraftlogs.com"),
        "4,6": c.website_action("Patch\nNotes", "news",
                                "https://worldofwarcraft.blizzard.com/en-us/news"),
    })
    out = ROOT / "world-of-warcraft-vsd"
    plugins = ["com.elgato.streamdeck.system.hotkey",
               "com.elgato.streamdeck.system.website"]
    # WoW ships Mac on the desk-deck version, so it ships here too.
    _variants(out, "World of Warcraft", seed, {"home": ("Warcraft", home)}, "home",
              imgs, plugins, c.VSD, "VSD", mac=True)


# --------------------------------------------------------- 11. Elite Dangerous
def build_elite():
    """Ship systems, the four UI panels and the power distributor on Elite's own
    DEFAULT keyboard binds. The best genre fit in the roster: Elite is a
    panel-heavy flight sim where the useful actions are toggles and mode switches,
    not twitch inputs, which is exactly the shape a deck is good at.

    Ship Lights needs the Insert key, which is why INSERT was added to common.py's
    VK/Qt maps. Mac deliberately has no INSERT entry (no such key on Mac
    keyboards); this product is Windows only, so mac_variant() never sees it."""
    seed = "packrat-elite-dangerous"
    O = ED_ORANGE
    spec = {
        "gear": {"icon": "plane-departure", "fg": O},
        "scoop": {"icon": "package", "fg": O},
        "hardpoints": {"icon": "target", "fg": O},
        "lights": {"icon": "bulb", "fg": WHITE},
        "silent": {"icon": "ghost", "fg": O},
        "fsd": {"icon": "rocket", "fg": O},
        "hyper": {"icon": "sparkles", "fg": O},
        "fa": {"icon": "steering-wheel", "fg": O},
        "boost": {"icon": "bolt", "fg": O},
        "heatsink": {"icon": "flame", "fg": O},
        "galmap": {"icon": "planet", "fg": O},
        "panelspg": {"icon": "layout-sidebar", "fg": O, "nav": True},
        "targetpg": {"icon": "crosshair", "fg": O, "nav": True},
        "nav": {"icon": "route", "fg": O},
        "comms": {"icon": "message", "fg": WHITE},
        "role": {"icon": "ship", "fg": O},
        "systems": {"icon": "settings", "fg": WHITE},
        "pipsys": {"icon": "shield", "fg": (90, 190, 255)},
        "pipeng": {"icon": "engine", "fg": (110, 230, 140)},
        "pipwep": {"icon": "target", "fg": (255, 100, 100)},
        "pipbal": {"icon": "scale", "fg": WHITE},
        "tahead": {"icon": "crosshair", "fg": O},
        "tnext": {"icon": "ship", "fg": WHITE},
        "tthreat": {"icon": "alert-triangle", "fg": O},
        "tsub": {"icon": "adjustments-horizontal", "fg": O},
    }
    imgs = merged(spec)
    panels_uuid = c.page_uuid_for(seed, "panels")
    target_uuid = c.page_uuid_for(seed, "target")

    # UI panels are 1-4 (Navigation, Comms, Role, Systems) and the power
    # distributor is the arrow cluster, mapped spatially to the HUD: SYS on the
    # left, ENG up, WEP on the right, Down balances.
    panels = {
        "0,0": back_btn(),
        "1,0": c.hotkey_action("Nav\n1", "nav", "1"),
        "2,0": c.hotkey_action("Comms\n2", "comms", "2"),
        "3,0": c.hotkey_action("Role\n3", "role", "3"),
        "4,0": c.hotkey_action("Systems\n4", "systems", "4"),
        "0,1": c.hotkey_action("Pip SYS", "pipsys", "LEFT"),
        "1,1": c.hotkey_action("Pip ENG", "pipeng", "UP"),
        "2,1": c.hotkey_action("Pip WEP", "pipwep", "RIGHT"),
        "3,1": c.hotkey_action("Balance", "pipbal", "DOWN"),
    }
    target = {
        "0,0": back_btn(),
        "1,0": c.hotkey_action("Ahead\nT", "tahead", "T"),
        "2,0": c.hotkey_action("Next\nShip G", "tnext", "G"),
        "3,0": c.hotkey_action("Threat\nH", "tthreat", "H"),
        "4,0": c.hotkey_action("Sub\nsystem", "tsub", "Y"),
    }
    home = {
        "0,0": c.hotkey_action("Landing\nGear L", "gear", "L"),
        "1,0": c.hotkey_action("Cargo\nScoop", "scoop", "HOME"),
        "2,0": c.hotkey_action("Hard\npoints U", "hardpoints", "U"),
        "3,0": c.hotkey_action("Lights", "lights", "INSERT"),
        "4,0": c.hotkey_action("Silent\nRun", "silent", "DELETE"),
        "0,1": c.hotkey_action("Frame\nShift J", "fsd", "J"),
        "1,1": c.hotkey_action("Hyper\nspace", "hyper", "QUOTE"),
        "2,1": c.hotkey_action("Flight\nAssist", "fa", "Z"),
        "3,1": c.hotkey_action("Boost\nTab", "boost", "TAB"),
        "4,1": c.hotkey_action("Heat\nSink V", "heatsink", "V"),
        "0,2": c.folder_action("Panels", "panelspg", panels_uuid),
        "1,2": c.folder_action("Target", "targetpg", target_uuid),
        "2,2": c.hotkey_action("Galaxy\nMap M", "galmap", "M"),
    }
    # XL (8x4): all three pages flat, no folders. 23 keys of 32.
    xl_home = {
        "0,0": home["0,0"], "1,0": home["1,0"], "2,0": home["2,0"], "3,0": home["3,0"],
        "4,0": home["4,0"], "5,0": home["0,1"], "6,0": home["1,1"], "7,0": home["2,2"],
        "0,1": home["2,1"], "1,1": home["3,1"], "2,1": home["4,1"],
        "0,2": panels["1,0"], "1,2": panels["2,0"], "2,2": panels["3,0"],
        "3,2": panels["4,0"], "5,2": panels["0,1"], "6,2": panels["1,1"],
        "7,2": panels["2,1"],
        "0,3": panels["3,1"],
        "4,3": target["1,0"], "5,3": target["2,0"], "6,3": target["3,0"],
        "7,3": target["4,0"],
    }
    out = ROOT / "elite-dangerous"
    plugins = ["com.elgato.streamdeck.system.hotkey"]
    # PC only: keyboard/HOTAS play, no Mac client (VALIDATION.md).
    emit(out, "Elite Dangerous", seed,
         {"home": ("Elite", home), "panels": ("Panels & Pips", panels),
          "target": ("Target", target)},
         "home", imgs, plugins, mac=False,
         xl_pages={"home": ("Elite", xl_home)}, xl_mac=False)
    c.write_url_file(out)
    c.export_icons(out, imgs)


# --------------------------------------------------- 12. Old School RuneScape
def build_osrs():
    """OSRS's interface tabs are already a clean F1-F12 plus Escape set (official
    wiki, Shortcut keys), which is close to a perfect deck fit: thirteen panel
    switches that are otherwise a mouse trip to the tab row.

    The in-game World Map (Ctrl+M) is deliberately NOT a key here: mac_variant()
    would turn it into Cmd+M, which is Minimize Window on macOS. The Guide page
    links out to Explv's map instead, which is correct on both platforms."""
    seed = "packrat-osrs"
    G = OSRS_GOLD
    spec = {
        "inv": {"icon": "backpack", "fg": WHITE},
        "combat": {"icon": "sword", "fg": G},
        "skills": {"icon": "chart-bar", "fg": G},
        "quests": {"icon": "book", "fg": G},
        "equip": {"icon": "shirt", "fg": G},
        "prayer": {"icon": "sparkles", "fg": G},
        "magic": {"icon": "wand", "fg": G},
        "clan": {"icon": "users-group", "fg": G},
        "friends": {"icon": "user", "fg": WHITE},
        "account": {"icon": "settings", "fg": G},
        "options": {"icon": "settings", "fg": WHITE},
        "emotes": {"icon": "mood-smile", "fg": G},
        "music": {"icon": "music", "fg": G},
        "guide": {"icon": "world", "fg": G, "nav": True},
        "wiki": {"icon": "book", "fg": WHITE},
        "map": {"icon": "map-2", "fg": G},
        "prices": {"icon": "coins", "fg": G},
        "hiscores": {"icon": "trophy", "fg": G},
        "quests": {"icon": "list-check", "fg": G},
        "dps": {"icon": "sword", "fg": G},
        "wom": {"icon": "chart-line", "fg": G},
        "temple": {"icon": "flame", "fg": G},
        "worlds": {"icon": "server", "fg": WHITE},
        "news": {"icon": "news", "fg": G},
    }
    imgs = merged(spec)
    guide_uuid = c.page_uuid_for(seed, "guide")

    # The reference layer is this profile's real differentiator: the competing
    # OSRS profiles ship tab navigation and stop there. Prices, XP tracking and
    # the DPS calculator are the tabs an OSRS player keeps open on a second
    # monitor anyway.
    guide = {
        "0,0": back_btn(),
        "1,0": c.website_action("Wiki", "wiki", "https://oldschool.runescape.wiki"),
        "2,0": c.website_action("World\nMap", "map", "https://explv.github.io"),
        "3,0": c.website_action("GE\nPrices", "prices", "https://prices.runescape.wiki"),
        "4,0": c.website_action("Hi\nscores", "hiscores",
                                "https://secure.runescape.com/m=hiscore_oldschool/overall"),
        "0,1": c.website_action("Quests", "quests",
                                "https://oldschool.runescape.wiki/w/Quests/List"),
        "1,1": c.website_action("DPS\nCalc", "dps", "https://dps.osrs.wiki"),
        "2,1": c.website_action("Wise\nOld Man", "wom", "https://wiseoldman.net"),
        "3,1": c.website_action("Temple\nOSRS", "temple", "https://templeosrs.com"),
        "4,1": c.website_action("Worlds", "worlds", "https://oldschool.runescape.com/slu"),
        "0,2": c.website_action("News", "news",
                                "https://secure.runescape.com/m=news/list?oldschool=1"),
    }
    home = {
        "0,0": c.hotkey_action("Bag\nEsc", "inv", "ESC"),
        "1,0": c.hotkey_action("Combat\nF1", "combat", "F1"),
        "2,0": c.hotkey_action("Skills\nF2", "skills", "F2"),
        "3,0": c.hotkey_action("Quests\nF3", "quests", "F3"),
        "4,0": c.hotkey_action("Gear\nF4", "equip", "F4"),
        "0,1": c.hotkey_action("Prayer\nF5", "prayer", "F5"),
        "1,1": c.hotkey_action("Magic\nF6", "magic", "F6"),
        "2,1": c.hotkey_action("Clan\nF7", "clan", "F7"),
        "3,1": c.hotkey_action("Friends\nF8", "friends", "F8"),
        "4,1": c.hotkey_action("Account\nF9", "account", "F9"),
        "0,2": c.hotkey_action("Options\nF10", "options", "F10"),
        "1,2": c.hotkey_action("Emotes\nF11", "emotes", "F11"),
        "2,2": c.hotkey_action("Music\nF12", "music", "F12"),
        "3,2": c.folder_action("Guide", "guide", guide_uuid),
    }
    # XL (8x4): both pages flat, no folder. Tabs on the top two rows, the whole
    # reference layer on the bottom two. 23 keys of 32.
    xl_home = {
        "0,0": home["0,0"], "1,0": home["1,0"], "2,0": home["2,0"], "3,0": home["3,0"],
        "4,0": home["4,0"], "5,0": home["0,1"], "6,0": home["1,1"], "7,0": home["2,1"],
        "0,1": home["3,1"], "1,1": home["4,1"], "2,1": home["0,2"], "3,1": home["1,2"],
        "4,1": home["2,2"],
        "0,2": guide["1,0"], "1,2": guide["2,0"], "2,2": guide["3,0"], "3,2": guide["4,0"],
        "4,2": guide["0,1"], "5,2": guide["1,1"], "6,2": guide["2,1"], "7,2": guide["3,1"],
        "0,3": guide["4,1"], "1,3": guide["0,2"],
    }
    out = ROOT / "osrs"
    plugins = ["com.elgato.streamdeck.system.hotkey",
               "com.elgato.streamdeck.system.website"]
    # The OSRS client is cross-platform and Mac use is common in this community.
    emit(out, "Old School RuneScape", seed,
         {"home": ("Old School", home), "guide": ("Guide", guide)},
         "home", imgs, plugins, mac=True,
         xl_pages={"home": ("Old School", xl_home)}, xl_mac=True)
    c.write_url_file(out)
    c.export_icons(out, imgs)


# --------------------------------------------------- 12b. Old School RuneScape (VSD)
def build_osrs_vsd():
    """Virtual Stream Deck variant: same F1-F12/Esc tab set plus the reference
    layer, reflowed flat across the 8x8/64-key VSD canvas -- no Guide folder, since
    the canvas has room for both rows of content at once.

    Ships as its OWN product (osrs-vsd), not as a variant inside the desk-deck
    listing. See build_wow_vsd for why."""
    seed = "packrat-osrs-vsd"
    G = OSRS_GOLD
    spec = {
        "inv": {"icon": "backpack", "fg": WHITE},
        "combat": {"icon": "sword", "fg": G},
        "skills": {"icon": "chart-bar", "fg": G},
        "quests": {"icon": "list-check", "fg": G},
        "equip": {"icon": "shirt", "fg": G},
        "prayer": {"icon": "sparkles", "fg": G},
        "magic": {"icon": "wand", "fg": G},
        "clan": {"icon": "users-group", "fg": G},
        "friends": {"icon": "user", "fg": WHITE},
        "account": {"icon": "settings", "fg": G},
        "options": {"icon": "settings", "fg": WHITE},
        "emotes": {"icon": "mood-smile", "fg": G},
        "music": {"icon": "music", "fg": G},
        "wiki": {"icon": "book", "fg": WHITE},
        "map": {"icon": "map-2", "fg": G},
        "prices": {"icon": "coins", "fg": G},
        "hiscores": {"icon": "trophy", "fg": G},
        "questslist": {"icon": "book", "fg": G},
        "dps": {"icon": "sword", "fg": G},
        "wom": {"icon": "chart-line", "fg": G},
        "temple": {"icon": "flame", "fg": G},
        "worlds": {"icon": "server", "fg": WHITE},
        "news": {"icon": "news", "fg": G},
    }
    imgs = merged(spec)

    home = {
        "0,0": c.hotkey_action("Bag\nEsc", "inv", "ESC"),
        "1,0": c.hotkey_action("Combat\nF1", "combat", "F1"),
        "2,0": c.hotkey_action("Skills\nF2", "skills", "F2"),
        "3,0": c.hotkey_action("Quests\nF3", "quests", "F3"),
        "4,0": c.hotkey_action("Gear\nF4", "equip", "F4"),
        "5,0": c.hotkey_action("Prayer\nF5", "prayer", "F5"),
        "6,0": c.hotkey_action("Magic\nF6", "magic", "F6"),
        "7,0": c.hotkey_action("Clan\nF7", "clan", "F7"),
        "0,1": c.hotkey_action("Friends\nF8", "friends", "F8"),
        "1,1": c.hotkey_action("Account\nF9", "account", "F9"),
        "2,1": c.hotkey_action("Options\nF10", "options", "F10"),
        "3,1": c.hotkey_action("Emotes\nF11", "emotes", "F11"),
        "4,1": c.hotkey_action("Music\nF12", "music", "F12"),
        # Row 3: the reference layer (was the Guide folder on the desk-deck version).
        "0,3": c.website_action("Wiki", "wiki", "https://oldschool.runescape.wiki"),
        "1,3": c.website_action("World\nMap", "map", "https://explv.github.io"),
        "2,3": c.website_action("GE\nPrices", "prices", "https://prices.runescape.wiki"),
        "3,3": c.website_action("Hi\nscores", "hiscores",
                                "https://secure.runescape.com/m=hiscore_oldschool/overall"),
        "4,3": c.website_action("Quests", "questslist",
                                "https://oldschool.runescape.wiki/w/Quests/List"),
        "5,3": c.website_action("DPS\nCalc", "dps", "https://dps.osrs.wiki"),
        "6,3": c.website_action("Wise\nOld Man", "wom", "https://wiseoldman.net"),
        "7,3": c.website_action("Temple\nOSRS", "temple", "https://templeosrs.com"),
        "0,4": c.website_action("Worlds", "worlds", "https://oldschool.runescape.com/slu"),
        "1,4": c.website_action("News", "news",
                                "https://secure.runescape.com/m=news/list?oldschool=1"),
    }
    out = ROOT / "osrs-vsd"
    plugins = ["com.elgato.streamdeck.system.hotkey",
               "com.elgato.streamdeck.system.website"]
    # OSRS ships Mac on the desk-deck version, so it ships here too.
    _variants(out, "Old School RuneScape", seed, {"home": ("Old School", home)},
              "home", imgs, plugins, c.VSD, "VSD", mac=True)


# ------------------------------------------------------------------ 13. Forza
def build_forza():
    """Covers Forza Horizon 6 AND Horizon 5 from one profile: their PC keyboard
    schemes are the same for everything on these keys, verified against both.
    That shared coverage is the differentiator, since the three competing
    listings that appeared in mid-2026 are single-game Horizon profiles.

    Driving inputs (accelerate, brake, steer, gears, clutch, handbrake) are
    deliberately absent. They are held or twitch inputs and the player's hands are
    on a wheel or WASD; a deck key cannot serve them. What ships is the surrounding
    layer -- camera, photo, telemetry, radio, map -- which is the part that
    actually costs a driver a hand today."""
    seed = "packrat-forza"
    M = FORZA_MAGENTA
    spec = {
        "photo": {"icon": "camera", "fg": M},
        "cam": {"icon": "video", "fg": M},
        "map": {"icon": "map-2", "fg": M},
        "telemetry": {"icon": "gauge", "fg": M},
        "rewind": {"icon": "history", "fg": M},
        "horn": {"icon": "bell", "fg": WHITE},
        "radioprev": {"icon": "player-track-prev", "fg": WHITE},
        "radionext": {"icon": "player-track-next", "fg": WHITE},
        "anna": {"icon": "message-circle", "fg": M},
        "link": {"icon": "link", "fg": M},
        "convert": {"icon": "car", "fg": M},
        "leaders": {"icon": "trophy", "fg": M},
        "activate": {"icon": "hand-click", "fg": WHITE},
        "links": {"icon": "world", "fg": M, "nav": True},
        "official": {"icon": "world", "fg": WHITE},
        "tune": {"icon": "adjustments", "fg": M},
        "wiki": {"icon": "book", "fg": M},
        "support": {"icon": "news", "fg": M},
    }
    imgs = merged(spec)
    links_uuid = c.page_uuid_for(seed, "links")

    links = {
        "0,0": back_btn(),
        "1,0": c.website_action("Forza\nnet", "official", "https://forza.net"),
        "2,0": c.website_action("Tunes", "tune", "https://forzatune.com"),
        "3,0": c.website_action("Car\nWiki", "wiki", "https://forza.fandom.com"),
        "4,0": c.website_action("Support", "support", "https://support.forza.net"),
    }
    home = {
        "0,0": c.hotkey_action("Photo\nP", "photo", "P"),
        "1,0": c.hotkey_action("Camera\nTab", "cam", "TAB"),
        "2,0": c.hotkey_action("Map\nM", "map", "M"),
        "3,0": c.hotkey_action("Teleme\ntry T", "telemetry", "T"),
        "4,0": c.hotkey_action("Rewind\nR", "rewind", "R"),
        "0,1": c.hotkey_action("Horn\nH", "horn", "H"),
        "1,1": c.hotkey_action("Radio\nBack", "radioprev", "MINUS"),
        "2,1": c.hotkey_action("Radio\nNext", "radionext", "EQUALS"),
        "3,1": c.hotkey_action("Anna\nC", "anna", "C"),
        "4,1": c.hotkey_action("Forza\nLINK V", "link", "V"),
        "0,2": c.hotkey_action("Convert\nible G", "convert", "G"),
        "1,2": c.hotkey_action("Leaders\nL", "leaders", "L"),
        "2,2": c.hotkey_action("Activate", "activate", "ENTER"),
        "3,2": c.folder_action("Links", "links", links_uuid),
    }
    # XL (8x4): both pages flat, no folder. 17 keys of 32.
    xl_home = {
        "0,0": home["0,0"], "1,0": home["1,0"], "2,0": home["2,0"], "3,0": home["3,0"],
        "4,0": home["4,0"], "5,0": home["0,1"], "6,0": home["1,1"], "7,0": home["2,1"],
        "0,1": home["3,1"], "1,1": home["4,1"], "2,1": home["0,2"], "3,1": home["1,2"],
        "4,1": home["2,2"],
        "0,2": links["1,0"], "1,2": links["2,0"], "2,2": links["3,0"], "3,2": links["4,0"],
    }
    out = ROOT / "forza"
    plugins = ["com.elgato.streamdeck.system.hotkey",
               "com.elgato.streamdeck.system.website"]
    # No Mac client (VALIDATION.md).
    emit(out, "Forza", seed,
         {"home": ("Forza", home), "links": ("Links", links)},
         "home", imgs, plugins, mac=False,
         xl_pages={"home": ("Forza", xl_home)}, xl_mac=False)
    c.write_url_file(out)
    c.export_icons(out, imgs)


# ------------------------------------------------------------- 14. SOLIDWORKS
def build_solidworks():
    """CAD shortcut profile, third of the shape after DaVinci and Vectorworks.
    Windows only (SOLIDWORKS has no macOS build), so 2 SKUs not 4.

    Every key is a documented SOLIDWORKS default. The audience customizes
    shortcuts more than most (VALIDATION.md flags this), so the README leads with
    how to rebind a single key, and the layout leans on the commands least likely
    to have been remapped: the Ctrl+1-8 view cube, the selection filters, and the
    S shortcut bar."""
    seed = "packrat-solidworks"
    R = SW_RED
    spec = {
        "sbar": {"icon": "keyboard", "fg": R},
        "search": {"icon": "search", "fg": R},
        "zoomfit": {"icon": "zoom-scan", "fg": R},
        "zoomin": {"icon": "zoom-in", "fg": WHITE},
        "zoomout": {"icon": "zoom-out", "fg": WHITE},
        "iso": {"icon": "cube", "fg": R},
        "normalto": {"icon": "square-arrow-up", "fg": R},
        "vfront": {"icon": "square", "fg": R},
        "vback": {"icon": "square-dot", "fg": R},
        "vleft": {"icon": "layout-sidebar", "fg": R},
        "vright": {"icon": "layout-sidebar-right", "fg": R},
        "vtop": {"icon": "arrow-up", "fg": R},
        "vbottom": {"icon": "arrow-bar-to-down", "fg": R},
        "orient": {"icon": "view-360", "fg": R},
        "tree": {"icon": "list-tree", "fg": R},
        "viewspg": {"icon": "perspective", "fg": R, "nav": True},
        "toolspg": {"icon": "filter", "fg": R, "nav": True},
        "rebuild": {"icon": "refresh", "fg": R},
        "save": {"icon": "device-floppy", "fg": WHITE},
        "undo": {"icon": "arrow-back", "fg": WHITE},
        "ffaces": {"icon": "square", "fg": (110, 200, 255)},
        "fedges": {"icon": "line-dashed", "fg": (110, 200, 255)},
        "fverts": {"icon": "point", "fg": (110, 200, 255)},
        "ftoggle": {"icon": "filter", "fg": WHITE},
        "fbar": {"icon": "layout-grid", "fg": WHITE},
        "line": {"icon": "pencil", "fg": R},
        "regen": {"icon": "rotate-3d", "fg": R},
        "repeat": {"icon": "arrow-forward-up", "fg": WHITE},
        "recent": {"icon": "book", "fg": R},
        "hidecomp": {"icon": "eye-off", "fg": WHITE},
        "showcomp": {"icon": "eye", "fg": WHITE},
        "dpane": {"icon": "window", "fg": R},
    }
    imgs = merged(spec)
    views_uuid = c.page_uuid_for(seed, "views")
    tools_uuid = c.page_uuid_for(seed, "tools")

    views = {
        "0,0": back_btn(),
        "1,0": c.hotkey_action("Front", "vfront", "1", ctrl=True),
        "2,0": c.hotkey_action("Back", "vback", "2", ctrl=True),
        "3,0": c.hotkey_action("Left", "vleft", "3", ctrl=True),
        "4,0": c.hotkey_action("Right", "vright", "4", ctrl=True),
        "0,1": c.hotkey_action("Top", "vtop", "5", ctrl=True),
        "1,1": c.hotkey_action("Bottom", "vbottom", "6", ctrl=True),
        "2,1": c.hotkey_action("Iso\nmetric", "iso", "7", ctrl=True),
        "3,1": c.hotkey_action("Normal\nTo", "normalto", "8", ctrl=True),
        "4,1": c.hotkey_action("Orient\nBar", "orient", "SPACE"),
        "0,2": c.hotkey_action("Tree\nC", "tree", "C"),
    }
    tools = {
        "0,0": back_btn(),
        "1,0": c.hotkey_action("Faces\nX", "ffaces", "X"),
        "2,0": c.hotkey_action("Edges\nE", "fedges", "E"),
        "3,0": c.hotkey_action("Verts\nV", "fverts", "V"),
        "4,0": c.hotkey_action("Filters\nF6", "ftoggle", "F6"),
        "0,1": c.hotkey_action("Filter\nBar F5", "fbar", "F5"),
        "1,1": c.hotkey_action("Line\nL", "line", "L"),
        "2,1": c.hotkey_action("Force\nRegen", "regen", "Q", ctrl=True),
        "3,1": c.hotkey_action("Repeat", "repeat", "ENTER"),
        "4,1": c.hotkey_action("Recent\nR", "recent", "R"),
        "0,2": c.hotkey_action("Hide\nComp", "hidecomp", "TAB"),
        "1,2": c.hotkey_action("Show\nComp", "showcomp", "TAB", shift=True),
        "2,2": c.hotkey_action("Display\nPane F8", "dpane", "F8"),
    }
    home = {
        "0,0": c.hotkey_action("Shortcut\nBar S", "sbar", "S"),
        "1,0": c.hotkey_action("Search\nW", "search", "W"),
        "2,0": c.hotkey_action("Zoom\nFit F", "zoomfit", "F"),
        "3,0": c.hotkey_action("Zoom In", "zoomin", "Z", shift=True),
        "4,0": c.hotkey_action("Zoom\nOut Z", "zoomout", "Z"),
        "0,1": c.hotkey_action("Iso\nmetric", "iso", "7", ctrl=True),
        "1,1": c.hotkey_action("Normal\nTo", "normalto", "8", ctrl=True),
        "2,1": c.hotkey_action("Front", "vfront", "1", ctrl=True),
        "3,1": c.hotkey_action("Top", "vtop", "5", ctrl=True),
        "4,1": c.hotkey_action("Right", "vright", "4", ctrl=True),
        "0,2": c.folder_action("Views", "viewspg", views_uuid),
        "1,2": c.folder_action("Select", "toolspg", tools_uuid),
        "2,2": c.hotkey_action("Rebuild", "rebuild", "B", ctrl=True),
        "3,2": c.hotkey_action("Save", "save", "S", ctrl=True),
        "4,2": c.hotkey_action("Undo", "undo", "Z", ctrl=True),
    }
    # XL (8x4): home and Views fold flat; Select & Tools stays a folder because
    # 35 content keys overflow 32.
    xl_tools_uuid = c.page_uuid_for(f"{seed}-xl", "tools")
    xl_home = {
        "0,0": home["0,0"], "1,0": home["1,0"], "2,0": home["2,0"], "3,0": home["3,0"],
        "4,0": home["4,0"], "5,0": home["2,2"], "6,0": home["3,2"], "7,0": home["4,2"],
        "0,1": views["1,0"], "1,1": views["2,0"], "2,1": views["3,0"], "3,1": views["4,0"],
        "4,1": views["0,1"], "5,1": views["1,1"], "6,1": views["2,1"], "7,1": views["3,1"],
        "0,2": views["4,1"], "1,2": views["0,2"],
        "6,3": c.folder_action("Select", "toolspg", xl_tools_uuid),
    }
    out = ROOT / "solidworks"
    plugins = ["com.elgato.streamdeck.system.hotkey"]
    # No macOS build of SOLIDWORKS exists, so Windows only (VALIDATION.md).
    emit(out, "SOLIDWORKS", seed,
         {"home": ("SOLIDWORKS", home), "views": ("Views", views),
          "tools": ("Select & Tools", tools)},
         "home", imgs, plugins, mac=False,
         xl_pages={"home": ("SOLIDWORKS", xl_home), "tools": ("Select & Tools", tools)},
         xl_mac=False)
    c.write_url_file(out)
    c.export_icons(out, imgs)


# --------------------------------------------------------- 15. Minecraft (VSD)
MC_GREEN = (95, 180, 95)

def build_minecraft_vsd():
    """New product, Virtual Stream Deck only. Java Edition default keybinds
    (minecraft.wiki/w/Controls) plus a reference layer, same "utility companion"
    shape as OSRS -- scoped deliberately away from combat/PvP framing per house
    research: singleplayer/small-server anti-cheat targets movement/combat
    statistics, not raw keypresses, but large servers like Hypixel ban "anything
    which automates any player gameplay action" and a Stream Deck marketed as a
    combat aid invites exactly that scrutiny a building/utility one does not.

    F3+G (chunk borders) is deliberately NOT included: it is a hold-F3-then-tap-G
    combo, and common.py's hotkey_action() only encodes Ctrl/Shift/Alt/Win + one
    key, so it cannot be built as a single action without misrepresenting it as
    something else. Every key here is one tap of one real default binding, except
    Auto Run and Auto Swing, which are held-key/held-mouse TOGGLES via Better
    Hotkeys -- the identical pattern Palworld's Auto Sprint/Auto Hit already use in
    this catalog. A toggle is not a macro (no chained actions, no automation of a
    sequence); it holds one real input down until pressed again, same as holding
    the key yourself. Minecraft carries no aggressive client-side anti-cheat like
    Vanguard/VAC to react badly to that (see registry.json notes).

    UNVERIFIED-ON-HARDWARE like every VSD product -- see common.VSD's model
    confirmation note."""
    seed = "packrat-minecraft-vsd"
    G = MC_GREEN
    spec = {
        "inv": {"icon": "backpack", "fg": G},
        "drop": {"icon": "hand-off", "fg": WHITE},
        "offhand": {"icon": "transfer", "fg": WHITE},
        "chat": {"icon": "message", "fg": WHITE},
        "command": {"icon": "terminal-2", "fg": G},
        "autorun": {"icon": "run", "fg": WHITE},
        "autorun-on": {"icon": "run", "fg": G, "dot": GREEN_DOT},
        "autoswing": {"icon": "sword", "fg": WHITE},
        "autoswing-on": {"icon": "sword", "fg": G, "dot": GREEN_DOT},
        "pickblock": {"icon": "color-picker", "fg": G},
        **{f"h{n}": {"icon": f"number-{n}", "fg": WHITE} for n in range(1, 10)},
        "gui": {"icon": "eye-off", "fg": WHITE},
        "screenshot": {"icon": "camera", "fg": G},
        "debug": {"icon": "bug", "fg": G},
        "perspective": {"icon": "camera-rotate", "fg": G},
        "fullscreen": {"icon": "maximize", "fg": WHITE},
        "advance": {"icon": "trophy", "fg": G},
        "wiki": {"icon": "book", "fg": WHITE},
        "crafting": {"icon": "hammer", "fg": G},
        "debugguide": {"icon": "info-circle", "fg": G},
        "advancelist": {"icon": "trophy", "fg": G},
        "official": {"icon": "world", "fg": WHITE},
    }
    imgs = merged(spec)

    home = {
        "0,0": c.hotkey_action("Inv\nE", "inv", "E"),
        "1,0": c.hotkey_action("Drop\nQ", "drop", "Q"),
        "2,0": c.hotkey_action("Offhand\nF", "offhand", "F"),
        "3,0": c.hotkey_action("Chat\nT", "chat", "T"),
        "4,0": c.hotkey_action("Command", "command", "SLASH"),
        "5,0": c.bh_toggle_key("Auto\nRun", "autorun", ["CTRL"]),
        "6,0": c.bh_toggle_mouse("Auto\nSwing", "autoswing", "left"),
        "7,0": c.bh_click_mouse("Pick\nBlock", "pickblock", "middle"),
        "0,1": c.hotkey_action("Toggle\nGUI F1", "gui", "F1"),
        "1,1": c.hotkey_action("Screen\nshot F2", "screenshot", "F2"),
        "2,1": c.hotkey_action("Debug\nF3", "debug", "F3"),
        "3,1": c.hotkey_action("Persp\nF5", "perspective", "F5"),
        "4,1": c.hotkey_action("Full\nScrn F11", "fullscreen", "F11"),
        "5,1": c.hotkey_action("Advance\nments L", "advance", "L"),
    }
    for n in range(1, 10):
        col, row = (n - 1) % 8, 3 + (n - 1) // 8
        home[f"{col},{row}"] = c.hotkey_action(f"Hotbar\n{n}", f"h{n}", str(n))
    home.update({
        "0,6": c.website_action("Wiki", "wiki", "https://minecraft.wiki"),
        "1,6": c.website_action("Crafting", "crafting", "https://minecraft.wiki/w/Crafting"),
        "2,6": c.website_action("Debug\nGuide", "debugguide", "https://minecraft.wiki/w/Debug_screen"),
        "3,6": c.website_action("Advance\nList", "advancelist", "https://minecraft.wiki/w/Advancement"),
        "4,6": c.website_action("Minecraft\n.net", "official", "https://www.minecraft.net"),
    })
    out = ROOT / "minecraft"
    plugins = ["com.elgato.streamdeck.system.hotkey",
               "com.elgato.streamdeck.system.website", c.BH_PLUGIN]
    # Java Edition is cross-platform (Win/Mac/Linux); ship Mac like OSRS.
    _variants(out, "Minecraft", seed, {"home": ("Minecraft", home)}, "home",
              imgs, plugins, c.VSD, "VSD", mac=True)


# -------------------------------------------------------------- 16. CS2 (VSD)
CS2_ORANGE = (255, 140, 40)

def build_cs2_vsd():
    """New product, Virtual Stream Deck only. Cross-sells into the buyer base that
    already pays for the cs2_live_stats plugin -- Packrat's #5 revenue product.

    Single-tap remaps of CS2's own default keybinds are NOT VAC-bannable (Valve's
    Aug 2024 policy targets input *automation* -- chained/scripted actions -- not
    a Stream Deck sending one default key per press; community consensus on this
    is unambiguous). Scoped to keys confirmed from multiple independent sources
    only: buy menu, scoreboard, chat, reload, drop, inspect, and the five weapon
    slots. The CS:GO-era radio-menu binds (Z/X/C) were deliberately CUT -- sources
    disagreed on whether they're still bound by default in CS2, and shipping a
    wrong keybind is worse than shipping a smaller, correct set. No movement/aim
    keys (jump, crouch, walk) -- those are held/twitch inputs the player's hand is
    already on, same reasoning as every FPS profile in this catalog.

    UNVERIFIED-ON-HARDWARE like every VSD product -- see common.VSD's model
    confirmation note. CS2 has no macOS client, so Windows only."""
    seed = "packrat-cs2-vsd"
    O = CS2_ORANGE
    spec = {
        "buy": {"icon": "shopping-bag", "fg": O},
        "scoreboard": {"icon": "clipboard-list", "fg": WHITE},
        "allchat": {"icon": "message", "fg": WHITE},
        "teamchat": {"icon": "messages", "fg": O},
        "reload": {"icon": "refresh", "fg": WHITE},
        "drop": {"icon": "hand-off", "fg": WHITE},
        "inspect": {"icon": "eye", "fg": WHITE},
        **{f"slot{n}": {"icon": f"number-{n}", "fg": WHITE} for n in range(1, 6)},
        "leetify": {"icon": "chart-bar", "fg": O},
        "hltv": {"icon": "news", "fg": WHITE},
        "prosettings": {"icon": "settings", "fg": O},
    }
    imgs = merged(spec)

    home = {
        "0,0": c.hotkey_action("Buy\nB", "buy", "B"),
        "1,0": c.hotkey_action("Score\nTab", "scoreboard", "TAB"),
        "2,0": c.hotkey_action("All Chat\nY", "allchat", "Y"),
        "3,0": c.hotkey_action("Team\nChat U", "teamchat", "U"),
        "4,0": c.hotkey_action("Reload\nR", "reload", "R"),
        "5,0": c.hotkey_action("Drop\nG", "drop", "G"),
        "6,0": c.hotkey_action("Inspect\nF", "inspect", "F"),
        "0,1": c.hotkey_action("Primary\n1", "slot1", "1"),
        "1,1": c.hotkey_action("Second\nary 2", "slot2", "2"),
        "2,1": c.hotkey_action("Knife\n3", "slot3", "3"),
        "3,1": c.hotkey_action("Grenade\n4", "slot4", "4"),
        "4,1": c.hotkey_action("Bomb\n5", "slot5", "5"),
        "0,3": c.website_action("Leetify", "leetify", "https://leetify.com"),
        "1,3": c.website_action("HLTV", "hltv", "https://www.hltv.org"),
        "2,3": c.website_action("Pro\nSettings", "prosettings", "https://prosettings.net"),
    }
    out = ROOT / "cs2"
    plugins = ["com.elgato.streamdeck.system.hotkey",
               "com.elgato.streamdeck.system.website"]
    _variants(out, "CS2", seed, {"home": ("CS2", home)}, "home",
              imgs, plugins, c.VSD, "VSD", mac=False)


# ------------------------------------------------- 17. League of Legends (VSD)
LOL_BLUE = (30, 190, 230)

def build_lol_vsd():
    """New product, Virtual Stream Deck only. Cross-sells into the buyer base that
    already pays for the lol_live_stats plugin.

    Riot's Vanguard kernel-level anti-cheat is mandatory for LoL (since May 2024,
    same system Valorant runs). No official Riot statement addresses third-party
    keybind hardware directly, and one community report suggests Vanguard can be
    more sensitive to third-party input-injection than CS2's VAC is. Built to the
    IDENTICAL discipline as the already-shipping, incident-free Valorant profile:
    every key is a single tap of one of LoL's own default binds, nothing
    Valorant's profile doesn't already do. Do not add anything fancier."""
    seed = "packrat-lol-vsd"
    B = LOL_BLUE
    spec = {
        "shop": {"icon": "shopping-bag", "fg": B},
        "recall": {"icon": "home", "fg": B},
        "abq": {"icon": "letter-q", "fg": WHITE},
        "abw": {"icon": "letter-w", "fg": WHITE},
        "abe": {"icon": "letter-e", "fg": WHITE},
        "abr": {"icon": "letter-r", "fg": B},
        "sumd": {"icon": "letter-d", "fg": WHITE},
        "sumf": {"icon": "letter-f", "fg": WHITE},
        **{f"item{n}": {"icon": f"number-{n}", "fg": WHITE} for n in range(1, 7)},
        "scq": {"icon": "letter-q", "fg": B},
        "scw": {"icon": "letter-w", "fg": B},
        "sce": {"icon": "letter-e", "fg": B},
        "selfq": {"icon": "letter-q", "fg": (255, 200, 80)},
        "selfw": {"icon": "letter-w", "fg": (255, 200, 80)},
        "camlock": {"icon": "focus-2", "fg": B},
        "opgg": {"icon": "chart-bar", "fg": B},
        "ugg": {"icon": "chart-bar", "fg": WHITE},
    }
    imgs = merged(spec)

    home = {
        "0,0": c.hotkey_action("Shop\nP", "shop", "P"),
        "1,0": c.hotkey_action("Recall\nB", "recall", "B"),
        "2,0": c.hotkey_action("Q", "abq", "Q"),
        "3,0": c.hotkey_action("W", "abw", "W"),
        "4,0": c.hotkey_action("E", "abe", "E"),
        "5,0": c.hotkey_action("R", "abr", "R"),
        "0,1": c.hotkey_action("Summ\nD", "sumd", "D"),
        "1,1": c.hotkey_action("Summ\nF", "sumf", "F"),
        "2,1": c.hotkey_action("Item 1", "item1", "1"),
        "3,1": c.hotkey_action("Item 2", "item2", "2"),
        "4,1": c.hotkey_action("Item 3", "item3", "3"),
        "5,1": c.hotkey_action("Trinket\n4", "item4", "4"),
        "6,1": c.hotkey_action("Item 5", "item5", "5"),
        "7,1": c.hotkey_action("Item 6", "item6", "6"),
        "0,3": c.hotkey_action("Smart\nQ", "scq", "Q", shift=True),
        "1,3": c.hotkey_action("Smart\nW", "scw", "W", shift=True),
        "2,3": c.hotkey_action("Smart\nE", "sce", "E", shift=True),
        "3,3": c.hotkey_action("Self\nQ", "selfq", "Q", alt=True),
        "4,3": c.hotkey_action("Self\nW", "selfw", "W", alt=True),
        "5,3": c.hotkey_action("Cam\nLock Y", "camlock", "Y"),
        "0,6": c.website_action("OP.GG", "opgg", "https://op.gg"),
        "1,6": c.website_action("U.GG", "ugg", "https://u.gg"),
    }
    out = ROOT / "league-of-legends"
    plugins = ["com.elgato.streamdeck.system.hotkey",
               "com.elgato.streamdeck.system.website"]
    # League Client is Windows/Mac native, so both ship.
    _variants(out, "League of Legends", seed, {"home": ("League", home)}, "home",
              imgs, plugins, c.VSD, "VSD", mac=True)


# -------------------------------------------------------------- 18. Dota 2 (VSD)
DOTA_RED = (196, 30, 30)

def build_dota2_vsd():
    """New product, Virtual Stream Deck only. Cross-sells into the buyer base that
    already pays for the dota_2_live_stats plugin.

    Valve's own developer forum explicitly distinguishes hotkey REMAPPING
    (permitted) from macros/scripts that automate ability combos (not permitted,
    also banned in tournament play) -- the safest anti-cheat posture of any game
    in this batch. Scoped deliberately narrow: sources conflicted on shop/
    courier/camera-toggle keys during research, so only the keys confirmed
    stable since the original WC3 DotA mod are included (abilities, attack-move,
    stop, hold, center camera). Better a thin, correct panel than a fuller one
    with a guessed keybind in it.

    UNVERIFIED-ON-HARDWARE like every VSD product -- see common.VSD's model
    confirmation note."""
    seed = "packrat-dota2-vsd"
    R = DOTA_RED
    spec = {
        "abq": {"icon": "letter-q", "fg": WHITE},
        "abw": {"icon": "letter-w", "fg": WHITE},
        "abe": {"icon": "letter-e", "fg": WHITE},
        "abr": {"icon": "letter-r", "fg": R},
        "attackmove": {"icon": "swords", "fg": R},
        "stop": {"icon": "player-stop", "fg": WHITE},
        "hold": {"icon": "shield-half", "fg": R},
        "centercam": {"icon": "focus-2", "fg": R},
        "dotabuff": {"icon": "chart-bar", "fg": R},
        "opendota": {"icon": "chart-bar", "fg": WHITE},
        "official": {"icon": "world", "fg": WHITE},
    }
    imgs = merged(spec)

    home = {
        "0,0": c.hotkey_action("Q", "abq", "Q"),
        "1,0": c.hotkey_action("W", "abw", "W"),
        "2,0": c.hotkey_action("E", "abe", "E"),
        "3,0": c.hotkey_action("R", "abr", "R"),
        "0,1": c.hotkey_action("Attack\nMove A", "attackmove", "A"),
        "1,1": c.hotkey_action("Stop\nS", "stop", "S"),
        "2,1": c.hotkey_action("Hold\nH", "hold", "H"),
        "3,1": c.hotkey_action("Center\nCam", "centercam", "SPACE"),
        "0,3": c.website_action("Dotabuff", "dotabuff", "https://www.dotabuff.com"),
        "1,3": c.website_action("Open\nDota", "opendota", "https://www.opendota.com"),
        "2,3": c.website_action("Dota2\n.com", "official", "https://www.dota2.com"),
    }
    out = ROOT / "dota2"
    plugins = ["com.elgato.streamdeck.system.hotkey",
               "com.elgato.streamdeck.system.website"]
    # Dota 2 is Windows/Mac/Linux native; ship Mac.
    _variants(out, "Dota 2", seed, {"home": ("Dota 2", home)}, "home",
              imgs, plugins, c.VSD, "VSD", mac=True)


# ------------------------------------------------------------- 19. FL Studio (VSD)
FL_ORANGE = (255, 130, 30)

def build_flstudio_vsd():
    """New product, Virtual Stream Deck only. Competitor check (2026-08-06) found
    FL Studio's Elgato Marketplace competition thin and unproven (one profile
    posted for feedback on the Image-Line forum with zero visible replies) --
    unlike Ableton (crowded, plus a first-party Loupedeck integration) and
    Blender (an entrenched, mode-aware incumbent called DeckMania). FL Studio's
    window-toggle-heavy workflow (constant switching between Playlist/Piano Roll/
    Mixer/Channel Rack) fits VSD's panel-near-cursor value prop better than either.

    Every key is a confirmed default from Image-Line's own manual. UNVERIFIED-ON-
    HARDWARE like every VSD product -- see common.VSD's model confirmation note."""
    seed = "packrat-flstudio-vsd"
    O = FL_ORANGE
    spec = {
        "play": {"icon": "player-play", "fg": (110, 230, 140)},
        "playlist": {"icon": "playlist", "fg": O},
        "stepseq": {"icon": "grid-dots", "fg": O},
        "pianoroll": {"icon": "piano", "fg": O},
        "browser": {"icon": "folder", "fg": O},
        "samplebrowser": {"icon": "music", "fg": O},
        "mixer": {"icon": "adjustments", "fg": O},
        "midisettings": {"icon": "settings", "fg": WHITE},
        "arrangewin": {"icon": "layout-grid", "fg": WHITE},
        "manual": {"icon": "book", "fg": WHITE},
        "official": {"icon": "world", "fg": O},
        "forum": {"icon": "messages", "fg": WHITE},
    }
    imgs = merged(spec)

    home = {
        "0,0": c.hotkey_action("Play\nSpace", "play", "SPACE"),
        "1,0": c.hotkey_action("Playlist\nF5", "playlist", "F5"),
        "2,0": c.hotkey_action("Step\nSeq F6", "stepseq", "F6"),
        "3,0": c.hotkey_action("Piano\nRoll F7", "pianoroll", "F7"),
        "4,0": c.hotkey_action("Browser\nF8", "browser", "F8"),
        "5,0": c.hotkey_action("Samples", "samplebrowser", "F8", alt=True),
        "6,0": c.hotkey_action("Mixer\nF9", "mixer", "F9"),
        "7,0": c.hotkey_action("MIDI\nF10", "midisettings", "F10"),
        "0,1": c.hotkey_action("Arrange\nWins", "arrangewin", "H", ctrl=True, shift=True),
        "0,3": c.website_action("Manual", "manual", "https://www.image-line.com/fl-studio-learning/fl-studio-online-manual"),
        "1,3": c.website_action("Image\nLine", "official", "https://www.image-line.com"),
        "2,3": c.website_action("Forum", "forum", "https://forum.image-line.com"),
    }
    out = ROOT / "fl-studio"
    plugins = ["com.elgato.streamdeck.system.hotkey",
               "com.elgato.streamdeck.system.website"]
    # FL Studio ships native on both Windows and Mac.
    _variants(out, "FL Studio", seed, {"home": ("FL Studio", home)}, "home",
              imgs, plugins, c.VSD, "VSD", mac=True)


# ------------------------------------------------------------------ Epic Pen
# Epic Pen publishes NO default hotkey list anywhere: not in the user guide, not
# in the FAQ, not in the version history. Every binding below was read from a
# live install's %APPDATA%\Epic Pen\settings.json (v3.12.172), where a hotkey is
# stored as {"Item1": <win vkey>, "Item2": [<modifiers>], "Item3": <enabled>}
# with 131072=Ctrl, 65536=Shift, 262144=Alt. Epic Pen registers them as GLOBAL
# Windows hotkeys, so a Stream Deck press reaches it whatever holds focus.
#
# There is deliberately NO Redo key. Epic Pen has no redo hotkey and no
# RedoHotkey setting at all, so shipping one would be inventing a feature.
EP_CYAN = (0, 173, 239)   # Epic Pen's own default quick-colour slot 1
EP_RED = (231, 76, 60)    # its default slot 6, reused to mark Clear as destructive

# The six mini-palette slots in factory order: (label, rgb, title colour).
# These hotkeys select a SLOT, not a colour. A buyer who recoloured their palette
# gets their own colour from the same key, which is why INSTALL.md documents the
# factory palette rather than the profile pretending to set it.
EP_QUICK = [
    ("Cyan", (0, 173, 239), "#111111"),
    ("Yellow", (254, 242, 0), "#111111"),
    ("Pink", (255, 11, 136), "#ffffff"),
    ("Black", (0, 0, 0), "#ffffff"),
    ("Green", (31, 212, 48), "#111111"),
    ("Red", (231, 76, 60), "#ffffff"),
]


def _ep_spec(pro: bool) -> dict:
    """Icon spec. Colour keys take a FULL-FACE colour rather than a tinted glyph:
    slot 4 is black, which would be invisible tinted onto a dark key."""
    spec = {
        "epdraw": {"icon": "writing", "fg": WHITE},
        "epdraw-on": {"icon": "writing", "fg": EP_CYAN, "dot": GREEN_DOT},
        "eppen": {"icon": "pencil", "fg": EP_CYAN},
        "ephigh": {"icon": "highlight", "fg": EP_CYAN},
        "eperase": {"icon": "eraser", "fg": EP_CYAN},
        "epclear": {"icon": "trash", "fg": EP_RED},
        "epcursor": {"icon": "pointer", "fg": WHITE},
        "epundo": {"icon": "arrow-back-up", "fg": WHITE},
        "epsizedn": {"icon": "circle-minus", "fg": WHITE},
        "epsizeup": {"icon": "circle-plus", "fg": WHITE},
        "epsizedial": {"icon": "brush", "fg": EP_CYAN},
        "epshot": {"icon": "camera", "fg": WHITE},
        "eptool": {"icon": "layout-navbar", "fg": WHITE},
        "eptool-on": {"icon": "layout-navbar", "fg": EP_CYAN, "dot": GREEN_DOT},
        "eplast": {"icon": "color-picker", "fg": EP_CYAN},
        "epcolpg": {"icon": "palette", "fg": EP_CYAN, "nav": True},
    }
    for i, (_label, rgb, _tc) in enumerate(EP_QUICK, start=1):
        light = sum(rgb) > 330  # dark glyph on pale faces, white on the rest
        spec[f"epcol{i}"] = {"icon": "pencil", "bg": rgb, "fg": DARK if light else WHITE}
    if pro:
        spec.update({
            "epline": {"icon": "line", "fg": EP_CYAN},
            "eparrow": {"icon": "arrow-narrow-right", "fg": EP_CYAN},
            "eprect": {"icon": "square", "fg": EP_CYAN},
            "epellip": {"icon": "oval", "fg": EP_CYAN},
            "eptext": {"icon": "letter-t", "fg": EP_CYAN},
            # The two board keys mirror what they actually do to the screen, so
            # they are never confused for each other at a glance.
            "epwhite": {"icon": "chalkboard", "bg": (238, 238, 238), "fg": DARK},
            "epblack": {"icon": "chalkboard", "bg": (0, 0, 0), "fg": WHITE},
            "epfade": {"icon": "ripple", "fg": EP_CYAN},
            "epshapepg": {"icon": "square-rounded", "fg": EP_CYAN, "nav": True},
            "epboardpg": {"icon": "presentation", "fg": EP_CYAN, "nav": True},
            "eplaunch": {"icon": "app-window", "fg": WHITE},
        })
    return spec


# Default install location, read off a real install rather than assumed: the
# binary is lowercase epicpen.exe, and Epic Pen is a 32-bit build so it lands in
# Program Files (x86) even on 64-bit Windows.
EP_EXE = r"C:\Program Files (x86)\Epic Pen\epicpen.exe"

# Every entry is a FACTORY, not an action. Several keys (Pen, Undo, Draw, Fading
# Ink, Toolbar, Screenshot) appear on two pages of the Pro profile, and reusing
# one action object would put the same ActionID on both.
EP_KEYS = {
    "draw": lambda: c.hotkey_switch_action("Draw", "epdraw", "epdraw-on", "1",
                                           ctrl=True, shift=True),
    "pen": lambda: c.hotkey_action("Pen", "eppen", "3", ctrl=True, shift=True),
    "high": lambda: c.hotkey_action("High\nlight", "ephigh", "4", ctrl=True, shift=True),
    "erase": lambda: c.hotkey_action("Eraser", "eperase", "5", ctrl=True, shift=True),
    "clear": lambda: c.hotkey_action("Clear", "epclear", "7", ctrl=True, shift=True),
    "cursor": lambda: c.hotkey_action("Cursor", "epcursor", "2", ctrl=True, shift=True),
    "undo": lambda: c.hotkey_action("Undo", "epundo", "6", ctrl=True, shift=True),
    "sizedn": lambda: c.hotkey_action("Size -", "epsizedn", "LBRACKET", ctrl=True, shift=True),
    "sizeup": lambda: c.hotkey_action("Size +", "epsizeup", "RBRACKET", ctrl=True, shift=True),
    "shot": lambda: c.hotkey_action("Screen\nshot", "epshot", "PRINTSCREEN", ctrl=True, shift=True),
    "tool": lambda: c.hotkey_switch_action("Toolbar", "eptool", "eptool-on", "0",
                                           ctrl=True, shift=True),
    "last": lambda: c.hotkey_action("Last\nColor", "eplast", "9", ctrl=True, shift=True),
    "colpg": lambda: c.folder_action("Colors", "epcolpg", ""),
    "back": lambda: back_btn(),
    # Pro only
    "line": lambda: c.hotkey_action("Line", "epline", "L", ctrl=True, shift=True),
    "arrow": lambda: c.hotkey_action("Arrow", "eparrow", "A", ctrl=True, shift=True),
    "rect": lambda: c.hotkey_action("Rect\nangle", "eprect", "R", ctrl=True, shift=True),
    "ellip": lambda: c.hotkey_action("Ellipse", "epellip", "E", ctrl=True, shift=True),
    "text": lambda: c.hotkey_action("Text", "eptext", "T", ctrl=True, shift=True),
    # Whiteboard, Blackboard and Fading Ink are plain hotkeys, NOT hotkey switches.
    # Epic Pen calls them toggles but they are Pro-gated and were never confirmed
    # turning back off, so the key face does not claim to show their state.
    "white": lambda: c.hotkey_action("White\nboard", "epwhite", "W", ctrl=True,
                                     shift=True, color="#111111"),
    "black": lambda: c.hotkey_action("Black\nboard", "epblack", "B", ctrl=True, shift=True),
    "fade": lambda: c.hotkey_action("Fade\nInk", "epfade", "F", ctrl=True, shift=True),
    "shapepg": lambda: c.folder_action("Shapes", "epshapepg", ""),
    "boardpg": lambda: c.folder_action("Boards", "epboardpg", ""),
    "launch": lambda: c.open_action("Launch", "eplaunch", EP_EXE),
}
for _i, (_label, _rgb, _tc) in enumerate(EP_QUICK, start=1):
    EP_KEYS[f"col{_i}"] = (lambda n=_i, lab=_label, tc=_tc:
                           c.hotkey_action(f"{n}\n{lab}", f"epcol{n}", str(n),
                                           alt=True, shift=True, color=tc))


def _ep_page(device, names, folders=None):
    """Fill `device`'s grid in reading order from `names`. Trailing slots stay
    empty, which is what keeps the MK.2 pages off a full 15."""
    acts = []
    for n in names:
        a = EP_KEYS[n]()
        if folders and n in folders:
            a["Settings"]["ProfileUUID"] = folders[n]
        acts.append(a)
    return dict(zip(c.positions(device), acts))


def _build_epic_pen(pro: bool):
    slug = "epic-pen-pro" if pro else "epic-pen"
    name = "Epic Pen Pro Profile" if pro else "Epic Pen Profile"
    seed = f"packrat-{slug}"
    imgs = merged(_ep_spec(pro))
    out = ROOT / slug
    plugins = ["com.elgato.streamdeck.system.hotkey"]
    if pro:
        plugins.append("com.elgato.streamdeck.system.open")

    colors = ["back", "col1", "col2", "col3", "col4", "col5", "col6", "last"]

    if pro:
        home = ["draw", "pen", "high", "erase", "clear",
                "cursor", "undo", "sizedn", "sizeup", "shot",
                "colpg", "shapepg", "boardpg", "fade"]
        shapes = ["back", "line", "arrow", "rect", "ellip", "text", "pen", "undo"]
        boards = ["back", "white", "black", "fade", "tool", "draw", "shot", "launch"]
        # One flat page on the big grids: no folder hop at all, which is the
        # reason an XL owner would take this over the MK.2 layout.
        flat = ["draw", "pen", "high", "erase", "clear", "cursor", "undo", "shot",
                "sizedn", "sizeup", "line", "arrow", "rect", "ellip", "text", "fade",
                "white", "black", "tool", "last", "col1", "col2", "col3", "col4",
                "col5", "col6", "launch"]
        # Seven, not eight: house rule 3 keeps a slot open so the page never
        # reads as a deck packed to its limit.
        plus = ["pen", "high", "erase", "clear", "draw", "undo", "arrow"]
    else:
        home = ["draw", "pen", "high", "erase", "clear",
                "cursor", "undo", "sizedn", "sizeup", "shot",
                "colpg", "last", "tool"]
        shapes = boards = None
        flat = ["draw", "pen", "high", "erase", "clear", "cursor", "undo", "shot",
                "sizedn", "sizeup", "tool", "last", "col1", "col2", "col3", "col4",
                "col5", "col6"]
        plus = ["pen", "high", "erase", "clear", "draw", "undo", "cursor"]

    # Stroke size is the ONLY continuous control Epic Pen exposes. It has no
    # next/previous-colour and no tool-cycle hotkey, so dials 2-4 are left
    # genuinely empty rather than filled with a rotation that does nothing.
    # Dial press is not bound either: rat-build.md records it as doing nothing
    # with the stock hotkey action, confirmed on hardware 2026-08-07.
    plus_dials = {"0,0": c.dial_action("Size", "epsizedial",
                                       ("LBRACKET", True, True), ("RBRACKET", True, True))}

    def pages_for(page_seed):
        fold = {"colpg": c.page_uuid_for(page_seed, "colors")}
        if pro:
            fold["shapepg"] = c.page_uuid_for(page_seed, "shapes")
            fold["boardpg"] = c.page_uuid_for(page_seed, "boards")
        built = {"home": ("Epic Pen", _ep_page(c.MK2, home, fold)),
                 "colors": ("Colors", _ep_page(c.MK2, colors))}
        if pro:
            built["shapes"] = ("Shapes", _ep_page(c.MK2, shapes, fold))
            built["boards"] = ("Boards", _ep_page(c.MK2, boards, fold))
        return built

    _variants(out, name, seed, pages_for(seed), "home", imgs, plugins,
              c.MK2, "", mac=False)
    _variants(out, name, f"{seed}-xl", {"home": ("Epic Pen", _ep_page(c.XL, flat))},
              "home", imgs, plugins, c.XL, "XL", mac=False)
    _variants(out, name, f"{seed}-plus",
              {"home": ("Epic Pen", _ep_page(c.PLUS, plus), plus_dials)},
              "home", imgs, plugins, c.PLUS, "Plus", mac=False)
    _variants(out, name, f"{seed}-vsd", {"home": ("Epic Pen", _ep_page(c.VSD, flat))},
              "home", imgs, plugins, c.VSD, "VSD", mac=False)
    c.write_url_file(out)
    c.export_icons(out, imgs)


def build_epic_pen():
    """FREE tier: the 18 Epic Pen actions that work on Epic Pen's own free tier,
    so the profile and the app are usable together at no cost. Funnel head for
    epic-pen-pro, same Lite/Pro shape as DaVinci Resolve.

    Windows only. Epic Pen has a Mac build with claimed parity, but its default
    modifier is unverified and mac_variant() would silently emit a wrong keycode
    on every button if Mac uses Ctrl rather than Cmd."""
    _build_epic_pen(pro=False)


def build_epic_pen_pro():
    """PAID tier: all 26 actions. The eight added here (shapes, text, boards,
    fading ink) require an Epic Pen Pro subscription in Epic Pen itself, which is
    exactly why the paywall sits where it does.

    Those eight are NOT hardware-verified: the build machine runs free-tier Epic
    Pen. See registry.json risk flag hardware-unverified:pro-tools-untested."""
    _build_epic_pen(pro=True)




# ------------------------------------------------- RatPack AI prompt profiles
# Ported 2026-08-21 from the standalone ratpack-profiles folder. Every key is an
# Elgato Text action in paste mode: one press puts the whole prompt on the
# clipboard and pastes it wherever the cursor is. No plugin, no API key, no UI
# automation, so the same profile works in ChatGPT, Claude, Gemini, Perplexity,
# Copilot or a local model, and so the Mac variant is a straight repackage.
#
# OWNER 2026-08-21: no outbound marketplace link key. The original build had one
# at 4,2 in all seven profiles; outbound links draw rejections, so it is gone.

import json as _json

AI_PROMPTS = _json.loads(
    (Path(__file__).parent / "ratpack_ai_prompts.json").read_text(encoding="utf-8"))

AI_ACCENT = {
    "creator":    (229, 62, 62),
    "developer":  (49, 130, 206),
    "marketing":  (221, 107, 32),
    "freelancer": (128, 90, 213),
    "coaching":   (47, 133, 90),
    "universal":  (150, 158, 170),
}

AI_FOLDER_ICON = {
    "creator": "video", "developer": "code", "marketing": "speakerphone",
    "freelancer": "briefcase", "coaching": "compass", "universal": "star",
}

# Folder keys carry their own short labels. The category names ("Freelancer Ops")
# are written for the listing; a 72px key needs 9 characters a line or it clips.
AI_FOLDER_LABEL = {
    "creator": "Creator", "developer": "Dev Tools", "marketing": "Marketing",
    "freelancer": "Freelance", "coaching": "Coach",
}


def _ai_by_cat():
    return {f["id"]: f for f in AI_PROMPTS["folders"]}


def _ai_title(button_name):
    """Stream Deck keys are 72px wide. Break a two-word label onto two lines so
    it is not truncated at real size, which is what a single long line does."""
    w = button_name.split()
    if len(w) == 1 or len(button_name) <= 9:
        return button_name
    if len(w) == 2:
        return w[0] + "\n" + w[1]
    mid = len(w) // 2
    return " ".join(w[:mid]) + "\n" + " ".join(w[mid:])


def _ai_spec(prompts, cat):
    """Icon spec keyed by prompt id, tinted with the category accent."""
    fg = AI_ACCENT[cat]
    return {p["id"]: {"icon": p["icon"], "fg": fg} for p in prompts}


def _ai_key(p):
    return c.text_action(_ai_title(p["button_name"]), p["id"], p["prompt"])


def _ai_place(prompts, coords):
    """Lay prompts onto an explicit coordinate list. The list is the design; it
    is written out per device rather than reflowed, because a 5x3 packing and an
    8x4 packing are different layouts, not the same one stretched."""
    if len(prompts) > len(coords):
        raise ValueError("layout too small: %d prompts, %d slots"
                         % (len(prompts), len(coords)))
    return {coords[i]: _ai_key(p) for i, p in enumerate(prompts)}


def _row(row, c0, c1):
    return ["%d,%d" % (col, row) for col in range(c0, c1 + 1)]


# MK.2 is 5x3. Each layout deliberately leaves keys dark rather than filling the
# deck, and keeps a whole empty column or row as a gutter where it can.
AI_MK2 = {
    8:  _row(0, 1, 3) + _row(1, 0, 4),                     # Lite: universal on top
    12: _row(0, 0, 3) + _row(1, 0, 3) + _row(2, 0, 3),     # 4-wide block, col 4 dark
    13: _row(0, 0, 4) + _row(1, 0, 3) + _row(2, 0, 3),
    11: _row(0, 0, 3) + _row(1, 0, 3) + _row(2, 0, 2),
    10: _row(0, 0, 4) + _row(1, 0, 4),                     # row 2 entirely dark
    7:  _row(0, 0, 3) + _row(1, 0, 2),
}

# XL is 8x4. The pack sits in the top two rows, row 2 is a deliberate empty
# separator, and the three universal helpers get their own cluster on row 3.
# That separator is the whole point: on XL the extra space buys grouping, not
# more keys crammed in.
AI_XL_TOP = _row(0, 0, 7) + _row(1, 0, 7)
AI_XL_UNIVERSAL = _row(3, 0, 2)


# Free-tier watermark. Lite only: removing it is the upgrade. It rides at the top
# of the pasted text, so the buyer sees it in the chat box before they hit enter.
# Owner is aware it is trivially deletable and shipped it anyway as a reminder,
# not a lock. No URL: outbound links draw rejections and a browsing buyer is
# already on the marketplace.
AI_WATERMARK = "AI Prompts Lite by Packrat. Upgrade to remove this line.\n\n"


def _build_ai_pack(slug, out_name, cat_id, taster=None, watermark=None):
    """One paid category pack, or the free Lite tier when `taster` is given."""
    cats = _ai_by_cat()
    if taster:
        prompts = [next(p for p in cats[cid]["prompts"] if p["id"] == pid)
                   for cid, pid in taster]
        spec = {}
        for (cid, _pid), p in zip(taster, prompts):
            spec[p["id"]] = {"icon": p["icon"], "fg": AI_ACCENT[cid]}
        universal = []
        if watermark:
            prompts = [dict(p, prompt=watermark + p["prompt"]) for p in prompts]
    else:
        prompts = list(cats[cat_id]["prompts"])
        spec = _ai_spec(prompts, cat_id)
        universal = list(cats["universal"]["prompts"])
        spec.update(_ai_spec(universal, "universal"))

    imgs = merged(spec)
    seed = "packrat-%s" % slug

    home = _ai_place(prompts, AI_MK2[len(prompts)])

    xl = _ai_place(prompts, AI_XL_TOP)
    if universal:
        xl.update(_ai_place(universal, AI_XL_UNIVERSAL))

    out = ROOT / slug
    plugins = ["com.elgato.streamdeck.system.text"]
    emit(out, out_name, seed, {"home": (out_name, home)}, "home", imgs, plugins,
         mac=True, xl_pages={"home": (out_name, xl)}, xl_mac=True)
    c.write_url_file(out)
    c.export_icons(out, imgs)


def build_ai_prompts_lite():
    """FREE funnel tier: the three universal helpers plus one taster from each of
    the five paid packs, so the free listing advertises every one of them."""
    _build_ai_pack(
        "ai-prompts-lite", "AI Prompts Lite", None,
        taster=[("universal", "shrink-it"), ("universal", "tone-fix"),
                ("universal", "rapid-brainstorm"),
                ("creator", "hook-generator"), ("developer", "debug-consultant"),
                ("marketing", "cold-email"), ("freelancer", "meeting-summary"),
                ("coaching", "blocker-interrogation")],
        watermark=AI_WATERMARK)


def build_ai_prompts_creator():
    _build_ai_pack("ai-prompts-creator", "AI Prompts Creators", "creator")


def build_ai_prompts_developer():
    _build_ai_pack("ai-prompts-developer", "AI Prompts Developers", "developer")


def build_ai_prompts_marketing():
    _build_ai_pack("ai-prompts-marketing", "AI Prompts Marketing", "marketing")


def build_ai_prompts_freelancer():
    _build_ai_pack("ai-prompts-freelancer", "AI Prompts Freelancers", "freelancer")


def build_ai_prompts_coach():
    _build_ai_pack("ai-prompts-coach", "AI Coach Prompts", "coaching")


def build_ai_prompt_toolkit():
    """All 56 prompts. Home carries the three universal helpers plus one folder
    per category; every category page holds its whole set on one screen, so no
    prompt is ever more than two presses away."""
    cats = _ai_by_cat()
    slug, name = "ai-prompt-toolkit", "AI Prompt Toolkit"
    seed = "packrat-%s" % slug
    order = ["creator", "developer", "marketing", "freelancer", "coaching"]

    spec = {}
    for cid in order + ["universal"]:
        spec.update(_ai_spec(cats[cid]["prompts"], cid))
    for cid in order:
        spec["fold-%s" % cid] = {"icon": AI_FOLDER_ICON[cid],
                                 "fg": AI_ACCENT[cid], "nav": True}
    imgs = merged(spec)

    pages, xl_pages = {}, {}
    for cid in order:
        ps = cats[cid]["prompts"]
        page = {"0,0": back_btn()}
        page.update(_ai_place(ps, _row(0, 1, 4) + _row(1, 0, 4) + _row(2, 0, 4)))
        pages[cid] = (cats[cid]["name"], page)

        xl_page = {"0,0": back_btn()}
        xl_page.update(_ai_place(ps, _row(0, 1, 7) + _row(1, 0, 7)))
        xl_pages[cid] = (cats[cid]["name"], xl_page)

    uni = cats["universal"]["prompts"]

    home = _ai_place(uni, _row(0, 1, 3))
    for i, cid in enumerate(order):
        home["%d,1" % i] = c.folder_action(
            _ai_title(AI_FOLDER_LABEL[cid]), "fold-%s" % cid,
            c.page_uuid_for(seed, cid))

    xl_home = _ai_place(uni, _row(0, 0, 2))
    for i, cid in enumerate(order):
        xl_home["%d,2" % i] = c.folder_action(
            _ai_title(AI_FOLDER_LABEL[cid]), "fold-%s" % cid,
            c.page_uuid_for("%s-xl" % seed, cid))

    pages["home"] = (name, home)
    xl_pages["home"] = (name, xl_home)

    out = ROOT / slug
    plugins = ["com.elgato.streamdeck.system.text"]
    emit(out, name, seed, pages, "home", imgs, plugins,
         mac=True, xl_pages=xl_pages, xl_mac=True)
    c.write_url_file(out)
    c.export_icons(out, imgs)


if __name__ == "__main__":
    for fn in (build_valorant, build_starter, build_davinci, build_davinci_lite,
               build_davinci_pro,
               build_davinci_vsd,
               build_palworld, build_discord, build_streamer_u, build_vectorworks,
               build_fortnite, build_satisfactory, build_wow, build_wow_vsd,
               build_elite, build_osrs, build_osrs_vsd, build_forza,
               build_solidworks, build_minecraft_vsd, build_cs2_vsd, build_lol_vsd,
               build_dota2_vsd, build_flstudio_vsd,
               build_epic_pen, build_epic_pen_pro,
               build_ai_prompts_lite, build_ai_prompts_creator,
               build_ai_prompts_developer, build_ai_prompts_marketing,
               build_ai_prompts_freelancer, build_ai_prompts_coach,
               build_ai_prompt_toolkit):
        fn()
        print("built:", fn.__name__)
