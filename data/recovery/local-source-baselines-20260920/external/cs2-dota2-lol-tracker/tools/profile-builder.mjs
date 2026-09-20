import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export function deterministicUuid(seed) {
	const hex = createHash("sha256").update(seed).digest("hex").slice(0, 32).split("");
	hex[12] = "4";
	hex[16] = ((Number.parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
	const value = hex.join("").toUpperCase();
	return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

export function profileAction(seed, name, uuid, settings = {}) {
	return {
		ActionID: deterministicUuid(seed),
		LinkedTitle: true,
		Name: name,
		UUID: uuid,
		Settings: settings,
		State: 0,
		States: [{ Title: "" }],
	};
}

export async function writeProfiles({ profileDir, seedPrefix, profiles }) {
	await mkdir(profileDir, { recursive: true });
	for (const profile of profiles) {
		const rootUuid = deterministicUuid(`${seedPrefix}:profile:${profile.file}`);
		const manifest = {
			Actions: profile.actions,
			Name: profile.name,
			Version: "1.0",
		};
		const archive = zipStore([
			{
				name: `${rootUuid}.sdProfile/manifest.json`,
				data: `${JSON.stringify(manifest, null, 2)}\n`,
			},
		]);
		await writeFile(path.join(profileDir, `${profile.file}.streamDeckProfile`), archive);
	}
}

function crc32(buffer) {
	let crc = 0xffffffff;
	for (const byte of buffer) {
		crc ^= byte;
		for (let i = 0; i < 8; i += 1) {
			crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
		}
	}
	return (crc ^ 0xffffffff) >>> 0;
}

function zipStore(entries) {
	const local = [];
	const central = [];
	let offset = 0;

	for (const entry of entries) {
		const name = Buffer.from(entry.name.replaceAll("\\", "/"), "utf8");
		const data = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data, "utf8");
		const crc = crc32(data);
		const localHeader = Buffer.alloc(30);
		localHeader.writeUInt32LE(0x04034b50, 0);
		localHeader.writeUInt16LE(20, 4);
		localHeader.writeUInt16LE(0x0800, 6);
		localHeader.writeUInt16LE(0, 8);
		localHeader.writeUInt16LE(0, 10);
		localHeader.writeUInt16LE(0, 12);
		localHeader.writeUInt32LE(crc, 14);
		localHeader.writeUInt32LE(data.length, 18);
		localHeader.writeUInt32LE(data.length, 22);
		localHeader.writeUInt16LE(name.length, 26);
		localHeader.writeUInt16LE(0, 28);
		local.push(localHeader, name, data);

		const centralHeader = Buffer.alloc(46);
		centralHeader.writeUInt32LE(0x02014b50, 0);
		centralHeader.writeUInt16LE(20, 4);
		centralHeader.writeUInt16LE(20, 6);
		centralHeader.writeUInt16LE(0x0800, 8);
		centralHeader.writeUInt16LE(0, 10);
		centralHeader.writeUInt16LE(0, 12);
		centralHeader.writeUInt16LE(0, 14);
		centralHeader.writeUInt32LE(crc, 16);
		centralHeader.writeUInt32LE(data.length, 20);
		centralHeader.writeUInt32LE(data.length, 24);
		centralHeader.writeUInt16LE(name.length, 28);
		centralHeader.writeUInt16LE(0, 30);
		centralHeader.writeUInt16LE(0, 32);
		centralHeader.writeUInt16LE(0, 34);
		centralHeader.writeUInt16LE(0, 36);
		centralHeader.writeUInt32LE(0, 38);
		centralHeader.writeUInt32LE(offset, 42);
		central.push(centralHeader, name);
		offset += localHeader.length + name.length + data.length;
	}

	const centralBuffer = Buffer.concat(central);
	const end = Buffer.alloc(22);
	end.writeUInt32LE(0x06054b50, 0);
	end.writeUInt16LE(0, 4);
	end.writeUInt16LE(0, 6);
	end.writeUInt16LE(entries.length, 8);
	end.writeUInt16LE(entries.length, 10);
	end.writeUInt32LE(centralBuffer.length, 12);
	end.writeUInt32LE(offset, 16);
	end.writeUInt16LE(0, 20);
	return Buffer.concat([...local, centralBuffer, end]);
}
