"""Personal (not-for-sale) Streamer Starter variant with the user's own SFX wired in.

Output: profiles/_personal/ — kept out of the sellable folders because the audio
files are third-party/unlicensed and must never ship in a marketplace product.
"""
import build_all

SFX_DIR = "G:\\Coaching\\slayerkey-hub\\stream-obs\\deck-sfx"

SFX = {
    "Boom": f"{SFX_DIR}\\vine-boom-classic.mp3",
    "Wow": f"{SFX_DIR}\\wow-crowd.mp3",
    "Boo": f"{SFX_DIR}\\crowd-boo.mp3",
    "Drum\nRoll": f"{SFX_DIR}\\drumroll-short.mp3",
    "Laugh": f"{SFX_DIR}\\evil-laugh.mp3",
    "Yippie": f"{SFX_DIR}\\yippie.mp3",
    "Wrong": f"{SFX_DIR}\\wrong.mp3",
    "Correct": f"{SFX_DIR}\\correct.mp3",
    "Suspense": f"{SFX_DIR}\\suspense-multiple.mp3",
    "News": f"{SFX_DIR}\\breaking-news.mp3",
    "Rizz": f"{SFX_DIR}\\rizz-sfx.mp3",
    "Bruh": f"{SFX_DIR}\\bruh-quick.mp3",
    "Chime": f"{SFX_DIR}\\airplane-chime.mp3",
}

if __name__ == "__main__":
    build_all.build_starter(sfx_paths=SFX, name="Streamer Starter (Personal)",
                            seed="packrat-streamer-starter-personal",
                            out_folder="_personal")
    print("built personal variant -> profiles/_personal/")
