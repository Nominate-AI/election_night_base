/*
 * ia-data.js — Reusable Iowa SOS (Scytl ENR) data fetcher.
 * -------------------------------------------------------
 * Extracted from ia-server.js so the unified server can pull Iowa data without
 * running a second process.  Uses Node built-ins only (https, zlib).
 *
 *   getIaSummary()        -> { version, fetchedAt, contests:[normalized] }
 *   getIaCountyResults()  -> { fetchedAt, counties:[{name,candidates,...}] }
 *
 * County results are the per-county Governor-Rep breakdown (the headline race),
 * pulled from each of the 99 county endpoints listed in electionsettings.json.
 */
const https = require("https");
const zlib = require("zlib");

const HOST = "electionresults.iowa.gov";
const ELECTION_ID = process.env.IA_ELECTION_ID || "126082";
const SUMMARY_CACHE_MS = Number(process.env.IA_CACHE_MS) || 5000;
const COUNTY_CACHE_MS = 30000;

// Governor-Rep candidate last-name -> internal key
const GOV_LAST_TO_KEY = {
  lahn: "lahn",
  feenstra: "feenstra",
  steen: "steen",
  sherman: "sherman",
  andrews: "andrews",
};

// ---------------------------------------------------------------------------
// HTTPS GET that transparently handles gzip + redirects
// ---------------------------------------------------------------------------
function httpsGet(urlPath, { binary = false, redirects = 0 } = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      host: HOST,
      path: urlPath,
      headers: {
        Accept: "application/json,text/plain,*/*",
        "Accept-Encoding": "gzip, deflate",
        "User-Agent": "Election-Night-Tracker/1.0 (+local)",
      },
    };
    const req = https.get(options, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirects < 4) {
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
          if (enc.includes("deflate")) buf = zlib.inflateSync(buf);
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
// Normalize one raw Scytl contest object
// ---------------------------------------------------------------------------
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
    pct: pcts[i] != null ? Number(pcts[i]) : (sumV > 0 ? (Number(votes[i] || 0) / sumV) * 100 : 0),
    winner: Number(wins[i] || 0) === 1,
    order: i,
  }));

  candidates.sort((a, b) => {
    if (b.votes !== a.votes) return b.votes - a.votes;
    const aw = /write[- ]?in/i.test(a.name) ? 1 : 0;
    const bw = /write[- ]?in/i.test(b.name) ? 1 : 0;
    if (aw !== bw) return aw - bw;
    return a.order - b.order;
  });

  const totalPrecincts = Number(c.TP || 0);
  const reporting = Number(c.PR || 0);
  const totalVotes = Number(c.T || 0) || candidates.reduce((s, x) => s + x.votes, 0);

  return {
    key: String(c.K || ""),
    name: String(c.C || "").trim(),
    party: String(c.CAT || "").trim(),
    category: String(c.SUBCAT || "").trim(),
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
// Statewide summary (cached)
// ---------------------------------------------------------------------------
let summaryCache = { at: 0, payload: null };

async function fetchSummary() {
  const version = (await httpsGet(`/IA/${ELECTION_ID}/current_ver.txt?_=${Date.now()}`)).trim();
  if (!/^\d+$/.test(version)) throw new Error(`Unexpected version: "${version.slice(0, 40)}"`);
  const raw = await httpsGet(`/IA/${ELECTION_ID}/${version}/json/en/summary.json`);
  let arr;
  try { arr = JSON.parse(raw); } catch (e) { throw new Error("summary.json was not valid JSON"); }
  if (!Array.isArray(arr)) throw new Error("summary.json was not an array");
  return {
    electionId: ELECTION_ID,
    version,
    fetchedAt: new Date().toISOString(),
    contests: arr.map(normalizeContest),
  };
}

function getIaSummary() {
  const now = Date.now();
  if (summaryCache.payload && now - summaryCache.at < SUMMARY_CACHE_MS) {
    return Promise.resolve(summaryCache.payload);
  }
  return fetchSummary().then((payload) => {
    summaryCache = { at: Date.now(), payload };
    return payload;
  });
}

// ---------------------------------------------------------------------------
// Per-county Governor-Rep results (cached, in-flight deduped)
// ---------------------------------------------------------------------------
let countyCache = { at: 0, payload: null };
let countyFetchPromise = null;

async function fetchCountyList(stateVersion) {
  const raw = await httpsGet(`/IA/${ELECTION_ID}/${stateVersion}/json/en/electionsettings.json`);
  let settings;
  try { settings = JSON.parse(raw); } catch (e) { throw new Error("electionsettings.json not valid JSON"); }
  const counties = (settings.settings && settings.settings.electiondetails && settings.settings.electiondetails.participatingcounties) || [];
  return counties.map((entry) => {
    const parts = String(entry).split("|");
    const countyName = (parts[0] || "").replace(/_+/g, " ").trim();
    const countyElecId = (parts[1] || "").trim();
    return { countyName, countyElecId };
  }).filter((c) => c.countyName && c.countyElecId);
}

async function fetchOneCounty(countyName, countyElecId) {
  const urlName = countyName.replace(/\s+/g, "_");
  let version;
  try {
    version = (await httpsGet(`/IA/${urlName}/${countyElecId}/current_ver.txt?_=${Date.now()}`)).trim();
    if (!/^\d+$/.test(version)) throw new Error("bad version");
  } catch (e) { return null; }

  let arr;
  try {
    const raw = await httpsGet(`/IA/${urlName}/${countyElecId}/${version}/json/en/summary.json`);
    arr = JSON.parse(raw);
  } catch (e) { return null; }
  if (!Array.isArray(arr)) return null;

  const govRep = arr.find((c) => /governor/i.test(String(c.C || "")) && /rep/i.test(String(c.CAT || "")));
  if (!govRep) return null;

  const names = Array.isArray(govRep.CH) ? govRep.CH : [];
  const votes = Array.isArray(govRep.V) ? govRep.V : [];
  const totalVotes = Number(govRep.T || 0) || votes.reduce((s, v) => s + Number(v || 0), 0);

  const candidates = {};
  Object.keys(GOV_LAST_TO_KEY).forEach((k) => { candidates[k] = 0; });
  names.forEach((nm, i) => {
    const last = String(nm || "").trim().split(/\s+/).pop().toLowerCase();
    if (GOV_LAST_TO_KEY[last]) candidates[GOV_LAST_TO_KEY[last]] = Number(votes[i] || 0);
  });

  let winner = null, margin = 0;
  if (totalVotes > 0) {
    const sorted = Object.keys(candidates).sort((a, b) => candidates[b] - candidates[a]);
    const top = candidates[sorted[0]];
    const second = sorted.length > 1 ? candidates[sorted[1]] : 0;
    if (top === second && top > 0) winner = "tie";
    else if (top > 0) { winner = sorted[0]; margin = (top - second) / totalVotes; }
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

async function fetchAllCountyResults() {
  const stateVersion = (await httpsGet(`/IA/${ELECTION_ID}/current_ver.txt?_=${Date.now()}`)).trim();
  if (!/^\d+$/.test(stateVersion)) throw new Error(`Bad state version: ${stateVersion.slice(0, 40)}`);
  const countyList = await fetchCountyList(stateVersion);

  const BATCH = 10;
  const results = [];
  for (let i = 0; i < countyList.length; i += BATCH) {
    const batch = countyList.slice(i, i + BATCH);
    const batchResults = await Promise.all(
      batch.map((c) => fetchOneCounty(c.countyName, c.countyElecId).catch(() => null))
    );
    batchResults.forEach((r) => { if (r) results.push(r); });
  }
  return results;
}

function getIaCountyResults() {
  const now = Date.now();
  if (countyCache.payload && now - countyCache.at < COUNTY_CACHE_MS) {
    return Promise.resolve(countyCache.payload);
  }
  if (countyFetchPromise) return countyFetchPromise;
  countyFetchPromise = fetchAllCountyResults()
    .then((counties) => {
      const payload = { fetchedAt: new Date().toISOString(), counties };
      countyCache = { at: Date.now(), payload };
      countyFetchPromise = null;
      return payload;
    })
    .catch((err) => { countyFetchPromise = null; throw err; });
  return countyFetchPromise;
}

module.exports = {
  ELECTION_ID,
  GOV_LAST_TO_KEY,
  getIaSummary,
  getIaCountyResults,
};
