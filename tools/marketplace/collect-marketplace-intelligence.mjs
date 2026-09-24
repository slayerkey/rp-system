#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "data", "marketplace");
const SNAPSHOT_ROOT = path.join(DATA_DIR, "snapshots");
const LEGACY_LATEST = path.join(DATA_DIR, "streamdeck_search_popularity.json");
const TRENDS_PATH = path.join(DATA_DIR, "marketplace-trends.json");
const MARKETPLACE_URL = process.env.PACKRAT_MARKETPLACE_URL || "https://marketplace.elgato.com/search";
const SUGGESTIONS_INDEX = process.env.PACKRAT_ALGOLIA_SUGGESTIONS_INDEX || "products_query_suggestions";
const MAX_SCRIPT_FETCHES = Number(process.env.PACKRAT_MARKETPLACE_MAX_SCRIPTS || 80);\nconst SNAPSHOT_TERM_LIMIT = Number(process.env.PACKRAT_MARKETPLACE_TERM_LIMIT || 1000);
const USER_AGENT = "PackRat-Marketplace-Intelligence/1.0 (+https://github.com/slayerkey/rp-system)";

function isoDay(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      accept: "text/html,application/javascript,application/json;q=0.9,*/*;q=0.8",
      "user-agent": USER_AGENT,
    },
    redirect: "follow",
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return response.text();
}

function extractScripts(html, baseUrl) {
  const urls = new Set();
  const re = /<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi;
  for (const match of html.matchAll(re)) {
    try {
      const url = new URL(match[1], baseUrl);
      if (url.protocol === "https:" || url.protocol === "http:") urls.add(url.href);
    } catch {}
  }
  return [...urls].slice(0, MAX_SCRIPT_FETCHES);
}

function pushCandidate(set, value) {
  if (!value || typeof value !== "string") return;
  const v = value.trim();
  if (v) set.add(v);
}

function discoverAlgoliaCandidates(text) {
  const appIds = new Set();
  const apiKeys = new Set();

  const appPatterns = [
    /(?:applicationId|appId|ALGOLIA_APP_ID|NEXT_PUBLIC_ALGOLIA_APP_ID)\s*[:=]\s*["']([A-Z0-9]{8,16})["']/gi,
    /algoliasearch(?:Lite)?\(\s*["']([A-Z0-9]{8,16})["']\s*,/gi,
  ];
  const keyPatterns = [
    /(?:searchApiKey|apiKey|ALGOLIA_SEARCH_KEY|NEXT_PUBLIC_ALGOLIA_SEARCH_KEY)\s*[:=]\s*["']([A-Za-z0-9_-]{20,80})["']/gi,
    /algoliasearch(?:Lite)?\(\s*["'][A-Z0-9]{8,16}["']\s*,\s*["']([A-Za-z0-9_-]{20,80})["']/gi,
  ];

  for (const pattern of appPatterns) {
    for (const match of text.matchAll(pattern)) pushCandidate(appIds, match[1]);
  }
  for (const pattern of keyPatterns) {
    for (const match of text.matchAll(pattern)) pushCandidate(apiKeys, match[1]);
  }

  // Fallback harvesting for public frontend credentials.
  for (const match of text.matchAll(/\b[A-Z0-9]{10}\b/g)) pushCandidate(appIds, match[0]);
  for (const match of text.matchAll(/\b[a-f0-9]{32}\b/gi)) pushCandidate(apiKeys, match[0]);

  return { appIds, apiKeys };
}

async function discoverAlgoliaConfig() {
  const envApp = process.env.PACKRAT_ALGOLIA_APP_ID;
  const envKey = process.env.PACKRAT_ALGOLIA_SEARCH_KEY;
  if (envApp && envKey) return { appId: envApp, apiKey: envKey, discovery: "environment" };

  const page = await fetchText(MARKETPLACE_URL);
  const scripts = extractScripts(page, MARKETPLACE_URL);

  const appIds = new Set();
  const apiKeys = new Set();
  const pageCandidates = discoverAlgoliaCandidates(page);
  pageCandidates.appIds.forEach((x) => appIds.add(x));
  pageCandidates.apiKeys.forEach((x) => apiKeys.add(x));

  let scriptsScanned = 0;
  for (const scriptUrl of scripts) {
    try {
      const body = await fetchText(scriptUrl);
      scriptsScanned += 1;
      if (!body.includes("algolia") && !body.includes(SUGGESTIONS_INDEX) && !body.includes("ALGOLIA")) continue;
      const candidates = discoverAlgoliaCandidates(body);
      candidates.appIds.forEach((x) => appIds.add(x));
      candidates.apiKeys.forEach((x) => apiKeys.add(x));
    } catch (error) {
      console.warn(`WARN: could not scan ${scriptUrl}: ${error.message}`);
    }
  }

  if (!appIds.size || !apiKeys.size) {
    throw new Error(
      `Could not discover public Algolia search credentials from ${MARKETPLACE_URL}. ` +
      `Scanned ${scriptsScanned}/${scripts.length} scripts. Set PACKRAT_ALGOLIA_APP_ID and ` +
      `PACKRAT_ALGOLIA_SEARCH_KEY as fallback repository variables if Elgato changes its frontend.`
    );
  }

  const appList = [...appIds].slice(0, 30);
  const keyList = [...apiKeys].slice(0, 30);
  for (const appId of appList) {
    for (const apiKey of keyList) {
      try {
        const probe = await algoliaQuery(appId, apiKey, { query: "", hitsPerPage: 1, page: 0 });
        if (probe && Array.isArray(probe.hits)) {
          return {
            appId,
            apiKey,
            discovery: "public-frontend",
            scripts_scanned: scriptsScanned,
          };
        }
      } catch {}
    }
  }

  throw new Error(
    `Found ${appIds.size} application-id candidates and ${apiKeys.size} API-key candidates, ` +
    `but none could query ${SUGGESTIONS_INDEX}.`
  );
}

async function algoliaQuery(appId, apiKey, params) {
  const host = `https://${appId}-dsn.algolia.net`;
  const url = `${host}/1/indexes/${encodeURIComponent(SUGGESTIONS_INDEX)}/query`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-algolia-application-id": appId,
      "x-algolia-api-key": apiKey,
      "user-agent": USER_AGENT,
    },
    body: JSON.stringify({ params: new URLSearchParams(params).toString() }),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Algolia HTTP ${response.status}: ${body.slice(0, 250)}`);
  }
  return response.json();
}

async function fetchAllSuggestions(config) {
  const hits = [];
  const pageSize = 1000;
  let page = 0;
  let nbPages = 1;

  while (page < nbPages) {
    const result = await algoliaQuery(config.appId, config.apiKey, {
      query: "",
      hitsPerPage: pageSize,
      page,
      attributesToRetrieve: "*",
      attributesToHighlight: "",
      attributesToSnippet: "",
    });
    hits.push(...(result.hits || []));
    nbPages = Number(result.nbPages || 1);
    page += 1;
    if (page > 100) throw new Error("Refusing to fetch more than 100 Algolia pages.");
  }
  return hits;
}

function numberFrom(record, keys) {
  for (const key of keys) {
    const value = record?.[key];
    if (Number.isFinite(Number(value))) return Number(value);
  }
  return null;
}

function extractExactHits(record) {
  const direct = numberFrom(record, [
    "exact_product_hits",
    "exactProductHits",
    "nb_hits",
    "nbHits",
    "results",
    "result_count",
    "resultCount",
  ]);
  if (direct !== null) return direct;

  const paths = [
    ["facets", "exact_matches", "nb_hits"],
    ["facets", "exact_matches", "nbHits"],
    ["analytics", "nb_hits"],
  ];
  for (const parts of paths) {
    let value = record;
    for (const part of parts) value = value?.[part];
    if (Number.isFinite(Number(value))) return Number(value);
  }
  return null;
}

function extractCategoryCounts(record) {
  const candidates = [
    record?.top_exact_categories,
    record?.facets?.exact_matches?.categories,
    record?.facets?.exact_matches?.extensions,
    record?.facets?.categories,
    record?.facets?.extensions,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      const rows = candidate
        .map((row) => {
          if (typeof row === "string") return { category: row, count: null };
          return {
            category: row.category ?? row.name ?? row.value ?? row.label ?? null,
            count: Number.isFinite(Number(row.count ?? row.value_count))
              ? Number(row.count ?? row.value_count)
              : null,
          };
        })
        .filter((row) => row.category)
        .slice(0, 8);
      if (rows.length) return rows;
    }
    if (candidate && typeof candidate === "object") {
      const rows = Object.entries(candidate)
        .filter(([, count]) => Number.isFinite(Number(count)))
        .map(([category, count]) => ({ category, count: Number(count) }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8);
      if (rows.length) return rows;
    }
  }
  return [];
}

function normalizeSuggestions(rawHits, capturedAt, sourceMeta) {
  const rows = rawHits
    .map((hit) => ({
      term: String(hit.query ?? hit.term ?? "").trim(),
      popularity: numberFrom(hit, ["popularity", "searches", "search_count", "searchCount"]),
      exact_product_hits: extractExactHits(hit),
      top_exact_categories: extractCategoryCounts(hit),
    }))
    .filter((row) => row.term)
    .sort((a, b) => {
      const pop = (b.popularity ?? -1) - (a.popularity ?? -1);
      if (pop !== 0) return pop;
      return a.term.localeCompare(b.term);
    })
    .map((row, index) => ({ rank: index + 1, ...row }))
    .slice(0, SNAPSHOT_TERM_LIMIT)
    .map((row) => ({
      ...row,
      platform_supply: {
        widgets: row.top_exact_categories.find((x) => String(x.category).toLowerCase() === "widgets")?.count ?? null,
        plugins: row.top_exact_categories.find((x) => String(x.category).toLowerCase() === "plugins")?.count ?? null,
        profiles: row.top_exact_categories.find((x) => String(x.category).toLowerCase() === "profiles")?.count ?? null,
        icons: row.top_exact_categories.find((x) => String(x.category).toLowerCase() === "icons")?.count ?? null,
      },
    }));

  return {
    schema_version: 2,
    marketplace: "Elgato Marketplace",
    captured_at: capturedAt,
    source: {
      public_frontend: MARKETPLACE_URL,
      query_suggestions_index: SUGGESTIONS_INDEX,
      popularity_definition:
        "Raw rolling search popularity from the public Marketplace Query Suggestions index. Treat as demand evidence, not sales.",
      collector: "tools/marketplace/collect-marketplace-intelligence.mjs",
      discovery: sourceMeta.discovery,
      exact_product_hits_definition:
        "Exact-result supply when exposed by the Query Suggestions record. Null means the current public record did not expose a compatible count.",
    },
    total_indexed_terms: rows.length,
    top_terms: rows,
  };
}

async function readSnapshots() {
  let days = [];
  try {
    days = await fs.readdir(SNAPSHOT_ROOT, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }

  const snapshots = [];
  for (const entry of days) {
    if (!entry.isDirectory() || !/^\d{4}-\d{2}-\d{2}$/.test(entry.name)) continue;
    const file = path.join(SNAPSHOT_ROOT, entry.name, "query-suggestions.json");
    try {
      const data = JSON.parse(await fs.readFile(file, "utf8"));
      snapshots.push(data);
    } catch (error) {
      console.warn(`WARN: skipping invalid snapshot ${file}: ${error.message}`);
    }
  }
  return snapshots.sort((a, b) => String(a.captured_at).localeCompare(String(b.captured_at)));
}

function dayDiff(a, b) {
  const ms = Date.parse(a + "T00:00:00Z") - Date.parse(b + "T00:00:00Z");
  return Math.round(ms / 86400000);
}

function nearestPrior(snapshots, latestDate, targetDays) {
  const eligible = snapshots
    .filter((s) => s.captured_at < latestDate)
    .map((s) => ({ snapshot: s, age: dayDiff(latestDate, s.captured_at) }))
    .filter((x) => x.age >= targetDays)
    .sort((a, b) => a.age - b.age);
  return eligible[0]?.snapshot ?? null;
}

function mapTerms(snapshot) {
  return new Map((snapshot?.top_terms || []).map((row) => [String(row.term).toLowerCase(), row]));
}

function delta(current, prior, field) {
  const a = current?.[field];
  const b = prior?.[field];
  if (!Number.isFinite(Number(a)) || !Number.isFinite(Number(b))) return null;
  return Number(a) - Number(b);
}

function trendLabel(popDelta) {
  if (popDelta === null) return "insufficient_history";
  if (popDelta >= 5) return "rising";
  if (popDelta <= -5) return "falling";
  return "stable";
}

function buildTrends(snapshots) {
  const latest = snapshots.at(-1);
  if (!latest) {
    return {
      schema_version: 1,
      generated_at: new Date().toISOString(),
      snapshot_count: 0,
      note: "No Marketplace snapshots are available yet.",
      terms: [],
    };
  }

  const previous = snapshots.at(-2) ?? null;
  const prior7 = nearestPrior(snapshots, latest.captured_at, 7);
  const prior30 = nearestPrior(snapshots, latest.captured_at, 30);
  const prevMap = mapTerms(previous);
  const map7 = mapTerms(prior7);
  const map30 = mapTerms(prior30);

  const terms = (latest.top_terms || []).map((current) => {
    const key = String(current.term).toLowerCase();
    const prev = prevMap.get(key);
    const d7 = map7.get(key);
    const d30 = map30.get(key);
    const popSincePrev = delta(current, prev, "popularity");

    return {
      term: current.term,
      current: {
        rank: current.rank ?? null,
        popularity: current.popularity ?? null,
        exact_product_hits: current.exact_product_hits ?? null,
        top_exact_categories: current.top_exact_categories ?? [],
      },
      change_since_previous: previous
        ? {
            captured_at: previous.captured_at,
            popularity: popSincePrev,
            rank: delta(current, prev, "rank"),
            exact_product_hits: delta(current, prev, "exact_product_hits"),
          }
        : null,
      change_7d: prior7
        ? {
            baseline_at: prior7.captured_at,
            popularity: delta(current, d7, "popularity"),
            rank: delta(current, d7, "rank"),
            exact_product_hits: delta(current, d7, "exact_product_hits"),
          }
        : null,
      change_30d: prior30
        ? {
            baseline_at: prior30.captured_at,
            popularity: delta(current, d30, "popularity"),
            rank: delta(current, d30, "rank"),
            exact_product_hits: delta(current, d30, "exact_product_hits"),
          }
        : null,
      momentum: prev ? trendLabel(popSincePrev) : "insufficient_history",
      is_new_since_previous: Boolean(previous && !prev),
    };
  });

  return {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    marketplace: "Elgato Marketplace",
    source: "data/marketplace/snapshots/*/query-suggestions.json",
    snapshot_count: snapshots.length,
    latest_capture: latest.captured_at,
    previous_capture: previous?.captured_at ?? null,
    seven_day_baseline: prior7?.captured_at ?? null,
    thirty_day_baseline: prior30?.captured_at ?? null,
    interpretation: {
      popularity: "Marketplace search-demand signal; not sales or revenue.",
      exact_product_hits: "Visible exact-result supply signal; not units sold.",
      momentum:
        "Rising/falling uses >=5 absolute popularity points versus the previous saved snapshot. Trend claims require multiple dated snapshots.",
      platform:
        "Demand is Marketplace-wide. Use result types/categories plus platform feasibility to classify Stream Deck versus XENEON Edge opportunity.",
    },
    terms,
  };
}

async function writeJson(file, data) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(data, null, 2) + "\n", "utf8");
}

async function main() {
  const capturedAt = process.env.PACKRAT_CAPTURE_DATE || isoDay();
  const config = await discoverAlgoliaConfig();
  console.log(`Discovered Marketplace search config via ${config.discovery}.`);

  const rawHits = await fetchAllSuggestions(config);
  if (!rawHits.length) throw new Error("Query Suggestions returned zero records.");

  const snapshot = normalizeSuggestions(rawHits, capturedAt, config);
  const snapshotPath = path.join(SNAPSHOT_ROOT, capturedAt, "query-suggestions.json");
  await writeJson(snapshotPath, snapshot);

  // Preserve the legacy latest-file contract for existing RatPack consumers.
  await writeJson(LEGACY_LATEST, snapshot);

  const snapshots = await readSnapshots();
  const trends = buildTrends(snapshots);
  await writeJson(TRENDS_PATH, trends);

  console.log(
    `Saved ${snapshot.total_indexed_terms} terms to ${path.relative(ROOT, snapshotPath)}; ` +
    `trend history now has ${trends.snapshot_count} snapshot(s).`
  );
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exit(1);
});
