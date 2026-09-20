# coding: utf-8
#!/usr/bin/env python3
"""LoL Live Stats — Marketplace art. Uses the shared Ratpack engine in tools/."""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, os.path.join(ROOT, "tools"))
import marketing_engine as E

BG = (10, 16, 20)
GOLD = (200, 170, 110); GOLD_BR = (240, 216, 160)
TEAL = (10, 200, 185); GREEN = (48, 226, 123); YELLOW = (255, 214, 10); RED = (255, 59, 48); WHITE = (255, 255, 255)
MANA = (47, 143, 255)

def k(**kw):
    base = {"bg": BG, "bg2": (5, 8, 10)}
    base.update(kw)
    return base

gold = k(plate=GOLD, big="2.4k", big_size=44, big_color=WHITE, label="GOLD", label_color=GOLD)
goldflash = {"bg": (34, 27, 12), "bg2": (17, 16, 10), "glow": GOLD_BR, "big": "2.5k", "big_size": 42, "big_color": WHITE, "label": "GOLD", "label_color": GOLD_BR}
hp = k(plate=GREEN, big="68%", big_size=46, big_color=WHITE, label="HP", label_color=GREEN, bar=(0.68, GREEN))
hpLow = k(glow=RED, big="22%", big_size=46, big_color=WHITE, label="HP", label_color=RED, bar=(0.22, RED))
mana = k(big="60%", big_size=46, big_color=WHITE, label="MANA", label_color=MANA, bar=(0.6, MANA))
cs = k(big="182", big_size=48, big_color=WHITE, label="CS", label_color=TEAL, sub="8.4 / min", sub_color=GREEN)
level = k(plate=TEAL, big="11", big_size=58, big_color=WHITE, label="LEVEL", label_color=TEAL)
kda = k(top="K / D / A", top_color=(168, 184, 191), big="5/1/8", big_size=38, big_color=WHITE)
# Item alert: set a target item; the key counts the gold you still need, then glows green and
# says CAN BUY the instant you can afford it. Item name is whatever you type (shown here: Rabadon).
affordSaving = k(top="RABADON", top_color=GOLD, big="2.4k", big_size=42, big_color=WHITE, sub="need 540", sub_color=(168, 184, 191), bar=(0.82, GOLD))
affordReady = {"bg": (10, 26, 16), "bg2": (5, 16, 10), "glow": GREEN, "big": "CAN BUY", "big_size": 26, "big_color": WHITE, "label": "RABADON", "label_color": GREEN}

CONFIG = {
    "name": "LoL Live Stats",
    "game": "LoL",
    "brand": GOLD, "bg": BG,
    "icon": os.path.join(ROOT, "lol-live-companion", "icon.png"),
    "logo_img": os.path.join(ROOT, "assets", "logos", "leagueoflegends.png"),
    "hero_title": ["Live League of Legends", "on your Stream Deck."],
    "tagline": "Gold, health, level and CS, live. No API key.",
    "bullets": [
        "Gold that flashes the moment it climbs",
        "Health, mana, level and CS per minute",
        "Glows green the instant you can buy that item",
    ],
    "hero_keys": [gold, hp, affordReady, kda],
    "bottom": [("coin", "GOLD", "Live total"), ("heart", "HP and mana", "With bars"), ("shopping-cart", "ITEM ALERT", "Can buy now"), ("swords", "KDA and CS", "Per minute")],
    "feature_banners": [
        ("Gold, health, mana, CS and level", [hp, mana, cs, level], ["health", "mana", "CS per minute", "level"], TEAL,
         "The core numbers you watch every game, each on its own key with a bar or rate where it helps."),
        ("Know the second you can buy", [affordSaving, affordReady], ["counting up to it", "glows when ready"], GREEN,
         "Set any item as a target. The key counts the gold you still need, then turns green when you can buy it."),
    ],
    "statement": ("Your whole game, at a glance.", "Gold, health, mana, level, CS per minute, KDA and item alerts, live from your match."),
    "video_title": "Live from your game",
    "video_scenes": [
        ("Farming up", [gold, hp, cs]),
        ("Gold climbs", [goldflash, hp, cs]),
        ("Item is ready", [affordReady, mana, level]),
        ("Trade goes bad", [gold, hpLow, kda]),
    ],
    "description": {
        "intro": "LoL Live Stats puts your live League of Legends game on your Stream Deck keys. It reads the game's own Live Client data on your PC, so there is no Riot API key, no login, and nothing to sign in to. Start a game and the keys come alive on their own.",
        "tagline": "Your lane, on your deck.",
        "features": [
            ("Gold", "Your current gold, formatted and always visible, flashing the moment it climbs from a kill or a big wave."),
            ("Health and Mana", "Your HP and mana as a percent, each with its own bar that drains as you take damage or spend, and a red glow when you are low."),
            ("CS and CS per Minute", "Your creep score plus your farm rate per minute, colored green when you are keeping a strong pace."),
            ("Level", "Your champion level on a clean key, so you always know where your power spikes are."),
            ("Item Alerts", "Set any item as a gold target. The key counts how much more you need, then glows bright green and says CAN BUY the instant you can afford it. Set a different target on each key."),
            ("KDA", "Your kills, deaths and assists for the game, live."),
        ],
        "outro": "Reads the game's Live Client data locally, so it works in any mode that exposes it. Just launch League and play. Built for streamers and laners who want the numbers without alt-tabbing.",
        "keywords": ["League of Legends", "LoL", "League stats", "MOBA", "Stream Deck", "CS per minute", "gold tracker", "item shop", "build path", "KDA", "no API key", "Twitch", "streaming", "esports"],
    },
}

if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "output", "marketing")
    E.build(CONFIG, out)
