import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const koffi = require("koffi");

/**
 * Windows Core Audio, reached through COM with koffi -- no C++ addon.
 *
 * COM is just objects whose first field points to a vtable of function pointers, so a
 * method call is: read the vtable, read the Nth slot, `koffi.call` it with the interface
 * pointer as the implicit `this`. Each operation opens the endpoint, does its thing, and
 * releases everything, so there are no long-lived COM pointers to go stale when the user
 * swaps a headset. A mute is a handful of calls -- cheap enough to do per press.
 */

const ole32 = koffi.load("ole32.dll");
const CoInitializeEx = ole32.func("long __stdcall CoInitializeEx(void *reserved, unsigned long coInit)");
const CoCreateInstance = ole32.func(
	"long __stdcall CoCreateInstance(void *rclsid, void *outer, unsigned long ctx, void *riid, _Out_ void **ppv)"
);
const CoTaskMemFree = ole32.func("void __stdcall CoTaskMemFree(void *p)");
const PropVariantClear = ole32.func("long __stdcall PropVariantClear(void *pvar)");

const COINIT_MULTITHREADED = 0x0;
const CLSCTX_ALL = 0x17;
const eCapture = 1;
const eCommunications = 2;
const DEVICE_STATE_ACTIVE = 0x1;
const STGM_READ = 0x0;
const VT_LPWSTR = 31;

function guid(str: string): Buffer {
	const h = str.replace(/[{}-]/g, "");
	const b = Buffer.alloc(16);
	b.writeUInt32LE(parseInt(h.slice(0, 8), 16), 0);
	b.writeUInt16LE(parseInt(h.slice(8, 12), 16), 4);
	b.writeUInt16LE(parseInt(h.slice(12, 16), 16), 6);
	for (let i = 0; i < 8; i++) b[8 + i] = parseInt(h.slice(16 + i * 2, 18 + i * 2), 16);
	return b;
}

const CLSID_MMDeviceEnumerator = guid("{BCDE0395-E52F-467C-8E3D-C4579291692E}");
const IID_IMMDeviceEnumerator = guid("{A95664D2-9614-4F35-A746-DE8DB63617E6}");
const IID_IAudioEndpointVolume = guid("{5CDF2C82-841E-4546-9722-0CF74078229A}");

/** PROPERTYKEY for a device's friendly name: {fmtid}, pid 14. */
const PKEY_Device_FriendlyName = (() => {
	const b = Buffer.alloc(20);
	guid("{A45C254E-DF1C-4EFD-8020-67D146A850E0}").copy(b, 0);
	b.writeUInt32LE(14, 16);
	return b;
})();

// Method prototypes. Index in the vtable is in the comment (IUnknown occupies 0-2).
const GetDefaultAudioEndpoint = koffi.proto("long __stdcall GetDefaultAudioEndpoint(void *self, int flow, int role, _Out_ void **dev)"); // 4
const EnumAudioEndpoints = koffi.proto("long __stdcall EnumAudioEndpoints(void *self, int flow, unsigned long mask, _Out_ void **col)"); // 3
const GetDevice = koffi.proto("long __stdcall GetDevice(void *self, str16 id, _Out_ void **dev)"); // 5
const GetCount = koffi.proto("long __stdcall GetCount(void *self, _Out_ unsigned int *n)"); // 3
const Item = koffi.proto("long __stdcall Item(void *self, unsigned int i, _Out_ void **dev)"); // 4
const Activate = koffi.proto("long __stdcall Activate(void *self, void *iid, unsigned long ctx, void *params, _Out_ void **out)"); // 3
const OpenPropertyStore = koffi.proto("long __stdcall OpenPropertyStore(void *self, unsigned long access, _Out_ void **store)"); // 4
const GetId = koffi.proto("long __stdcall GetId(void *self, _Out_ void **id)"); // 5
const GetValue = koffi.proto("long __stdcall GetValue(void *self, void *key, void *pv)"); // 5
const SetMute = koffi.proto("long __stdcall SetMute(void *self, int mute, void *ctx)"); // 14
const GetMute = koffi.proto("long __stdcall GetMute(void *self, _Out_ int *mute)"); // 15
const SetVolScalar = koffi.proto("long __stdcall SetVolScalar(void *self, float level, void *ctx)"); // 7
const GetVolScalar = koffi.proto("long __stdcall GetVolScalar(void *self, _Out_ float *level)"); // 9
const Release = koffi.proto("unsigned long __stdcall Release(void *self)"); // 2

function vcall<T>(iface: unknown, index: number, proto: unknown, ...args: unknown[]): T {
	const vtbl = koffi.decode(iface, "void *");
	const fn = koffi.decode(vtbl, index * 8, "void *");
	return koffi.call(fn, proto, iface, ...args) as T;
}
const release = (iface: unknown): void => {
	if (iface) vcall(iface, 2, Release);
};

let comReady = false;
function ensureCom(): void {
	if (comReady) return;
	CoInitializeEx(null, COINIT_MULTITHREADED); // S_OK or S_FALSE (already inited) are both fine
	comReady = true;
}

function enumerator(): unknown {
	ensureCom();
	const pp = [null];
	const hr = CoCreateInstance(CLSID_MMDeviceEnumerator, null, CLSCTX_ALL, IID_IMMDeviceEnumerator, pp);
	if (hr < 0 || !pp[0]) throw new Error(`MMDeviceEnumerator failed (0x${(hr >>> 0).toString(16)})`);
	return pp[0];
}

/** Opens an IMMDevice: a specific capture device by id, or the default mic when id is null. */
function openDevice(en: unknown, id: string | null): unknown {
	const pp = [null];
	const hr = id
		? vcall<number>(en, 5, GetDevice, id, pp)
		: vcall<number>(en, 4, GetDefaultAudioEndpoint, eCapture, eCommunications, pp);
	if (hr < 0 || !pp[0]) throw new Error(`open device failed (0x${(hr >>> 0).toString(16)})`);
	return pp[0];
}

function openVolume(device: unknown): unknown {
	const pp = [null];
	const hr = vcall<number>(device, 3, Activate, IID_IAudioEndpointVolume, CLSCTX_ALL, null, pp);
	if (hr < 0 || !pp[0]) throw new Error(`activate endpoint volume failed (0x${(hr >>> 0).toString(16)})`);
	return pp[0];
}

/** Runs `fn` with the endpoint-volume interface for a device, releasing everything after. */
function withVolume<T>(id: string | null, fn: (vol: unknown) => T): T {
	const en = enumerator();
	let device: unknown = null;
	let vol: unknown = null;
	try {
		device = openDevice(en, id);
		vol = openVolume(device);
		return fn(vol);
	} finally {
		release(vol);
		release(device);
		release(en);
	}
}

export type CaptureDevice = { id: string; name: string; isDefault: boolean };

/** Lists active microphones, marking the current default communications device. */
export function listCaptureDevices(): CaptureDevice[] {
	const en = enumerator();
	const devices: CaptureDevice[] = [];
	let collection: unknown = null;
	let defaultId: string | null = null;

	try {
		// The default mic's id, so we can flag it in the list.
		try {
			const def = openDevice(en, null);
			try {
				defaultId = readDeviceId(def);
			} finally {
				release(def);
			}
		} catch {
			/* no default mic; leave nothing flagged */
		}

		const pp = [null];
		if (vcall<number>(en, 3, EnumAudioEndpoints, eCapture, DEVICE_STATE_ACTIVE, pp) < 0 || !pp[0]) return devices;
		collection = pp[0];

		const nOut = [0];
		vcall(collection, 3, GetCount, nOut);
		for (let i = 0; i < nOut[0]; i++) {
			const dpp = [null];
			if (vcall<number>(collection, 4, Item, i, dpp) < 0 || !dpp[0]) continue;
			const device = dpp[0];
			try {
				const id = readDeviceId(device);
				const name = readFriendlyName(device) ?? "Microphone";
				devices.push({ id, name, isDefault: id === defaultId });
			} finally {
				release(device);
			}
		}
	} finally {
		release(collection);
		release(en);
	}
	return devices;
}

function readDeviceId(device: unknown): string {
	const pp = [null];
	vcall(device, 5, GetId, pp);
	const ptr = pp[0];
	try {
		// decode.wstring is the purpose-built reader; koffi.decode(ptr, "str16") on a raw
		// pointer segfaults.
		return koffi.decode.wstring(ptr) as string;
	} finally {
		CoTaskMemFree(ptr);
	}
}

function readFriendlyName(device: unknown): string | null {
	const spp = [null];
	if (vcall<number>(device, 4, OpenPropertyStore, STGM_READ, spp) < 0 || !spp[0]) return null;
	const store = spp[0];
	const pv = Buffer.alloc(24); // PROPVARIANT is 16 on x86, 24 on x64
	try {
		if (vcall<number>(store, 5, GetValue, PKEY_Device_FriendlyName, pv) < 0) return null;
		if (pv.readUInt16LE(0) !== VT_LPWSTR) return null;
		const strPtr = koffi.decode(pv, 8, "void *");
		return koffi.decode.wstring(strPtr) as string;
	} finally {
		PropVariantClear(pv);
		release(store);
	}
}

/** null id = the default microphone. Returns the mute state, or null if it can't be read. */
export function getMute(id: string | null): boolean | null {
	try {
		return withVolume(id, (vol) => {
			const out = [0];
			if (vcall<number>(vol, 15, GetMute, out) < 0) return null;
			return out[0] !== 0;
		});
	} catch {
		return null;
	}
}

export function setMute(id: string | null, mute: boolean): void {
	withVolume(id, (vol) => vcall(vol, 14, SetMute, mute ? 1 : 0, null));
}

/** Flips mute and returns the new state. */
export function toggleMute(id: string | null): boolean {
	return withVolume(id, (vol) => {
		const out = [0];
		vcall(vol, 15, GetMute, out);
		const next = out[0] === 0;
		vcall(vol, 14, SetMute, next ? 1 : 0, null);
		return next;
	});
}

/** Input level, 0..1, or null if unreadable. */
export function getVolume(id: string | null): number | null {
	try {
		return withVolume(id, (vol) => {
			const out = [0];
			if (vcall<number>(vol, 9, GetVolScalar, out) < 0) return null;
			return out[0];
		});
	} catch {
		return null;
	}
}

export function setVolume(id: string | null, level: number): void {
	const clamped = Math.min(1, Math.max(0, level));
	withVolume(id, (vol) => vcall(vol, 7, SetVolScalar, clamped, null));
}

/** Nudges input level by a delta (e.g. +0.05) and returns the new level. */
export function nudgeVolume(id: string | null, delta: number): number {
	return withVolume(id, (vol) => {
		const out = [0];
		vcall(vol, 9, GetVolScalar, out);
		const next = Math.min(1, Math.max(0, out[0] + delta));
		vcall(vol, 7, SetVolScalar, next, null);
		return next;
	});
}
