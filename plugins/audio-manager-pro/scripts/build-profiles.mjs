import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { profileAction, writeProfiles } from "../../../tools/streamdeck/profile-builder.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const profileDir = resolve(root, "com.packrat.audio-manager-pro.sdPlugin", "profiles");

const U = {
  apply: "com.packrat.audio-manager-pro.apply-profile",
  output: "com.packrat.audio-manager-pro.set-output",
  input: "com.packrat.audio-manager-pro.set-input",
  cycle: "com.packrat.audio-manager-pro.cycle-profile",
  status: "com.packrat.audio-manager-pro.profile-status",
  mute: "com.packrat.audio-manager-pro.mute-default-mic",
  volume: "com.packrat.audio-manager-pro.profile-output-volume",
};

function action(prefix, slot, uuid, name, settings = {}) {
  return profileAction(`${prefix}:${slot}`, uuid, name, settings);
}

function applySlots(prefix) {
  return {
    "0,0": action(prefix, "apply-1", U.apply, "Apply Audio Profile", { profileId: "" }),
    "1,0": action(prefix, "apply-2", U.apply, "Apply Audio Profile", { profileId: "" }),
    "2,0": action(prefix, "apply-3", U.apply, "Apply Audio Profile", { profileId: "" }),
    "3,0": action(prefix, "apply-4", U.apply, "Apply Audio Profile", { profileId: "" }),
  };
}

function profilePage(prefix, wide = true) {
  return {
    label: "PROFILES",
    keypad: {
      ...applySlots(prefix),
      ...(wide ? { "4,0": action(prefix, "cycle", U.cycle, "Cycle Audio Profile", {}) } : {}),
      "0,1": action(prefix, "status", U.status, "Audio Profile Status", { profileId: "" }),
      "1,1": action(prefix, "mute", U.mute, "Mute Default Mic", {}),
      ...(wide ? {
        "2,1": action(prefix, "default-output", U.output, "Set Default Output", { role: "default", device: null }),
        "3,1": action(prefix, "default-input", U.input, "Set Default Input", { role: "default", device: null }),
      } : {
        "2,1": action(prefix, "cycle", U.cycle, "Cycle Audio Profile", {}),
        "3,1": action(prefix, "default-output", U.output, "Set Default Output", { role: "default", device: null }),
      }),
    },
  };
}

function routingPage(prefix, wide = true) {
  return {
    label: "ROUTING",
    keypad: {
      "0,0": action(prefix, "default-output", U.output, "Set Default Output", { role: "default", device: null }),
      "1,0": action(prefix, "comm-output", U.output, "Set Communications Output", { role: "communications", device: null }),
      "2,0": action(prefix, "default-input", U.input, "Set Default Input", { role: "default", device: null }),
      "3,0": action(prefix, "comm-input", U.input, "Set Communications Input", { role: "communications", device: null }),
      "0,1": action(prefix, "mute", U.mute, "Mute Default Mic", {}),
      "1,1": action(prefix, "cycle", U.cycle, "Cycle Audio Profile", {}),
      ...(wide ? { "2,1": action(prefix, "status", U.status, "Audio Profile Status", { profileId: "" }) } : {}),
    },
  };
}

function encoderSlots(prefix) {
  return {
    "0,0": action(prefix, "dial-1", U.volume, "Profile Output Volume", { profileId: "", step: 2 }),
    "1,0": action(prefix, "dial-2", U.volume, "Profile Output Volume", { profileId: "", step: 2 }),
    "2,0": action(prefix, "dial-3", U.volume, "Profile Output Volume", { profileId: "", step: 2 }),
    "3,0": action(prefix, "dial-4", U.volume, "Profile Output Volume", { profileId: "", step: 2 }),
  };
}

function plusPages(prefix) {
  const profiles = profilePage(prefix, false);
  profiles.encoder = encoderSlots(prefix);
  const routing = routingPage(prefix, false);
  routing.encoder = encoderSlots(`${prefix}:routing`);
  return [profiles, routing];
}

const specs = [
  {
    file: "audio-manager-pro-standard",
    name: "Audio Manager Pro",
    pages: [profilePage("standard", true), routingPage("standard:routing", true)],
  },
  {
    file: "audio-manager-pro-xl",
    name: "Audio Manager Pro XL",
    pages: [profilePage("xl", true), routingPage("xl:routing", true)],
  },
  {
    file: "audio-manager-pro-plus",
    name: "Audio Manager Pro +",
    pages: plusPages("plus"),
  },
  {
    file: "audio-manager-pro-neo",
    name: "Audio Manager Pro Neo",
    pages: [profilePage("neo", false), routingPage("neo:routing", false)],
  },
];

await writeProfiles(profileDir, specs);
