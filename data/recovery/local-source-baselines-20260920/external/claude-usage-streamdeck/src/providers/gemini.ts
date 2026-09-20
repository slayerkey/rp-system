// Gemini CLI adapter — reads quota from the Gemini CLI's OAuth token stored in
// ~/.gemini/oauth_creds.json. Targets the internal cloudcode-pa quota API used
// by the Gemini CLI. Auto-refreshes the access token when expired.
// UNVALIDATED: requires a Gemini CLI account to confirm endpoint + response shape.
import { homedir } from "node:os";
import { join } from "node:path";
import { readFileSync, writeFileSync } from "node:fs";
import type { Provider, WindowData, FetchResult } from "./types";

const BASE_URL = "https://cloudcode-pa.googleapis.com/v1internal";
const CREDS_PATH = () => join(homedir(), ".gemini", "oauth_creds.json");

// Project ID is required for the quota API and must be resolved via loadCodeAssist
// before calling retrieveUserQuota. Cache it per-token to avoid repeated calls.
const projectCache = new Map<string, string>();

interface GeminiCreds {
	token?: string;
	refresh_token?: string;
	token_uri?: string;
	client_id?: string;
	client_secret?: string;
	expiry?: string;
}

function readCreds(): GeminiCreds | undefined {
	try {
		return JSON.parse(readFileSync(CREDS_PATH(), "utf8")) as GeminiCreds;
	} catch {
		return undefined;
	}
}

async function refreshAccessToken(creds: GeminiCreds): Promise<string | undefined> {
	if (!creds.refresh_token || !creds.token_uri || !creds.client_id || !creds.client_secret) return undefined;
	try {
		const res = await fetch(creds.token_uri, {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({
				grant_type: "refresh_token",
				refresh_token: creds.refresh_token,
				client_id: creds.client_id,
				client_secret: creds.client_secret,
			}),
		});
		if (!res.ok) return undefined;
		const j: any = await res.json();
		if (!j.access_token) return undefined;
		const newExpiry = new Date(Date.now() + (j.expires_in ?? 3600) * 1000).toISOString();
		try {
			writeFileSync(CREDS_PATH(), JSON.stringify({ ...creds, token: j.access_token, expiry: newExpiry }, null, 2));
		} catch { /* non-fatal */ }
		return j.access_token as string;
	} catch {
		return undefined;
	}
}

function normalize(buckets: any[]): WindowData[] {
	return (buckets ?? [])
		.filter((b: any) => b.modelId && !String(b.modelId).endsWith("_vertex") && b.remainingFraction !== undefined)
		.map((b: any) => ({
			key: String(b.modelId),
			label: String(b.modelId).replace(/^gemini-/, "").replace(/-/g, " ").toUpperCase(),
			utilization: Math.round((1 - Number(b.remainingFraction)) * 100),
			resetsAt: b.resetTime as string | undefined,
		}));
}

function authHeaders(token: string): Record<string, string> {
	return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

async function resolveProject(token: string): Promise<string | undefined> {
	if (projectCache.has(token)) return projectCache.get(token);
	// Also check env vars (Gemini CLI may set these)
	const envProject = process.env.GOOGLE_CLOUD_PROJECT ?? process.env.GOOGLE_CLOUD_PROJECT_ID;
	if (envProject) { projectCache.set(token, envProject); return envProject; }
	try {
		const res = await fetch(`${BASE_URL}:loadCodeAssist`, {
			method: "POST",
			headers: authHeaders(token),
			body: JSON.stringify({}),
		});
		if (!res.ok) return undefined;
		const j: any = await res.json();
		const project: string | undefined = j?.cloudaicompanionProject ?? j?.project ?? undefined;
		if (project) projectCache.set(token, project);
		return project;
	} catch {
		return undefined;
	}
}

async function doFetch(token: string): Promise<FetchResult> {
	const project = await resolveProject(token);
	if (!project) return { ok: false, status: 0, reason: "error", detail: "could not resolve Google Cloud project — run `gemini auth` to re-authenticate" };
	const res = await fetch(`${BASE_URL}:retrieveUserQuota`, {
		method: "POST",
		headers: authHeaders(token),
		body: JSON.stringify({ project }),
	});
	if (res.status === 401 || res.status === 403) { projectCache.delete(token); return { ok: false, status: res.status, reason: "auth" }; }
	if (res.status === 429) return { ok: false, status: 429, reason: "rate-limited" };
	const body = await res.text();
	if (!res.ok) return { ok: false, status: res.status, reason: "error", detail: body.slice(0, 120) };
	const j = JSON.parse(body);
	return { ok: true, usage: { windows: normalize(j?.buckets ?? []) } };
}

async function fetchUsage(token: string): Promise<FetchResult> {
	try {
		const result = await doFetch(token);
		if (result.ok) return result;
		if (result.reason === "auth") {
			const creds = readCreds();
			if (creds?.refresh_token) {
				const fresh = await refreshAccessToken(creds);
				if (fresh) return doFetch(fresh);
			}
		}
		return result;
	} catch (e) {
		return { ok: false, status: 0, reason: "error", detail: String(e) };
	}
}

function autoLoad(): string | undefined {
	return readCreds()?.token ?? undefined;
}

export const geminiProvider: Provider = {
	id: "gemini",
	displayName: "Gemini",
	brand: "#4285F4",
	windows: [{ key: "gemini-2.5-pro", label: "2.5 PRO", cyclable: true }],
	defaultWindow: "gemini-2.5-pro",
	autoLoadToken: autoLoad,
	fetchUsage,
};
