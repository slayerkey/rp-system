# coding: utf-8
#!/usr/bin/env python3
"""Event Countdown — Marketplace art. Uses the shared Ratpack engine in tools/."""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, os.path.join(ROOT, "tools"))
import marketing_engine as E

BG = (16, 10, 24)
VIOLET = (160, 107, 220); VIOLET_BR = (199, 155, 255)
XMAS = (232, 65, 60); XGREEN = (63, 191, 111)
PUMPKIN = (255, 138, 43); HALLO2 = (169, 116, 255)
GOLD = (255, 216, 107); PINK = (255, 126, 179)
AMBER = (255, 171, 46); RED = (255, 78, 66); WHITE = (255, 255, 255)

def c(occasion, name, big, unit, accent, accent2=VIOLET, phase="normal", frac=0.6):
    return {"kind": "countdown", "bg": BG, "bg2": (8, 5, 16), "occasion": occasion,
            "name": name, "big": big, "unit": unit, "accent": accent, "accent2": accent2, "phase": phase, "frac": frac}

# Built-in occasions, each with its own art + colours (mirrors the real plugin's themed keys).
xmas = c("christmas", "CHRISTMAS", "12", "DAYS", XMAS, XGREEN, frac=0.55)
halloween = c("halloween", "HALLOWEEN", "34", "DAYS", PUMPKIN, HALLO2, frac=0.72)
newyear = c("newyear", "NEW YEAR", "59", "DAYS", GOLD, VIOLET_BR, frac=0.8)
birthday = c("birthday", "BIRTHDAY", "5", "DAYS", GOLD, PINK, frac=0.35)
launch = c("custom", "LAUNCH DAY", "88", "DAYS", VIOLET_BR, VIOLET, frac=0.9)
# One stream-goal countdown shown escalating through every phase.
escNormal = c("custom", "STREAM GOAL", "6", "DAYS", VIOLET_BR, VIOLET, frac=0.6)
escWarn = c("custom", "STREAM GOAL", "8", "HOURS", AMBER, AMBER, phase="warn", frac=0.18)
escUrgent = c("custom", "STREAM GOAL", "12", "MINS", RED, RED, phase="urgent", frac=0.04)
celebrate = c("christmas", "CHRISTMAS", "", "", XMAS, XGREEN, phase="celebrate")
celebrate2 = c("birthday", "BIRTHDAY", "", "", GOLD, PINK, phase="celebrate")
escCele = c("custom", "STREAM GOAL", "", "", VIOLET_BR, GOLD, phase="celebrate")

CONFIG = {
    "name": "Event Countdown",
    "game": "COUNTDOWN", "icon_sub": "",
    "brand": VIOLET, "bg": BG,
    "icon": os.path.join(ROOT, "event-countdown", "icon.png"),
    "logo_img": os.path.join(ROOT, "assets", "logos", "countdown.png"),
    "logo_color": VIOLET_BR,
    "hero_title": ["A live countdown", "to anything that matters."],
    "tagline": "Holidays, launches, birthdays and stream goals.",
    "bullets": [
        "Holidays and birthdays built in, or any custom date",
        "Calm, then amber under a day, then a red alarm",
        "Themed art and fireworks when the day lands",
    ],
    "hero_keys": [xmas, birthday, escUrgent, celebrate],
    "bottom": [("calendar-event", "ANY DATE", "Or a preset"), ("layout-grid", "ONE PER KEY", "Track many"), ("flame", "IT ESCALATES", "Amber to red"), ("confetti", "DAY OF", "Fireworks")],
    "feature_banners": [
        ("Built in for every occasion", [xmas, halloween, newyear, birthday],
         ["Christmas", "Halloween", "New Year", "birthdays"], VIOLET_BR,
         "Popular holidays and birthdays come ready, each with its own art and colors. Or set any custom date and time you like."),
        ("It escalates as the day nears", [escNormal, escWarn, escUrgent, escCele],
         ["days out", "under a day", "final minutes", "the day is here"], AMBER,
         "Calm while it is far off, an amber warning under a day, a pulsing red alarm in the final hour, then fireworks on the day itself."),
    ],
    "statement": ("Every moment that matters.", "Game launches, holidays, birthdays and stream goals. One countdown per key, as many as you like."),
    "video_title": "Counting down to anything",
    "video_scenes": [
        ("Holidays built in", [xmas, halloween, newyear]),
        ("Or any date you set", [launch, birthday, escNormal]),
        ("It escalates", [escWarn, escUrgent, xmas]),
        ("Fireworks on the day", [celebrate, celebrate2, newyear]),
    ],
    "description": {
        "intro": "Event Countdown turns any Stream Deck key into a live countdown. Christmas, a game launch, a birthday, a stream goal, or any date and time you choose. Each key counts down on its own and updates every second.",
        "tagline": "Every moment that matters.",
        "features": [
            ("Built-in Occasions", "Christmas, New Year, Halloween, Valentine's, the Fourth of July, Thanksgiving, birthdays and more come ready to pick, each with its own art and colors. Annual ones roll over to next year on their own."),
            ("Any Custom Date", "Set your own date and time for anything: a release, an exam, a trip, a launch stream. Pick days, hours and minutes, or pack it all into one line."),
            ("One Per Key", "Give every key its own event and watch them all at once. Track a whole month of dates across your deck."),
            ("It Escalates", "The key stays calm while the date is far off, turns amber in the final day, and pulses a red alarm in the last hour, so you feel the deadline coming."),
            ("Fireworks On the Day", "When the moment arrives the key bursts into themed fireworks and reads IT'S HERE, then quietly resets afterward."),
        ],
        "outro": "Pure local date math. No internet, no account, nothing to sign in to. Great for streamers counting to a milestone and anyone who likes a deadline they can see.",
        "keywords": ["countdown", "timer", "event countdown", "Stream Deck", "holiday countdown", "birthday", "release date", "stream goal", "reminder", "days until", "New Year", "Christmas", "Twitch", "streaming"],
    },
}

if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "output", "marketing")
    E.build(CONFIG, out)
