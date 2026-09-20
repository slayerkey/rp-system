# coding: utf-8
#!/usr/bin/env python3
"""Dota 2 Live Stats — Marketplace art. Uses the shared Ratpack engine in tools/."""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, os.path.join(ROOT, "tools"))
import marketing_engine as E

BG = (18, 10, 10)
CRIMSON = (194, 60, 42); CRIMSON_BR = (255, 90, 60)
GOLD = (255, 206, 74); GOLD_BR = (255, 224, 138)
GREEN = (48, 226, 123); MANA = (47, 143, 255); RED = (255, 59, 48); WHITE = (255, 255, 255)

def k(**kw):
    base = {"bg": BG, "bg2": (0, 0, 0)}
    base.update(kw)
    return base

hpmana = k(plate=GREEN, big="1420", big_size=40, big_color=WHITE, label="HP", label_color=GREEN, bar=(0.62, MANA))
hpmanaLow = k(glow=RED, big="240", big_size=44, big_color=WHITE, label="HP", label_color=RED, bar=(0.2, MANA))
gold = k(plate=GOLD, big="4.2k", big_size=44, big_color=WHITE, label="GOLD", label_color=GOLD)
goldflash = {"bg": (42, 34, 8), "bg2": (20, 16, 10), "glow": GOLD_BR, "big": "+260", "big_size": 40, "big_color": GOLD_BR, "label": "GOLD", "label_color": GOLD_BR}
networth = k(plate=GOLD, big="12.4k", big_size=40, big_color=WHITE, label="NET WORTH", label_color=GOLD)
rosh = k(glow=RED, big="8:30", big_size=44, big_color=WHITE, label="WINDOW", label_color=RED)
respawn = k(glow=RED, big="6", big_size=52, big_color=WHITE, label="RESPAWN", label_color=CRIMSON_BR)
kdaEarly = k(top="K / D / A", top_color=(196, 178, 176), big="2/0/3", big_size=36, big_color=WHITE)
kda = k(top="K / D / A", top_color=(196, 178, 176), big="7/2/11", big_size=36, big_color=WHITE)

CONFIG = {
    "name": "Dota 2 Live Stats",
    "game": "DOTA 2",
    "brand": CRIMSON, "bg": BG,
    "icon": os.path.join(ROOT, "dota2-reactive-deck", "icon.png"),
    "logo_img": os.path.join(ROOT, "assets", "logos", "dota2.png"),
    "hero_title": ["Live Dota 2 data", "on your Stream Deck."],
    "tagline": "Hero HP, gold, respawn and KDA, live as you play.",
    "bullets": [
        "Hero HP and mana with a draining blue bar",
        "Gold and net worth that flash on a kill",
        "Auto respawn timer, match clock and live KDA",
    ],
    "hero_keys": [hpmana, gold, respawn, kda],
    "bottom": [("heart", "HP / MP", "Vitals"), ("coin", "GOLD", "Net worth"), ("clock", "RESPAWN", "Auto timer"), ("swords", "KDA", "Live")],
    "feature_banners": [
        ("Hero vitals, gold and net worth", [hpmana, hpmanaLow, networth], ["healthy", "low, glowing", "how fed you are"], GOLD_BR,
         "Your hero's health and mana with a draining bar, a red glow when you are nearly dead, and your gold and net worth at a glance."),
        ("Auto timers and live KDA", [respawn, rosh, kda], ["respawn countdown", "Roshan window", "kills / deaths / assists"], CRIMSON_BR,
         "An automatic respawn countdown the moment you die, a press to start Roshan window, the match clock and your live KDA."),
    ],
    "statement": ("The Ancient, on your deck.", "Hero HP and mana, gold, net worth, respawn and KDA, live as you play."),
    "video_title": "Reacts to the whole match",
    "video_scenes": [
        ("Laning phase", [hpmana, gold, kdaEarly]),
        ("Kill, gold spikes", [hpmana, goldflash, kda]),
        ("Caught out", [hpmanaLow, gold, kda]),
        ("Respawning", [respawn, networth, kda]),
    ],
    "description": {
        "intro": "Dota 2 Live Stats puts your live match on your Stream Deck keys. It sets up the game integration for you, so the keys go live the moment you load into a match. No config files to edit.",
        "tagline": "Your deck feels the whole match.",
        "features": [
            ("Hero HP and Mana", "Your health and mana up front, with a bar that drains as you take damage and a red glow when you are nearly dead."),
            ("Gold", "Your current gold, flashing the instant it jumps from a kill or a big creep wave."),
            ("Net Worth", "How fed you are, at a glance."),
            ("Respawn Timer", "An automatic countdown the moment you die, so you know exactly when you are back."),
            ("Roshan Window", "Press to start the Roshan timer and track the kill to respawn window."),
            ("Match Clock and KDA", "The game time and your kills, deaths and assists, live."),
        ],
        "outro": "Auto-installs its Game State Integration config. Add -gamestateintegration to your launch options, restart Dota once, and play.",
        "keywords": ["Dota 2", "Dota2", "Dota stats", "MOBA", "Stream Deck", "respawn timer", "Roshan timer", "net worth", "gold tracker", "KDA", "Twitch", "streaming", "esports"],
    },
}

if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "output", "marketing")
    E.build(CONFIG, out)
