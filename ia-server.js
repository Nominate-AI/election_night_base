/*
 * Iowa Election Night Tracker — live results server
 * -------------------------------------------------
 * Pulls live results from the Iowa SOS / Scytl Election Night Reporting feed
 * and serves them to a DecisionDeskHQ-style dashboard.
 *
 * Data source (public, unofficial):
 *   https://electionresults.iowa.gov/IA/<ELECTION_ID>/web.<WEB_ID>/#/detail/<contest>
 *
 * How the feed works (Scytl/Clarity ENR):
 *   1. GET /IA/<ELECTION_ID>/current_ver.txt        -> current data version (e.g. 373402)
 *   2. GET /IA/<ELECTION_ID>/<version>/json/en/summary.json   (gzip-compressed)
 *      -> an array of contest objects (see normalizeContest below)
 *
 * No external npm packages required — uses Node built-ins only (https, zlib, http, fs).
 *
 * To re-point this at a different election (e.g. the November general election):
 *   change ELECTION_ID below to the new election id from the SOS URL, or set the
 *   IA_ELECTION_ID environment variable. Everything else adapts automatically.
 */

const fs = require("fs");
const path = require("path");
const http = require("http");
const https = require("https");
const zlib = require("zlib");

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const ROOT = __dirname;
const PORT = Number(process.env.IA_PORT) || 8090;
const HOST = "electionresults.iowa.gov";

// 2026 Primary Election (Governor - Rep. page = contest 2000).
const ELECTION_ID = process.env.IA_ELECTION_ID || "126082";

// How long to cache the upstream summary before fetching again (ms).
const CACHE_MS = Number(process.env.IA_CACHE_MS) || 5000;

// Which contests the dashboard shows: Governor + all Federal offices
// (US Senate + US House), for BOTH party primaries.
function isFeaturedContest(c) {
  const cat = String(c.category || "").toLowerCase(); // SUBCAT
  const name = String(c.name || "").toLowerCase();
  if (cat === "federal") return true; // US Senator + US Representative
  if (name.includes("governor")) return true; // Governor (statewide)
  return false;
}

// ---------------------------------------------------------------------------
// Tiny HTTPS GET helper that transparently handles gzip + redirects
// ---------------------------------------------------------------------------
function httpsGet(urlPath, { binary = false, redirects = 0 } = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      host: HOST,
      path: urlPath,
      headers: {
        Accept: "application/json,text/plain,*/*",
        "Accept-Encoding": "gzip, deflate",
        "User-Agent": "IA-Election-Tracker/1.0 (+local)",
      },
    };
    const req = https.get(options, (res) => {
      // Follow redirects
      if (
        res.statusCode >= 300 &&
        res.statusCode < 400 &&
        res.headers.location &&
        redirects < 4
      ) {
        res.resume();
        const loc = res.headers.location.replace(/^https?:\/\/[^/]+/i, "");
        resolve(httpsGet(loc, { binary, redirects: redirects + 1 }));
        return;
      }
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`HTTP ${res.statusCode} for ${urlPath}`));
          return;
        }
        let buf = Buffer.concat(chunks);
        const enc = String(res.headers["content-encoding"] || "").toLowerCase();
        try {
          // 1) Undo any transfer-level deflate the CDN applied.
          if (enc.includes("deflate")) buf = zlib.inflateSync(buf);
          // 2) Scytl stores these files gzip-compressed, and the CDN may ALSO
          //    transfer-gzip them. Peel every gzip layer (magic bytes 1f 8b).
          let guard = 0;
          while (buf.length > 2 && buf[0] === 0x1f && buf[1] === 0x8b && guard < 4) {
            buf = zlib.gunzipSync(buf);
            guard++;
          }
        } catch (e) {
          return reject(new Error(`Decompress failed for ${urlPath}: ${e.message}`));
        }
        resolve(binary ? buf : buf.toString("utf8"));
      });
    });
    req.on("error", reject);
    req.setTimeout(25000, () => req.destroy(new Error(`Timeout: ${urlPath}`)));
  });
}

// ---------------------------------------------------------------------------
// Normalize one raw Scytl contest object into a clean shape for the UI
// ---------------------------------------------------------------------------
// Raw fields: C=name, K=key, CAT=party, SUBCAT=category, VF=voteFor,
//   TP=totalPrecincts, PR=precinctsReporting, TV=totalVotes, BC=ballotsCast,
//   CH=[candidate names], P=[party codes], V=[votes], PCT=[percentages], W=[winner flags]
function normalizeContest(c) {
  const names = Array.isArray(c.CH) ? c.CH : [];
  const parties = Array.isArray(c.P) ? c.P : [];
  const votes = Array.isArray(c.V) ? c.V : [];
  const pcts = Array.isArray(c.PCT) ? c.PCT : [];
  const wins = Array.isArray(c.W) ? c.W : [];

  const sumV = votes.reduce((s, v) => s + Number(v || 0), 0);
  const candidates = names.map((nm, i) => ({
    name: String(nm || "").trim(),
    party: String(parties[i] || "").trim(),
    votes: Number(votes[i] || 0),
    // Use Scytl's pre-computed PCT when available; fall back to computing from sumV.
    pct: pcts[i] != null ? Number(pcts[i]) : (sumV > 0 ? Number(votes[i] || 0) / sumV * 100 : 0),
    winner: Number(wins[i] || 0) === 1,
    order: i,
  }));

  // Sort by votes descending; keep Write-in last when everything is tied at 0.
  candidates.sort((a, b) => {
    if (b.votes !== a.votes) return b.votes - a.votes;
    const aw = /write[- ]?in/i.test(a.name) ? 1 : 0;
    const bw = /write[- ]?in/i.test(b.name) ? 1 : 0;
    if (aw !== bw) return aw - bw;
    return a.order - b.order;
  });

  const totalPrecincts = Number(c.TP || 0);
  const reporting = Number(c.PR || 0);

  // Scytl's T field = actual vote total. TV is a different internal field that
  // stays 0 early in the night. Use T directly; fall back to summing V values.
  const totalVotes = Number(c.T || 0) || candidates.reduce((s, x) => s + x.votes, 0);

  return {
    key: String(c.K || ""),
    name: String(c.C || "").trim(),
    party: String(c.CAT || "").trim(), // Republican / Democratic
    category: String(c.SUBCAT || "").trim(), // Federal / Statewide / ...
    voteFor: Number(c.VF || 1),
    totalVotes,
    ballotsCast: Number(c.BC || 0) || totalVotes,
    precinctsTotal: totalPrecincts,
    precinctsReporting: reporting,
    pctReporting: totalPrecincts > 0 ? (reporting / totalPrecincts) * 100 : 0,
    candidates,
  };
}

// ---------------------------------------------------------------------------
// Fetch + cache the statewide summary
// ---------------------------------------------------------------------------
let cache = { at: 0, payload: null };

// ---------------------------------------------------------------------------
// Fetch per-county results (Governor-Rep contest) from 99 county endpoints
// ---------------------------------------------------------------------------
const COUNTY_CACHE_MS = 30000;          // 30 s — county data doesn't change faster
let countyCache = { at: 0, payload: null };
let countyFetchPromise = null;          // in-flight dedup: only one fetch runs at a time

// Candidate last-name → key mapping for Governor-Rep
const GOV_LAST_TO_KEY = {
  lahn: "lahn",
  feenstra: "feenstra",
  steen: "steen",
  sherman: "sherman",
  andrews: "andrews",
};

/**
 * Fetch electionsettings.json to get all 99 participating county entries.
 * Returns array of { countyName, countyElecId, stateVersion }
 */
async function fetchCountyList(stateVersion) {
  const raw = await httpsGet(
    `/IA/${ELECTION_ID}/${stateVersion}/json/en/electionsettings.json`
  );
  let settings;
  try { settings = JSON.parse(raw); } catch (e) { throw new Error("electionsettings.json not valid JSON"); }
  const counties = (settings.settings?.electiondetails?.participatingcounties) || [];
  return counties.map(function (entry) {
    // Format: "CountyName|countyElecId|countyVersion|date|templateCode"
    const parts = String(entry).split("|");
    const rawName = parts[0] || "";
    // Underscores → spaces
    const countyName = rawName.replace(/_+/g, " ").trim();
    const countyElecId = (parts[1] || "").trim();
    return { countyName, countyElecId };
  }).filter(function (c) { return c.countyName && c.countyElecId; });
}

/**
 * Fetch a single county's current version and summary.json, extract Gov-Rep.
 * Returns a county result object shaped for the frontend mapRows.
 */
async function fetchOneCounty(countyName, countyElecId) {
  // Use underscores for URL paths (Iowa SOS uses County_Name in URLs)
  const urlName = countyName.replace(/\s+/g, "_");
  let version;
  try {
    version = (await httpsGet(
      `/IA/${urlName}/${countyElecId}/current_ver.txt?_=${Date.now()}`
    )).trim();
    if (!/^\d+$/.test(version)) throw new Error(`bad version: ${version.slice(0,30)}`);
  } catch (e) {
    return null; // county not yet available
  }

  let arr;
  try {
    const raw = await httpsGet(
      `/IA/${urlName}/${countyElecId}/${version}/json/en/summary.json`
    );
    arr = JSON.parse(raw);
  } catch (e) {
    return null;
  }
  if (!Array.isArray(arr)) return null;

  // Find Governor-Rep contest
  const govRep = arr.find(function (c) {
    return /governor/i.test(String(c.C || "")) && /rep/i.test(String(c.CAT || ""));
  });
  if (!govRep) return null;

  const names = Array.isArray(govRep.CH) ? govRep.CH : [];
  const votes = Array.isArray(govRep.V)  ? govRep.V  : [];
  const totalVotes = Number(govRep.T || 0) ||
    (Array.isArray(govRep.V) ? govRep.V.reduce(function(s,v){ return s+Number(v||0); },0) : 0);

  const candidates = {};
  Object.keys(GOV_LAST_TO_KEY).forEach(function(k){ candidates[k] = 0; });

  names.forEach(function(nm, i) {
    var last = String(nm || "").trim().split(/\s+/).pop().toLowerCase();
    if (GOV_LAST_TO_KEY[last]) {
      candidates[GOV_LAST_TO_KEY[last]] = Number(votes[i] || 0);
    }
  });

  // Compute winner + margin
  var winner = null;
  var margin = 0;
  if (totalVotes > 0) {
    var sorted = Object.keys(candidates).sort(function(a,b){ return candidates[b]-candidates[a]; });
    var top = candidates[sorted[0]];
    var second = sorted.length > 1 ? candidates[sorted[1]] : 0;
    if (top === second && top > 0) {
      winner = "tie";
    } else if (top > 0) {
      winner = sorted[0];
      margin = (top - second) / totalVotes;
    }
  }

  return {
    name: countyName,
    totalVotes,
    ballotsCast: totalVotes,
    hasVotes: totalVotes > 0,
    candidates,
    winner,
    margin,
    precinctsReported: Number(govRep.PR || 0),
    totalPrecincts: Number(govRep.TP || 0),
  };
}

/**
 * Fetch all 99 counties in parallel batches of 15.
 */
async function fetchAllCountyResults() {
  // We need the statewide current version to fetch electionsettings.json
  const stateVersion = (await httpsGet(
    `/IA/${ELECTION_ID}/current_ver.txt?_=${Date.now()}`
  )).trim();
  if (!/^\d+$/.test(stateVersion)) throw new Error(`Bad state version: ${stateVersion.slice(0,40)}`);

  const countyList = await fetchCountyList(stateVersion);

  const BATCH = 10; // gentle on Iowa SOS — 10 concurrent county fetches at a time
  const results = [];
  for (let i = 0; i < countyList.length; i += BATCH) {
    const batch = countyList.slice(i, i + BATCH);
    const batchResults = await Promise.all(
      batch.map(function(c){ return fetchOneCounty(c.countyName, c.countyElecId).catch(function(){ return null; }); })
    );
    batchResults.forEach(function(r){ if(r) results.push(r); });
  }
  return results;
}

function getCountyResults() {
  const now = Date.now();
  if (countyCache.payload && now - countyCache.at < COUNTY_CACHE_MS) {
    return Promise.resolve(countyCache.payload);
  }
  // If a fetch is already in-flight, return the same promise (don't start another 99-county sweep)
  if (countyFetchPromise) return countyFetchPromise;

  countyFetchPromise = fetchAllCountyResults()
    .then(function(counties) {
      const payload = { fetchedAt: new Date().toISOString(), counties };
      countyCache = { at: Date.now(), payload };
      countyFetchPromise = null;
      return payload;
    })
    .catch(function(err) {
      countyFetchPromise = null;
      throw err;
    });
  return countyFetchPromise;
}

async function fetchSummary() {
  // Add cache-bust so CDN always returns the freshest version number.
  const version = (await httpsGet(`/IA/${ELECTION_ID}/current_ver.txt?_=${Date.now()}`)).trim();
  if (!/^\d+$/.test(version)) {
    throw new Error(`Unexpected version value: "${version.slice(0, 40)}"`);
  }
  const raw = await httpsGet(`/IA/${ELECTION_ID}/${version}/json/en/summary.json`);
  let arr;
  try {
    arr = JSON.parse(raw);
  } catch (e) {
    throw new Error("summary.json was not valid JSON");
  }
  if (!Array.isArray(arr)) throw new Error("summary.json was not an array");

  const contests = arr.map(normalizeContest);
  return {
    electionId: ELECTION_ID,
    version,
    fetchedAt: new Date().toISOString(),
    sourceUrl: `https://${HOST}/IA/${ELECTION_ID}/web.345435/#/detail/2000`,
    contests,
  };
}

async function getSummary() {
  const now = Date.now();
  if (cache.payload && now - cache.at < CACHE_MS) return cache.payload;
  const payload = await fetchSummary();
  cache = { at: now, payload };
  return payload;
}

// ---------------------------------------------------------------------------
// Static file serving
// ---------------------------------------------------------------------------
const STATIC = {
  "/": { file: "ia-map.html", type: "text/html; charset=utf-8" },
  "/index.html": { file: "ia-map.html", type: "text/html; charset=utf-8" },
  "/ia-map.html": { file: "ia-map.html", type: "text/html; charset=utf-8" },
  "/ia-map.css": { file: "ia-map.css", type: "text/css; charset=utf-8" },
  "/ia-map.js": { file: "ia-map.js", type: "application/javascript; charset=utf-8" },
  "/ia-tracker-data.js": { file: "ia-tracker-data.js", type: "application/javascript; charset=utf-8" },
  "/Iowa_county_map.svg": { file: "Iowa_county_map.svg", type: "image/svg+xml; charset=utf-8" },
  "/ia-dashboard.html": { file: "ia-dashboard.html", type: "text/html; charset=utf-8" },
  "/ia-dashboard.css": { file: "ia-dashboard.css", type: "text/css; charset=utf-8" },
  "/ia-dashboard.js": { file: "ia-dashboard.js", type: "application/javascript; charset=utf-8" },
  "/ia-dashboard.css": { file: "ia-dashboard.css", type: "text/css; charset=utf-8" },
};

function serveStatic(entry, res) {
  const full = path.join(ROOT, entry.file);
  fs.readFile(full, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not found: " + entry.file);
      return;
    }
    res.writeHead(200, { "Content-Type": entry.type, "Cache-Control": "no-cache" });
    res.end(data);
  });
}

// ---------------------------------------------------------------------------
// HTTP server
// ---------------------------------------------------------------------------
const server = http.createServer(async (req, res) => {
  const url = (req.url || "/").split("?")[0];

  // County-level results for the map (per-county Gov-Rep data).
  if (url === "/api/county-results") {
    try {
      const payload = await getCountyResults();
      res.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-cache",
        "Access-Control-Allow-Origin": "*",
      });
      res.end(JSON.stringify({
        granularity: "county",
        fetchedAt: payload.fetchedAt,
        counties: payload.counties,
      }));
    } catch (e) {
      res.writeHead(502, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: String(e.message || e) }));
      console.error("  ! county fetch error:", e.message);
    }
    return;
  }

  if (url === "/api/summary" || url === "/api/featured") {
    try {
      const payload = await getSummary();
      let contests = payload.contests;
      if (url === "/api/featured") {
        contests = contests.filter(isFeaturedContest);
      }
      // For /api/featured, also include county results (best-effort, non-blocking)
      let countyResults = null;
      if (url === "/api/featured") {
        try {
          const cr = await getCountyResults();
          countyResults = cr.counties;
        } catch (e) {
          console.warn("  ! county results not yet available:", e.message);
        }
      }
      res.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-cache",
        "Access-Control-Allow-Origin": "*",
      });
      const out = { ...payload, contests };
      if (countyResults !== null) {
        out.countyResults = countyResults;
        // Aggregate true precinct totals from county-level data.
        // The statewide summary PR/TP counts COUNTIES (reporting units), not precincts.
        //
        // Some counties upload full results without setting their precinct counter (PR=0
        // but hasVotes=true). We count them as "reporting" if they have any votes (closest
        // match to Iowa SOS — off by at most 1 due to cache lag).
        out.countiesReporting = countyResults.filter(function(c) {
          return c.hasVotes || c.precinctsReported > 0;
        }).length;
        out.countiesTotal = countyResults.length;
        out.precinctsReporting = countyResults.reduce(function(s, c) {
          // PR=0 but votes present → all precincts are effectively in
          var pr = (c.precinctsReported === 0 && c.hasVotes) ? (c.totalPrecincts || 0) : (c.precinctsReported || 0);
          return s + pr;
        }, 0);
        out.precinctsTotal = countyResults.reduce(function(s, c) { return s + (c.totalPrecincts || 0); }, 0);
      }
      res.end(JSON.stringify(out));
    } catch (e) {
      res.writeHead(502, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: String(e.message || e) }));
      console.error("  ! fetch error:", e.message);
    }
    return;
  }

  const entry = STATIC[url];
  if (entry) return serveStatic(entry, res);

  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Not found");
});

server.listen(PORT, () => {
  console.log("");
  console.log("  Iowa Election Night Tracker");
  console.log("  ===========================");
  console.log(`  Election ID : ${ELECTION_ID}`);
  console.log(`  Live results: http://localhost:${PORT}/`);
  console.log(`  API (raw)   : http://localhost:${PORT}/api/featured`);
  console.log("");
  console.log("  Keep this window OPEN. Close it to quit.");
  console.log("");
  // Warm the cache so the first page load is instant.
  getSummary()
    .then((p) => console.log(`  + Loaded ${p.contests.length} contests (version ${p.version}).`))
    .catch((e) => console.error("  ! Could not reach Iowa SOS yet:", e.message));
});
