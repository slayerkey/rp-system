# Audio Manager Pro Real Windows Smoke

Run this on the exact release candidate after `rat dev audio-manager-pro`.

## Property Inspector + Audio Profile workflow

Run this before the deeper device matrix. A rendered inspector is not enough; every control must complete a PI → plugin → PI round trip.

- [ ] open an **Apply Audio Profile** action and confirm the PI changes from Connecting to **Windows audio connected**
- [ ] press **Refresh** and confirm visible progress/acknowledgement instead of a silent click
- [ ] press **Capture current setup** once and confirm exactly one new `Audio Profile N` appears and becomes the focused editor profile
- [ ] rename that profile, press **Save profile**, switch to another Stream Deck action and back, and confirm the saved name/devices persist
- [ ] choose the captured profile in the action-level **Audio Profile** selector, leave/reopen the action, and confirm the selection persists
- [ ] press the hardware key and confirm the selected profile actually applies rather than reporting Select/Create profile
- [ ] change one role/device in the editor, save, apply, and confirm the corresponding Windows role changes
- [ ] press **Delete** on a throwaway profile and confirm it is removed only after confirmation
- [ ] confirm no command creates duplicate profiles or executes twice
- [ ] rerun `rat audit audio-manager-pro` and confirm an Audio Manager plugin log now exists
- [ ] if any PI button is still dead, open the Stream Deck Property Inspector debugger at `http://localhost:23654/`, select the Audio Manager inspector page, and inspect console/WebSocket errors before changing audio/native code

The compatibility contract for this plugin is: the manual PI WebSocket uses the callback PI UUID as its message context, while the selected action instance is carried separately as `payload.actionContext`. Plugin commands are also accepted on the global `streamDeck.ui.onSendToPlugin` path and request IDs prevent duplicate delivery from executing a command twice.

- [ ] USB headset is discoverable and can be used for Default + Communications output
- [ ] speakers can become Default output without changing Communications output when the profile says so
- [ ] applying Default output aligns both Windows Console and Multimedia output roles
- [ ] manually drift Windows Multimedia output away from Console and confirm Audio Profile Status becomes INACTIVE
- [ ] microphone A can be Default input while microphone B is Communications input
- [ ] manually split Console vs Multimedia Default input and confirm Mute Default Mic refuses to toggle an ambiguous microphone
- [ ] saved output volume restores correctly
- [ ] saved mic volume restores correctly
- [ ] saved mute states restore correctly
- [ ] contradictory saved volume/mute state for the same endpoint is skipped and reported instead of choosing a winner
- [ ] Bluetooth output disconnect shows missing instead of switching to another device
- [ ] reconnect restores a safe identity match when metadata still matches
- [ ] endpoint ID recreation either safely rebinds by stronger metadata or requires explicit rebind
- [ ] profile with one missing device reports PARTIAL when other operations succeed
- [ ] profile with no executable operations reports FAILED
- [ ] rapid switching across at least three profiles remains responsive and lands on the final requested state
- [ ] three rapid Cycle presses advance three profile positions in order instead of retrying the same next profile
- [ ] Windows reboot preserves profiles and they re-resolve correctly
- [ ] Stream Deck restart preserves action settings and global Audio Profiles
- [ ] long and Unicode device names render safely in Property Inspector and keys
- [ ] Stream Deck + dial rotates profile output volume, press reapplies profile, touch toggles output mute
- [ ] fast dial rotation accumulates the expected tick delta without stale-snapshot jumps or dropped detents

Record Windows version, Stream Deck version, devices tested, candidate package SHA256, and PASS/FAIL notes here before Marketplace submission.

## Stream Deck session recovery

- [ ] put Windows to sleep with Audio Manager actions visible
- [ ] wake Windows and confirm key presses still invoke Apply / Set Device / Mute actions
- [ ] confirm Stream Deck + dial rotate / press / touch events still arrive
- [ ] open the Property Inspector and confirm refresh / save messages still work
- [ ] confirm live Windows audio state continues to update after wake
- [ ] if action/PI events stop while outgoing renders still work, record the Stream Deck version and reproduce against Elgato SDK issue #157 before adding any workaround
