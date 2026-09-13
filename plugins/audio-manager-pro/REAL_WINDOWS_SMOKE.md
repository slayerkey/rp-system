# Audio Manager Pro Real Windows Smoke

Run this on the exact release candidate after `rat dev audio-manager-pro`.

- [ ] USB headset is discoverable and can be used for Default + Communications output
- [ ] speakers can become Default output without changing Communications output when the profile says so
- [ ] microphone A can be Default input while microphone B is Communications input
- [ ] saved output volume restores correctly
- [ ] saved mic volume restores correctly
- [ ] saved mute states restore correctly
- [ ] Bluetooth output disconnect shows missing instead of switching to another device
- [ ] reconnect restores a safe identity match when metadata still matches
- [ ] endpoint ID recreation either safely rebinds by stronger metadata or requires explicit rebind
- [ ] profile with one missing device reports PARTIAL when other operations succeed
- [ ] profile with no executable operations reports FAILED
- [ ] rapid switching across at least three profiles remains responsive and lands on the final requested state
- [ ] Windows reboot preserves profiles and they re-resolve correctly
- [ ] Stream Deck restart preserves action settings and global Audio Profiles
- [ ] long and Unicode device names render safely in Property Inspector and keys
- [ ] Stream Deck + dial rotates profile output volume, press reapplies profile, touch toggles output mute

Record Windows version, Stream Deck version, devices tested, candidate package SHA256, and PASS/FAIL notes here before Marketplace submission.
