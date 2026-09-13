import type { ApplyResult, ModeDefinition, SystemSnapshot } from "./types.js";

export function statusTitle(snapshot: SystemSnapshot): string {
  if (!snapshot.backendOnline) return "WINDOWS\nOFFLINE";
  const hdr = hdrText(snapshot);
  const power = short(snapshot.powerPlanName || "POWER", 10);
  return `${hdr}\n${power}`;
}

export function hdrTitle(snapshot: SystemSnapshot): string {
  if (!snapshot.backendOnline) return "HDR\nOFFLINE";
  if (!snapshot.hdr.available || snapshot.hdr.supportedCount === 0) return "HDR\nN/A";
  if (snapshot.hdr.mixed) return "HDR\nMIXED";
  return snapshot.hdr.enabledCount === snapshot.hdr.supportedCount ? "HDR\nON" : "HDR\nOFF";
}

export function powerTitle(snapshot: SystemSnapshot): string {
  if (!snapshot.backendOnline) return "POWER\nOFFLINE";
  return `POWER\n${short(snapshot.powerPlanName || "UNKNOWN", 11)}`;
}

export function topologyTitle(snapshot: SystemSnapshot): string {
  if (!snapshot.backendOnline) return "DISPLAY\nOFFLINE";
  return `DISPLAY\n${snapshot.topology.toUpperCase()}`;
}

export function timeoutTitle(snapshot: SystemSnapshot): string {
  if (!snapshot.timeout) return "TIMEOUT\nN/A";
  return `SCREEN\n${duration(snapshot.timeout.monitorAcSeconds)}`;
}

export function awakeTitle(snapshot: SystemSnapshot): string {
  return snapshot.keepAwake ? "AWAKE\nON" : "AWAKE\nOFF";
}

export function currentModeTitle(modes: ModeDefinition[], snapshot: SystemSnapshot, matcher: (mode: ModeDefinition, snapshot: SystemSnapshot) => boolean): string {
  const matches = modes.filter((mode) => matcher(mode, snapshot));
  if (!snapshot.backendOnline) return "MODE\nOFFLINE";
  if (!matches.length) return "MODE\nCUSTOM";
  if (matches.length > 1) return "MODE\nMULTI";
  return `MODE\n${short(matches[0].name, 10)}`;
}

export function modeTitle(mode?: ModeDefinition): string {
  return short(mode?.name || "MODE", 12);
}

export function resultTitle(result: ApplyResult): string {
  return `${result.status}\n${short(result.modeName, 10)}`;
}

function hdrText(snapshot: SystemSnapshot): string {
  if (!snapshot.hdr.available || snapshot.hdr.supportedCount === 0) return "HDR N/A";
  if (snapshot.hdr.mixed) return "HDR MIX";
  return snapshot.hdr.enabledCount === snapshot.hdr.supportedCount ? "HDR ON" : "HDR OFF";
}

function duration(seconds: number): string {
  if (seconds === 0) return "NEVER";
  if (seconds % 3600 === 0) return `${seconds / 3600}H`;
  if (seconds % 60 === 0) return `${seconds / 60}M`;
  return `${seconds}S`;
}

function short(value: string, max: number): string {
  const clean = value.replace(/\s+/g, " ").trim().toUpperCase();
  return clean.length <= max ? clean : `${clean.slice(0, Math.max(1, max - 1))}…`;
}
