// Validates the ChatGPT/Codex usage path with YOUR token — locally.
// The token is read from a file, never printed, and only sent to chatgpt.com.
//
//   1) Put ONE of these on one line in `.chatgpt-token`:
//        - the accessToken from chatgpt.com/api/auth/session   (starts with eyJ…)
//        - the __Secure-next-auth.session-token cookie value    (longer-lived)
//   2) node scripts/validate-chatgpt.mjs
//
// It prints HTTP status, whether an account id was recoverable, and the raw usage
// JSON — which is what confirms the field names `normalize()` expects.
import { readFileSync } from "node:fs";

const tokenFile = process.argv[2] || ".chatgpt-token";
let raw;
try {
	raw = readFileSync(tokenFile, "utf8");
} catch {
	console.error(`Create ${tokenFile} containing your ChatGPT token or session cookie on one line.`);
	process.exit(1);
}

// Keep in sync with sanitizeToken() in src/providers/openai-shared.ts.
function sanitizeToken(s) {
	let t = s.trim().replace(/\s+/g, "");
	t = t.replace(/^"?accessToken"?:?/i, "");
	t = t.replace(/^Bearer/i, "");
	t = t.replace(/^["'`,]+|["'`,;]+$/g, "");
	return t.trim();
}

function jwtPayload(token) {
	try {
		const part = token.split(".")[1];
		if (!part) return undefined;
		return JSON.parse(Buffer.from(part.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"));
	} catch {
		return undefined;
	}
}

// Keep in sync with isAccessToken() in src/providers/openai-shared.ts. Both credentials
// start with "eyJ", because a JWE header is base64url JSON too, so only the structure
// tells them apart: an accessToken is a 3-part JWS, the session cookie a 5-part JWE.
function isAccessToken(t) {
	const parts = t.split(".");
	return parts.length === 3 && !!parts[1] && jwtPayload(t) !== undefined;
}

const HEADERS = {
	Accept: "application/json",
	"User-Agent":
		"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
};

async function get(url, headers) {
	const r = await fetch(url, { headers: { ...HEADERS, ...headers } });
	const ct = r.headers.get("content-type") || "";
	return { status: r.status, ct, body: await r.text() };
}

const input = sanitizeToken(raw);
if (input !== raw.trim()) console.log("note: input needed sanitizing (quotes/whitespace/prefix were stripped)");
if (!input) {
	console.error("token file is empty");
	process.exit(1);
}

let token = input;
if (!isAccessToken(input)) {
	console.log("input does not look like an accessToken — treating it as a session cookie");
	const s = await get("https://chatgpt.com/api/auth/session", { Cookie: `__Secure-next-auth.session-token=${input}` });
	console.log("GET /api/auth/session ->", s.status, s.ct);
	if (s.ct.includes("html")) {
		console.log("\n❌ BLOCKED (HTML response) — Cloudflare challenged this request.");
		process.exit(2);
	}
	let j;
	try {
		j = JSON.parse(s.body);
	} catch {
		console.log("could not parse session JSON:", s.body.slice(0, 200));
		process.exit(3);
	}
	if (!j.accessToken) {
		console.log("\n❌ no accessToken in the session response — the cookie is not logged in.");
		console.log("keys returned:", Object.keys(j).join(", "));
		process.exit(4);
	}
	token = j.accessToken;
	console.log("✅ exchanged cookie for a fresh accessToken");
}

const payload = jwtPayload(token);
const accountId = payload?.["https://api.openai.com/auth"]?.chatgpt_account_id ?? payload?.chatgpt_account_id;
console.log("account id recovered:", accountId ? "yes" : "NO (header will be omitted)");
console.log("plan claim:", payload?.["https://api.openai.com/auth"]?.chatgpt_plan_type ?? "unknown");
if (payload?.exp) console.log("token expires:", new Date(payload.exp * 1000).toISOString());

const headers = { Authorization: `Bearer ${token}` };
if (accountId) headers["ChatGPT-Account-Id"] = accountId;

const usage = await get("https://chatgpt.com/backend-api/wham/usage", headers);
console.log("\nGET /backend-api/wham/usage ->", usage.status, usage.ct);
if (usage.ct.includes("html")) {
	console.log("\n❌ BLOCKED by Cloudflare (HTML challenge).");
	process.exit(2);
}
if (usage.status !== 200) {
	console.log("\n❌ body:", usage.body.slice(0, 400));
	if (usage.status === 401 || usage.status === 403) {
		console.log("\nThis is a genuine auth rejection. If the token was freshly copied, the likely causes are:");
		console.log("  - the account has no Codex/ChatGPT usage entitlement on this endpoint");
		console.log("  - the account is a workspace member and needs a different ChatGPT-Account-Id");
	}
	process.exit(5);
}
try {
	console.log("\n✅ usage JSON:\n" + JSON.stringify(JSON.parse(usage.body), null, 2).slice(0, 4000));
} catch {
	console.log("usage body (first 400):", usage.body.slice(0, 400));
}

// The CREDITS key reads whatever this account calls its credit balance. The field names are
// published nowhere, so dump the credits endpoint too and let the real output decide.
const credits = await get("https://chatgpt.com/backend-api/wham/rate-limit-reset-credits", headers);
console.log("\nGET /backend-api/wham/rate-limit-reset-credits ->", credits.status, credits.ct);
if (credits.status === 200 && !credits.ct.includes("html")) {
	try {
		console.log(JSON.stringify(JSON.parse(credits.body), null, 2).slice(0, 2000));
	} catch {
		console.log("body (first 400):", credits.body.slice(0, 400));
	}
} else {
	console.log("(not available on this account) body:", credits.body.slice(0, 200));
}
