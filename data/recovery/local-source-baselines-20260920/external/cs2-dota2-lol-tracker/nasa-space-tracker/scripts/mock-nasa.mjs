/**
 * NASA Space Tracker harness. The plugin talks to free public APIs, so it works live out of
 * the box — this script verifies all three data sources are reachable and, crucially, prints
 * the ISS's *current* coordinates so you can paste them into the ISS action's Home Lat/Lon and
 * see the OVERHEAD pulse immediately (otherwise you'd wait for a real pass).
 *
 *   node scripts/mock-nasa.mjs
 */
const UA = { headers: { "user-agent": "RatpackNasaSpaceTracker/1.0 (harness)" } };
const j = async (u) => {
	const r = await fetch(u, UA);
	if (!r.ok) throw new Error(`HTTP ${r.status}`);
	return r.json();
};

console.log("— NASA Space Tracker connectivity check —\n");

try {
	const iss = await j("https://api.wheretheiss.at/v1/satellites/25544");
	console.log(`✓ ISS position: lat ${iss.latitude.toFixed(2)}, lon ${iss.longitude.toFixed(2)}, alt ${Math.round(iss.altitude)} km`);
	console.log(`  → To test the OVERHEAD pulse now, set the ISS action's Home Lat/Lon to:`);
	console.log(`      Home latitude:  ${iss.latitude.toFixed(2)}`);
	console.log(`      Home longitude: ${iss.longitude.toFixed(2)}\n`);
} catch (e) {
	console.log(`✗ ISS API: ${e.message}\n`);
}

try {
	const ll = await j("https://ll.thespacedevs.com/2.2.0/launch/upcoming/?limit=3&hide_recent_previous=true");
	console.log("✓ Next launches:");
	for (const r of ll.results) {
		const ms = new Date(r.net) - Date.now();
		const d = Math.floor(ms / 86400000);
		const h = Math.floor((ms % 86400000) / 3600000);
		console.log(`    ${r.rocket?.configuration?.name ?? "?"} — ${r.name}  (T-${d}d ${h}h)`);
	}
	console.log();
} catch (e) {
	console.log(`✗ Launch Library 2: ${e.message} (anonymous tier is rate-limited; try again later)\n`);
}

try {
	const a = await j("https://api.nasa.gov/planetary/apod?api_key=DEMO_KEY");
	console.log(`✓ APOD: "${a.title}" (${a.media_type}, ${a.date})`);
	console.log(`    ${a.url}`);
} catch (e) {
	console.log(`✗ APOD: ${e.message} (DEMO_KEY is heavily rate-limited; a free api.nasa.gov key fixes this)`);
}
