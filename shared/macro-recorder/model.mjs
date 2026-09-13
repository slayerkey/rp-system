import { randomUUID } from "node:crypto";

export const MACRO_SCHEMA = 1;
export const LITE_LIMITS = Object.freeze({ maxDurationMs: 30_000, maxEvents: 60 });
export const PRO_LIMITS = Object.freeze({ maxDurationMs: 600_000, maxEvents: 25_000 });

const TYPES = new Set(["keyDown","keyUp","mouseMove","mouseDown","mouseUp","wheel"]);

export function clamp(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.max(min, Math.min(max, number));
}

export function normalizeEvent(raw = {}, { pro = true, maxDelayMs = pro ? PRO_LIMITS.maxDurationMs : LITE_LIMITS.maxDurationMs } = {}) {
  if (!TYPES.has(raw.type)) return null;
  const type = raw.type;
  if (!pro && !type.startsWith("key")) return null;
  const out = {
    type,
    delayMs: Math.round(clamp(raw.delayMs ?? 0, 0, maxDelayMs)),
  };
  if (type.startsWith("key")) {
    const vk = Number(raw.vk);
    if (!Number.isFinite(vk) || vk < 1 || vk > 255) return null;
    out.vk = Math.round(vk);
    out.scan = Math.round(clamp(raw.scan ?? 0, 0, 65535));
    out.extended = raw.extended === true;
    out.name = String(raw.name || keyLabel(out.vk)).slice(0, 40);
  } else if (type === "mouseMove") {
    addPosition(out, raw);
  } else if (type === "mouseDown" || type === "mouseUp") {
    if (!["left","right","middle","x1","x2"].includes(raw.button)) return null;
    out.button = raw.button;
    addPosition(out, raw);
  } else if (type === "wheel") {
    out.delta = Math.round(clamp(raw.delta ?? 0, -12000, 12000));
    out.horizontal = raw.horizontal === true;
    addPosition(out, raw);
  }
  return out;
}

function addPosition(out, raw) {
  out.x = Math.round(clamp(raw.x ?? 0, -100000, 100000));
  out.y = Math.round(clamp(raw.y ?? 0, -100000, 100000));
  if (Number.isFinite(Number(raw.relX)) && Number.isFinite(Number(raw.relY))) {
    out.relX = clamp(raw.relX, -2, 3);
    out.relY = clamp(raw.relY, -2, 3);
  }
}

export function normalizeMacro(raw = {}, { pro = true, limits = pro ? PRO_LIMITS : LITE_LIMITS } = {}) {
  const sourceEvents = Array.isArray(raw.events) ? raw.events : [];
  const events = sourceEvents
    .slice(0, limits.maxEvents)
    .map((event) => normalizeEvent(event, { pro, maxDelayMs: limits.maxDurationMs }))
    .filter(Boolean);
  let elapsed = 0;
  const bounded = [];
  for (const event of events) {
    elapsed += event.delayMs;
    if (elapsed > limits.maxDurationMs) break;
    bounded.push(event);
  }
  return {
    schema: MACRO_SCHEMA,
    id: String(raw.id || randomUUID()),
    name: String(raw.name || "Recorded Macro").trim().slice(0, 80) || "Recorded Macro",
    createdAt: String(raw.createdAt || new Date().toISOString()),
    updatedAt: String(raw.updatedAt || raw.createdAt || new Date().toISOString()),
    durationMs: bounded.reduce((sum, event) => sum + event.delayMs, 0),
    events: bounded,
  };
}

export function validateMacro(raw, { pro = true } = {}) {
  const errors = [];
  if (!raw || typeof raw !== "object") errors.push("Macro must be an object.");
  const events = Array.isArray(raw?.events) ? raw.events : [];
  if (!events.length) errors.push("Macro has no events.");
  if (!pro && events.some((event) => !String(event?.type || "").startsWith("key"))) errors.push("Lite macros can contain keyboard events only.");
  const down = new Set();
  const buttons = new Set();
  for (const event of events) {
    const vk = Number(event?.vk);
    if (event?.type === "keyDown") down.add(vk);
    if (event?.type === "keyUp") down.delete(vk);
    if (event?.type === "mouseDown") buttons.add(String(event.button || ""));
    if (event?.type === "mouseUp") buttons.delete(String(event.button || ""));
  }
  const unmatched = [...down].filter((vk) => Number.isFinite(vk));
  const unmatchedButtons = [...buttons].filter(Boolean);
  return { ok: errors.length === 0, errors, unmatchedKeys: unmatched, unmatchedButtons };
}

export function playbackSettings(raw = {}, { pro = true } = {}) {
  if (!pro) return { speed: 1, mode: "once", repeatCount: 1, coordinateMode: "absolute" };
  const mode = ["once","count","while-held","toggle"].includes(raw.playbackMode) ? raw.playbackMode : "once";
  const rawSpeed = Number(raw.playbackSpeed);
  const speed = Number.isFinite(rawSpeed) ? clamp(rawSpeed, 0.25, 4) : 1;
  const rawRepeat = Number(raw.repeatCount);
  const repeatCount = mode === "count"
    ? Math.round(Number.isFinite(rawRepeat) ? clamp(rawRepeat, 1, 100) : 2)
    : (mode === "once" ? 1 : 0);
  return {
    speed,
    mode,
    repeatCount,
    coordinateMode: raw.coordinateMode === "active-window" ? "active-window" : "absolute",
  };
}


export function playbackSafetyError(macro, settings) {
  const repeatCount = Number(settings?.repeatCount ?? 1);
  const durationMs = Number(macro?.durationMs ?? 0);
  if (repeatCount === 0 && durationMs < 25) {
    return "While-held and toggle loops need at least 25 ms of macro timing.";
  }
  return "";
}

export function keysInMacro(macro) {
  return [...new Set((macro?.events || []).filter((event) => event.type === "keyDown" || event.type === "keyUp").map((event) => Number(event.vk)).filter((vk) => vk > 0 && vk <= 255))];
}

export function describeEvent(event) {
  if (!event) return "Unknown";
  if (event.type === "keyDown") return `Key down · ${event.name || keyLabel(event.vk)}`;
  if (event.type === "keyUp") return `Key up · ${event.name || keyLabel(event.vk)}`;
  if (event.type === "mouseMove") return `Move mouse · ${event.x}, ${event.y}`;
  if (event.type === "mouseDown") return `${title(event.button)} mouse down`;
  if (event.type === "mouseUp") return `${title(event.button)} mouse up`;
  if (event.type === "wheel") return `${event.horizontal ? "Horizontal" : "Vertical"} wheel · ${event.delta}`;
  return "Unknown";
}

export function keyLabel(vk) {
  const n = Number(vk);
  const common = {
    8:"Backspace",9:"Tab",13:"Enter",16:"Shift",17:"Ctrl",18:"Alt",20:"Caps Lock",27:"Esc",32:"Space",
    33:"Page Up",34:"Page Down",35:"End",36:"Home",37:"Left",38:"Up",39:"Right",40:"Down",
    44:"Print Screen",45:"Insert",46:"Delete",91:"Left Windows",92:"Right Windows",
    112:"F1",113:"F2",114:"F3",115:"F4",116:"F5",117:"F6",118:"F7",119:"F8",120:"F9",121:"F10",122:"F11",123:"F12"
  };
  if (common[n]) return common[n];
  if (n >= 48 && n <= 57) return String.fromCharCode(n);
  if (n >= 65 && n <= 90) return String.fromCharCode(n);
  return `VK ${n.toString(16).toUpperCase().padStart(2,"0")}`;
}

function title(value) {
  const text = String(value || "");
  return text ? text[0].toUpperCase() + text.slice(1) : "";
}

export function exportEnvelope(macro) {
  return {
    format: "packrat-macro",
    schema: MACRO_SCHEMA,
    exportedAt: new Date().toISOString(),
    macro: normalizeMacro(macro, { pro: true }),
  };
}

export function importEnvelope(raw) {
  const source = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (!source || source.format !== "packrat-macro" || Number(source.schema) !== MACRO_SCHEMA) {
    throw new Error("Unsupported PackRat macro file.");
  }
  const macro = normalizeMacro(source.macro, { pro: true });
  if (!macro.events.length) throw new Error("PackRat macro file contains no playable events.");
  return macro;
}
