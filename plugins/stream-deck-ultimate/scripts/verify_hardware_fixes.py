from pathlib import Path
import argparse


def require(text: str, needle: str, label: str) -> None:
    if needle not in text:
        raise AssertionError(f"missing {label}: {needle}")


def reject(text: str, needle: str, label: str) -> None:
    if needle in text:
        raise AssertionError(f"regressed {label}: {needle}")


def read(root: Path, relative: str) -> str:
    return (root / relative).read_text(encoding="utf-8-sig")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("plugin_dir", type=Path)
    args = parser.parse_args()
    root = args.plugin_dir.resolve()

    audio = read(root, "bin/audio.ps1")
    require(audio, 'Guid("0BD7A1BE-7A1A-44DB-8397-CC5392387B5E")', "F1 correct IMMDeviceCollection IID")
    reject(audio, 'Guid("0BD7A1BE-7A1A-44DB-8397-C0A0A8A4E3A7")', "F1 obsolete IMMDeviceCollection IID")
    for symbol in ("Find(EDataFlow flow, string match)", "GetMuteOn", "SetMuteOn", "ToggleMuteOn", "ResolvedName"):
        require(audio, symbol, "F7 physical microphone targeting")

    core = read(root, "bin/plugin-v06.js")
    require(core, 'event: "switchToProfile", context: pluginUUID', "F2 switchToProfile plugin context")
    require(core, 'smart.png', "F3 Smart navigation artwork")
    require(core, 'm.event === "dialDown" || m.event === "touchTap"', "F5/F6 core encoder activation")
    reject(core, 'm.event === "dialUp") handleDialPress', "F5 obsolete dialUp activation")

    config = read(root, "bin/lib-v06-config.js")
    require(config, 'micDevice: ""', "F7 micDevice default")
    require(config, "out.micDevice", "F7 micDevice persistence")

    diagnostics = read(root, "bin/lib-v071-diagnostics.js")
    require(diagnostics, "micDevice", "F7 privacy-safe micDevice diagnostics")

    surface = read(root, "bin/app-audio/streamdeck-surface-model.js")
    require(surface, "max = 9", "F4 App Volume label length")
    reject(surface, "max = 14", "F4 obsolete App Volume label length")

    controller = read(root, "bin/app-audio/streamdeck-controller.js")
    require(controller, 'event === "dialDown" || event === "touchTap" || event === "keyUp"', "F5/F6 App Volume encoder activation")

    onboarding = read(root, "ui/onboarding-v06.html")
    require(onboarding, 'id="micdevice"', "F7 microphone device selector")
    require(onboarding, "Mic key mutes", "F7 microphone selector copy")

    print("Stream Deck Ultimate hardware acceptance contract passed: F1-F7 preserved")


if __name__ == "__main__":
    main()
