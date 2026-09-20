# Streamer Starter Pack — Stream Deck MK.2 profile

**Price: $7.99** (category proven at $7.50-8.50 with real volume: OBS pack 814 sales at $8.50)

The one-page control room for an OBS + Discord streamer: comms, recording, clipping, markers,
voiceover, subtitles hook, recordings folder, and a 13-slot soundboard page.

## Buttons — Home

| Pos | Button | Sends / Opens |
|---|---|---|
| 0,0 | Mute Mic | Ctrl+Shift+M (Discord toggle-mute; optionally bind the same combo to OBS mic mute so one press mutes both) |
| 1,0 | Deafen | Ctrl+Shift+D (Discord toggle-deafen) |
| 2,0 | Save Clip | Ctrl+Alt+C → OBS "Save Replay Buffer" |
| 3,0 | Marker | Ctrl+Alt+M → OBS "Local Stream Marker" script hotkey |
| 4,0 | Record | Ctrl+Alt+R → OBS Start/Stop Recording |
| 0,1 | Stream | Ctrl+Alt+B → OBS Start/Stop Streaming |
| 1,1 | Voiceover | Ctrl+Alt+V → OBS Start/Stop Recording on a mic-only scene (documented) |
| 2,1 | Subtitles | Ctrl+Shift+Alt+L → bind in your captions tool (e.g. OBS LocalVocal plugin, or your editor's transcribe command) |
| 3,1 | Videos | opens %USERPROFILE%\Videos (OBS default recordings folder) |
| 4,1 | Sounds › | soundboard page |
| 4,2 | More Profiles | opens marketplace.elgato.com/@packrat |

## Soundboard page
13 pre-labeled Play Audio buttons (Hype, Applause, Wow, Sad, Boo, Suspense, Drum Roll, Win,
Fail, Laugh, Boom, Intro, Outro) + Back + More Profiles. **Ships with no audio files** — buyer
right-clicks each button in the Stream Deck app and picks their own file.

**Licensing note (why no audio ships):** bundled meme SFX and music (commercial tracks, game
OSTs) are copyrighted; redistributing them in a paid product is infringement and a marketplace
rejection. Buyers can use their own licensed sounds freely.

## Buyer setup
1. Discord → Settings → Keybinds: Toggle Mute = Ctrl+Shift+M, Toggle Deafen = Ctrl+Shift+D.
2. OBS → Settings → Hotkeys: bind the five OBS combos listed above. Enable Replay Buffer in
   Output settings for Save Clip.
3. Markers: install the free "Local Stream Marker" OBS Lua script, bind Ctrl+Alt+M.
4. Soundboard: assign your own audio files per button.

## Research rationale
OBS ships zero default hotkeys; the validated 80% set is mic mute, record, stream, replay-buffer
save, and markers (see profiles/RESEARCH.md §3). Deafen is a Discord concept, hence the
OBS + Discord combo target. Subtitles is the weakest button (flagged) — kept because the spec
required it and the setup is documented; cut it first if reviews call bloat.

## Icons & licensing
Tabler Icons webfont (MIT), rendered locally at 72x72. No AI-generated icons. No third-party
brand marks on the paid buttons.
