# coding: utf-8
#!/usr/bin/env python3
"""NASA Space Live Tracker — Marketplace art. Uses the shared Ratpack engine in tools/."""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, os.path.join(ROOT, "tools"))
import marketing_engine as E

BG = (7, 11, 24)
BLUE = (74, 123, 214); BLUE_BR = (125, 169, 255)
NASARED = (252, 61, 33); STAR = (255, 216, 107); WHITE = (255, 255, 255)

def k(**kw):
    base = {"bg": BG, "bg2": (3, 5, 12)}
    base.update(kw)
    return base

# ISS keys mirror the real app: a little Earth globe with a bright arrow to the station, the
# direction spelled out, and the distance from your city. Pulses white + OVERHEAD when it passes.
iss = {"kind": "globe", "bg": BG, "bg2": (3, 5, 12), "bearing": 52, "direction": "NORTHEAST", "sub": "19,399 km · London"}
issWest = {"kind": "globe", "bg": BG, "bg2": (3, 5, 12), "bearing": 264, "direction": "WEST", "sub": "9,840 km · Tokyo"}
issOver = {"kind": "globe", "overhead": True, "bg": (10, 20, 48), "bg2": (5, 10, 26), "glow": WHITE, "sub": "look up! · 408 km"}
launch = k(top="T-MINUS", top_color=NASARED, big="2d 4h", big_size=42, big_color=WHITE, label="FALCON 9", label_color=BLUE_BR)
launchSoon = k(top="T-MINUS", top_color=NASARED, big="6:12", big_size=46, big_color=WHITE, label="STARSHIP", label_color=BLUE_BR)
apod = {"kind": "apod", "variant": 0, "sub": "today's photo"}
apod1 = {"kind": "apod", "variant": 1, "sub": "yesterday"}
apod2 = {"kind": "apod", "variant": 2, "sub": "2 days ago"}
apod3 = {"kind": "apod", "variant": 3, "sub": "3 days ago"}

CONFIG = {
    "name": "NASA Space Live Tracker",
    "game": "NASA", "icon_sub": "LIVE",
    "brand": BLUE, "bg": BG,
    "icon": os.path.join(ROOT, "nasa-space-tracker", "icon.png"),
    "logo_img": os.path.join(ROOT, "assets", "logos", "nasa.png"),
    "logo_color": NASARED,
    "hero_title": ["Live NASA space data", "on your Stream Deck."],
    "tagline": "The ISS, the next launch and today's photo.",
    "bullets": [
        "A globe shows which way to look for the ISS",
        "It pulses OVERHEAD when the station is above you",
        "Next launch countdown and the daily NASA photo",
    ],
    "hero_keys": [iss, launch, apod],
    "bottom": [("globe", "ISS", "Which way to look"), ("rocket", "LAUNCH", "Live countdown"), ("photo", "APOD", "Photo of the day"), ("refresh", "AUTO", "Updates itself")],
    "feature_banners": [
        ("See exactly where the ISS is", [iss, issWest, issOver],
         ["pointing northeast", "now to the west", "passing overhead"], (200, 210, 235),
         "A globe and a bright arrow point the way, with the distance from your city. Tap a key to open NASA's live tracking map."),
        ("Never miss a launch", [launchSoon, launch],
         ["minutes away", "two days out"], NASARED,
         "A live countdown to the next rocket launch, from days out down to the final seconds."),
        ("A new space photo every day", [apod, apod1, apod2, apod3],
         ["today", "yesterday", "2 days ago", "3 days ago"], (180, 150, 240),
         "NASA's astronomy picture of the day, pulled fresh and shown right on a key."),
    ],
    "statement": ("Space, on your desk.", "The ISS overhead, the next rocket launch, and a new photo of the universe every day."),
    "video_title": "Bring space to your deck",
    "video_scenes": [
        ("Where is the ISS?", [iss, launch, apod]),
        ("It moves as it orbits", [issWest, launch, apod1]),
        ("Passing overhead", [issOver, launchSoon, apod2]),
        ("A new photo daily", [iss, launch, apod3]),
    ],
    "description": {
        "intro": "NASA Space Live Tracker turns your Stream Deck into a live window on space. Watch the International Space Station cross the sky, count down to the next rocket launch, and see NASA's photo of the day, all without opening a browser.",
        "tagline": "Space, on your desk.",
        "features": [
            ("ISS Tracker", "A little Earth globe with a bright arrow shows which way to look for the station and how far it is from your city, updating every few seconds as it orbits. The key pulses white and reads OVERHEAD when the ISS is passing above you, and a tap opens NASA's live Spot the Station map."),
            ("Pick Your City", "Choose your location from a list of cities, or drop in your own coordinates, and switch between kilometers and miles. Every ISS key shares the setting."),
            ("Next Launch", "A live T-minus countdown to the next rocket launch, with the mission name, ticking down from days out to the final seconds."),
            ("Picture of the Day", "NASA's astronomy picture of the day on a key, refreshed daily, with the big photos scaled down to fit cleanly. On video days it shows a play card instead."),
            ("Set and Forget", "Everything refreshes on its own in the background. No API key for the ISS, nothing to sign in to, nothing to babysit."),
        ],
        "outro": "Pulls live data straight from NASA and open space data sources. Great for streamers, classrooms, space fans and anyone who likes looking up.",
        "keywords": ["NASA", "ISS", "space", "International Space Station", "rocket launch", "Stream Deck", "APOD", "astronomy", "space tracker", "SpaceX", "Spot the Station", "stargazing", "science", "education"],
    },
}

if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "output", "marketing")
    E.build(CONFIG, out)
