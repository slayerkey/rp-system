# coding: utf-8
#!/usr/bin/env python3
"""CS2 Live Stats — Marketplace art. Uses the shared Ratpack engine in tools/."""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, os.path.join(ROOT, "tools"))
import marketing_engine as E

BG = (12, 13, 16)
ORANGE = (222, 155, 53); ORANGE_BR = (255, 157, 46)
GREEN = (48, 226, 123); YELLOW = (255, 214, 10); RED = (255, 59, 48)
BLUE = (59, 130, 246); GREY = (110, 118, 130); WHITE = (255, 255, 255)

def k(**kw):
    base = {"bg": BG, "bg2": (0, 0, 0)}
    base.update(kw)
    return base

health100 = k(plate=GREEN, big="100", big_color=WHITE, label="HP", label_color=GREEN)
health42 = k(plate=YELLOW, big="42", big_color=WHITE, label="HP", label_color=YELLOW)
health12 = k(glow=RED, big="12", big_color=WHITE, label="HP", label_color=RED)
# Ammo mirrors the real key: clip big, reserve as a dim "/ NN" sub, fill bar flush at the bottom.
SUBGREY = (170, 176, 187)
ammo30 = k(big="30", big_size=56, big_color=WHITE, sub="/ 90", sub_color=SUBGREY, bar=(1.0, ORANGE))
ammo10 = k(big="10", big_size=56, big_color=WHITE, sub="/ 60", sub_color=SUBGREY, bar=(0.33, RED))
ammoReload = k(glow=ORANGE_BR, big="RELOAD", big_size=26, big_color=ORANGE_BR, sub="0 / 60", sub_color=SUBGREY, bar=(0.0, ORANGE_BR))
kills0 = k(plate=GREEN, big="0", big_color=WHITE, label="KILLS", label_color=GREEN)
kills1 = k(plate=GREEN, big="1", big_color=WHITE, label="KILLS", label_color=GREEN)
kills3 = k(plate=GREEN, big="3", big_color=WHITE, label="KILLS", label_color=GREEN)
kills4 = k(glow=YELLOW, big="ACE", big_size=40, big_color=WHITE, label="4 KILLS", label_color=YELLOW)
money = k(big="$4150", big_size=40, big_color=WHITE, label="MONEY", label_color=GREEN)
phaseFREEZE = k(border=BLUE, big="FREEZE", big_size=32, big_color=WHITE, label="BUY", label_color=BLUE)
phaseLIVE = k(border=GREEN, big="LIVE", big_size=40, big_color=WHITE, label="ROUND", label_color=GREEN)
phaseBOMB = k(glow=ORANGE_BR, big="BOMB", big_size=38, big_color=WHITE, label="PLANTED", label_color=ORANGE_BR)
phaseOVER = k(border=GREY, big="OVER", big_size=38, big_color=(210, 214, 222), label="ROUND", label_color=GREY)

CONFIG = {
    "name": "CS2 Live Stats",
    "game": "CS2",
    "brand": ORANGE, "bg": BG,
    "icon": os.path.join(ROOT, "cs2-reactive-deck", "icon.png"),
    "logo_img": os.path.join(ROOT, "assets", "logos", "counterstrike.png"),
    "hero_title": ["Live Counter-Strike 2", "on your Stream Deck."],
    "tagline": "HP, ammo, kills and the round score, live as you play.",
    "bullets": [
        "HP that flashes when you're one shot from dead",
        "Ammo that pulses the instant your clip is dry",
        "Kills, money and the round score at a glance",
    ],
    "hero_keys": [health100, ammo30, kills3, money, phaseLIVE],
    "bottom": [("heart", "HEALTH", "Live HP"), ("bolt", "AMMO", "Clip and reserve"), ("crosshair", "KILLS", "Live kill count"), ("coin", "ECONOMY", "Your money")],
    "feature_banners": [
        ("Your health, impossible to miss", [health100, health42, health12], ["safe", "hurt", "one shot left"], RED,
         "Your HP front and center, green through yellow to red, flashing the instant you are one shot from dead. Armor shown too."),
        ("Everything that matters, live", [ammo30, money, phaseLIVE], ["clip and reserve", "your money", "round phase"], ORANGE_BR,
         "Ammo with a bar that pulses when your clip runs dry, your cash colored by buy power, and the live round phase."),
    ],
    "statement": ("Always know where you stand.", "HP, ammo, kills, money and the score, the instant they change."),
    "video_title": "CS2, live on your deck",
    "video_scenes": [
        ("Freezetime", [health100, ammo30, kills0, phaseFREEZE]),
        ("Live", [health100, ammo30, kills1, phaseLIVE]),
        ("Taking fire", [health42, ammo10, kills1, phaseLIVE]),
        ("One shot from dead", [health12, ammoReload, kills3, phaseLIVE]),
        ("Bomb planted", [health12, ammo30, kills3, phaseBOMB]),
        ("Round won", [health100, ammo30, kills4, phaseOVER]),
    ],
    "description": {
        "intro": "CS2 Live Stats puts your live Counter-Strike 2 match on your Stream Deck keys. It sets up the game integration for you, so the keys go live the moment you load in. No config files, no console commands.",
        "tagline": "Your deck feels the round.",
        "features": [
            ("HP", "Your health front and center, green to red, flashing red when you're one shot from dead. Armor shown too."),
            ("Ammo", "Clip and reserve with a fill bar that pulses orange the instant your clip runs dry."),
            ("Kills", "Counts your kills and calls out DOUBLE, TRIPLE and ACE with headshot flair."),
            ("Round Phase", "Freezetime, live, a pulsing bomb timer, and round over, readable at a glance."),
            ("Economy", "Your money, colored by your buy power."),
            ("Match KDA", "Kills, deaths and assists for the whole match."),
            ("Round Score", "The live CT vs T round score, with your side highlighted."),
        ],
        "outro": "Auto-installs its Game State Integration config. Just restart CS2 once and play.",
        "keywords": ["CS2", "Counter-Strike 2", "CS2 stats", "CSGO", "Stream Deck", "FPS overlay", "HP tracker", "ammo counter", "kill feed", "competitive", "esports", "Twitch", "streaming"],
    },
}

if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "output", "marketing")
    E.build(CONFIG, out)
