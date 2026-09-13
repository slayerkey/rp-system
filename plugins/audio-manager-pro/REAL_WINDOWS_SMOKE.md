# Audio Manager Pro Real Windows Smoke

Run this on the exact release candidate after `rat dev audio-manager-pro`.

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
