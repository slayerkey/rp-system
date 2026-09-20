// Validates the claude.ai usage path with YOUR sessionKey — locally.
// The token is read from a file, never printed, and only sent to claude.ai.
//
//   1) Put your sessionKey (sk-ant-sid01-...) on one line in `.session-token`
//   2) node scripts/validate-session.mjs
//
// It prints HTTP status + the usage JSON (no token), or tells you Cloudflare blocked it.
import { readFileSync } from "node:fs";

const tokenFile = process.argv[2] || ".session-token";
let token;
try {
	token = readFileSync(tokenFile, "utf8").trim();
} catch {
	console.error(`Create ${tokenFile} containing your sessionKey on one line.`);
	process.exit(1);
}
if (!token.startsWith("sk-ant-sid01")) console.warn("warning: expected a sk-ant-sid01-... session key");

const headers = {
	Cookie: `sessionKey=${token}`,
	"User-Agent":
		"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
	Accept: "application/json, text/plain, */*",
	"Accept-Language": "en-US,en;q=0.9",
	Referer: "https://claude.ai/settings/usage",
	Origin: "https://claude.ai",
	"sec-ch-ua": '"Chromium";v="131", "Not_A Brand";v="24"',
	"sec-ch-ua-mobile": "?0",
	"sec-ch-ua-platform": '"Windows"',
	"sec-fetch-dest": "empty",
	"sec-fetch-mode": "cors",
	"sec-fetch-site": "same-origin",
	"anthropic-client-platform": "web_claude_ai",
};

async function get(url) {
	const r = await fetch(url, { headers });
	const ct = r.headers.get("content-type") || "";
	return { status: r.status, ct, body: await r.text() };
}

const blocked = (r) => r.ct.includes("html") || r.body.includes("Just a moment");

const orgs = await get("https://claude.ai/api/organizations");
console.log("GET /api/organizations ->", orgs.status, orgs.ct);
if (blocked(orgs)) {
	console.log("\n❌ BLOCKED by Cloudflare (HTML challenge). The Node runtime needs TLS impersonation for this path.");
	console.log("first 120 chars:", orgs.body.slice(0, 120));
	process.exit(2);
}

let orgId;
try {
	const arr = JSON.parse(orgs.body);
	orgId = (Array.isArray(arr) ? arr[0] : arr)?.uuid;
} catch {
	console.log("could not parse organizations JSON:", orgs.body.slice(0, 200));
	process.exit(3);
}
console.log("orgId:", orgId);

const usage = await get(`https://claude.ai/api/organizations/${orgId}/usage`);
console.log("GET /usage ->", usage.status, usage.ct);
if (blocked(usage)) {
	console.log("\n❌ usage endpoint Cloudflare-challenged.");
	process.exit(2);
}
try {
	console.log("\n✅ usage JSON:\n" + JSON.stringify(JSON.parse(usage.body), null, 2).slice(0, 1800));
} catch {
	console.log("usage body (first 300):", usage.body.slice(0, 300));
}
