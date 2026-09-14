import { createHash } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { deflateRawSync } from "node:zlib";

export function deterministicUuid(seed) {
  const hex = createHash("sha256").update(String(seed)).digest("hex").slice(0, 32).split("");
  hex[12] = "4";
  hex[16] = ["8", "9", "a", "b"][parseInt(hex[16], 16) % 4];
  return `${hex.slice(0, 8).join("")}-${hex.slice(8, 12).join("")}-${hex.slice(12, 16).join("")}-${hex.slice(16, 20).join("")}-${hex.slice(20, 32).join("")}`.toUpperCase();
}

function pageFolderId(uuid) {
  const chunks = (uuid.replace(/-/g, "") + "000").match(/.{5}/g) || [];
  return chunks
    .map((chunk) => parseInt(chunk, 16).toString(32).padStart(4, "0"))
    .join("")
    .slice(0, 26)
    .toUpperCase()
    .replace(/V/g, "W")
    .replace(/U/g, "V") + "Z";
}

export function profileAction(seed, uuid, name, settings = {}) {
  return {
    ActionID: deterministicUuid(`action:${seed}`),
    LinkedTitle: true,
    Name: name,
    UUID: uuid,
    Settings: settings,
    State: 0,
    States: [{
      Title: "",
      ShowTitle: false,
      TitleAlignment: "middle",
      TitleColor: "#FFFFFF",
      FontFamily: "Arial",
      FontSize: 12,
      FontStyle: "Regular",
      FontUnderline: false,
    }],
  };
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosStamp() {
  const year = 2026 - 1980;
  return { date: (year << 9) | (1 << 5) | 1, time: 0 };
}

function zip(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  const stamp = dosStamp();

  for (const [entryPath, rawValue] of entries) {
    const name = Buffer.from(entryPath.replace(/\\/g, "/"), "utf8");
    const raw = Buffer.isBuffer(rawValue) ? rawValue : Buffer.from(rawValue, "utf8");
    const compressed = deflateRawSync(raw, { level: 9 });
    const crc = crc32(raw);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt16LE(stamp.time, 10);
    local.writeUInt16LE(stamp.date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    const localRecord = Buffer.concat([local, name, compressed]);
    locals.push(localRecord);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(stamp.time, 12);
    central.writeUInt16LE(stamp.date, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centrals.push(Buffer.concat([central, name]));
    offset += localRecord.length;
  }

  const centralData = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralData.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...locals, centralData, end]);
}

export function buildProfile(spec) {
  const rootUuid = deterministicUuid(`profile-root:${spec.file}`);
  const pageUuid = deterministicUuid(`profile-page:${spec.file}`);
  const folder = pageFolderId(pageUuid);
  const rootPath = `${rootUuid}.sdProfile`;
  const bundle = {
    Name: spec.name,
    Pages: { Current: pageUuid, Pages: [pageUuid] },
    Version: "2.0",
  };
  const controllers = [{ Actions: spec.keypad || {}, Type: "Keypad" }];
  if (spec.encoder) controllers.push({ Actions: spec.encoder, Type: "Encoder" });
  const page = { Controllers: controllers };

  return zip([
    [`${rootPath}/manifest.json`, JSON.stringify(bundle, null, 2)],
    [`${rootPath}/Profiles/${folder}/manifest.json`, JSON.stringify(page, null, 2)],
  ]);
}

export async function writeProfiles(profileDir, specs) {
  await rm(profileDir, { recursive: true, force: true });
  await mkdir(profileDir, { recursive: true });
  for (const spec of specs) {
    const file = resolve(profileDir, `${spec.file}.streamDeckProfile`);
    await writeFile(file, buildProfile(spec));
    console.log(`Built profile ${spec.file}`);
  }
}
