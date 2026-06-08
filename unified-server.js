/*
 * unified-server.js — One Election Night server for Georgia AND Iowa.
 * ------------------------------------------------------------------
 * Single port (8080). A state-namespaced API powers a single-page app with a
 * state switcher (GA / IA) and three tabs: Map, Internal Tracker, External Tracker.
 *
 *   GET  /api/states                     -> available states + candidate config
 *   GET  /api/:state/races               -> race catalog / contest list
 *   GET  /api/:state/map?race=ID         -> unified map data (county shading)
 *   GET  /api/:state/predictions         -> editable per-county predictions
 *   PUT  /api/:state/predictions/:county -> save one county's prediction
 *
 * GA data comes from the existing SOS fetcher; IA from ia-data.js (Scytl ENR).
 */
const fs = require("fs");
const path = require("path");
const http = require("http");

const ROOT = __dirname;
const PORT = Number(process.env.PORT) || 8080;

const STATE_CONFIG = require("./state-config");
const { STATES, NO_DATA_COLOR, TIE_COLOR } = STATE_CONFIG;

// Iowa (Scytl) data
const { getIaSummary, getIaCountyResults } = require("./ia-data");

// Georgia (SOS) data
const { fetchSosTracker } = require("./sos-fetcher");
const { loadRacesCatalog, resolveRaceForFetch } = require("./sos-races");

// Editable predictions
const { createPredictionsStore } = require("./unified-predictions");
const predictions = createPredictionsStore(ROOT);

// Seed sources
const { PROJECTED_TURNOUT } = require("./projected-turnout");
const IA_TRACKER = require("./ia-tracker-data");

function numOr0(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// ---------------------------------------------------------------------------
// Prediction seeds (run once, only if the data file doesn't exist yet)
// ---------------------------------------------------------------------------
function seedGa() {
  const counties = {};
  Object.keys(PROJECTED_TURNOUT || {}).forEach((name) => {
    counties[name] = { projectedTurnout: numOr0(PROJECTED_TURNOUT[name]), pred: {} };
  });
  predictions.ensureSeeded("GA", counties);
}
function seedIa() {
  const counties = {};
  (IA_TRACKER.COUNTIES || []).forEach((c) => {
    const pred = {};
    Object.keys(c.pred || {}).forEach((k) => { pred[k] = Math.round((c.pred[k] || 0) * 1000) / 10; }); // fraction -> %
    counties[c.county] = { projectedTurnout: numOr0(c.predTurnout), pred };
  });
  predictions.ensureSeeded("IA", counties);
}
seedGa();
seedIa();

// ---------------------------------------------------------------------------
// Build the unified map shape per state
// ---------------------------------------------------------------------------
async function buildGaMap(raceQuery) {
  const catalog = await loadRacesCatalog();
  const sel = await resolveRaceForFetch(raceQuery || catalog.defaultRaceId, catalog.races);
  const data = await fetchSosTracker({ ballotItemId: sel.ballotItemId });

  const candidates = (data.candidates || []).map((c) => ({
    key: c.key,
    name: c.displayName || c.fullName || c.label || c.key,
    color: c.color || NO_DATA_COLOR,
    ballotOrder: c.ballotOrder,
  }));

  const mapRows = (data.mapRows || []).map((r) => ({
    name: r.name,
    candidates: r.candidates || {},
    totalVotes: numOr0(r.totalVotes),
    ballotsCast: numOr0(r.ballotsCast),
    winner: r.winner || null,
    margin: numOr0(r.margin),
    hasVotes: !!r.hasVotes,
    precinctsReported: numOr0(r.precinctsReported),
    totalPrecincts: numOr0(r.totalPrecincts),
  }));

  const countiesReporting = mapRows.filter((r) => r.hasVotes || r.precinctsReported > 0).length;
  const precinctsReporting = mapRows.reduce((s, r) => s + r.precinctsReported, 0);
  const precinctsTotal = mapRows.reduce((s, r) => s + r.totalPrecincts, 0);

  return {
    state: "GA",
    raceName: data.raceName,
    raceId: sel.id || raceQuery || catalog.defaultRaceId,
    candidates,
    mapRows,
    stateTotals: data.stateTotals || null,
    countiesReporting,
    countiesTotal: mapRows.length,
    precinctsReporting,
    precinctsTotal,
    noDataColor: data.noDataColor || NO_DATA_COLOR,
    tieColor: data.tieColor || TIE_COLOR,
    fetchedAt: data.updatedAt || new Date().toISOString(),
    races: catalog.races,
    statewideRaces: catalog.statewideRaces,
    defaultRaceId: catalog.defaultRaceId,
  };
}

async function buildIaMap() {
  const [summary, countyData] = await Promise.all([getIaSummary(), getIaCountyResults()]);
  const cfg = STATES.IA;
  const govRep = (summary.contests || []).find(
    (c) => /governor/i.test(c.name) && /rep/i.test(c.party)
  );

  const candidates = cfg.candidates.map((c) => ({
    key: c.key, name: c.name, color: c.color, ballotOrder: c.ballotOrder,
  }));

  // Statewide totals by candidate key (match Scytl candidate name last-name -> key)
  const stateCand = {};
  candidates.forEach((c) => { stateCand[c.key] = 0; });
  (govRep ? govRep.candidates : []).forEach((cd) => {
    const last = String(cd.name || "").trim().split(/\s+/).pop().toLowerCase();
    if (stateCand[last] !== undefined) stateCand[last] = numOr0(cd.votes);
  });
  const stateTotalVotes = Object.keys(stateCand).reduce((s, k) => s + stateCand[k], 0)
    || (govRep ? govRep.totalVotes : 0);

  let stateWinner = null, second = 0, best = 0;
  Object.keys(stateCand).forEach((k) => {
    if (stateCand[k] > best) { second = best; best = stateCand[k]; stateWinner = k; }
    else if (stateCand[k] > second) { second = stateCand[k]; }
  });

  const counties = countyData.counties || [];
  const mapRows = counties.map((c) => ({
    name: c.name,
    candidates: c.candidates || {},
    totalVotes: numOr0(c.totalVotes),
    ballotsCast: numOr0(c.ballotsCast),
    winner: c.winner || null,
    margin: numOr0(c.margin),
    hasVotes: !!c.hasVotes,
    precinctsReported: numOr0(c.precinctsReported),
    totalPrecincts: numOr0(c.totalPrecincts),
  }));

  const countiesReporting = counties.filter((c) => c.hasVotes || c.precinctsReported > 0).length;
  // Counties that uploaded results without setting their precinct counter (PR=0 + votes)
  // are treated as fully in for the precinct sum.
  const precinctsReporting = counties.reduce((s, c) => {
    const pr = (c.precinctsReported === 0 && c.hasVotes) ? (c.totalPrecincts || 0) : (c.precinctsReported || 0);
    return s + pr;
  }, 0);
  const precinctsTotal = counties.reduce((s, c) => s + (c.totalPrecincts || 0), 0);

  return {
    state: "IA",
    raceName: govRep ? govRep.name : cfg.raceLabel,
    raceId: "2000",
    candidates,
    mapRows,
    stateTotals: {
      name: "Iowa", scope: "statewide",
      candidates: stateCand, totalVotes: stateTotalVotes,
      winner: best > 0 ? (best === second ? "tie" : stateWinner) : null,
      hasVotes: stateTotalVotes > 0,
    },
    countiesReporting,
    countiesTotal: counties.length,
    precinctsReporting,
    precinctsTotal,
    noDataColor: NO_DATA_COLOR,
    tieColor: TIE_COLOR,
    fetchedAt: countyData.fetchedAt,
    races: [{ id: "2000", name: govRep ? govRep.name : "Governor - Rep" }],
    defaultRaceId: "2000",
  };
}

async function buildMap(state, raceQuery) {
  if (state === "GA") return buildGaMap(raceQuery);
  if (state === "IA") return buildIaMap();
  throw new Error(`Unknown state: ${state}`);
}

async function buildRaces(state) {
  if (state === "GA") {
    const catalog = await loadRacesCatalog();
    return {
      races: catalog.races,
      statewideRaces: catalog.statewideRaces,
      defaultRaceId: catalog.defaultRaceId,
      electionName: catalog.electionName,
    };
  }
  if (state === "IA") {
    const summary = await getIaSummary();
    const govRep = (summary.contests || []).find((c) => /governor/i.test(c.name) && /rep/i.test(c.party));
    return {
      races: [{ id: "2000", name: govRep ? govRep.name : "Governor - Rep", tier: "statewide" }],
      statewideRaces: [{ id: "2000", name: govRep ? govRep.name : "Governor - Rep" }],
      defaultRaceId: "2000",
      electionName: "2026 Primary Election",
    };
  }
  throw new Error(`Unknown state: ${state}`);
}

// ---------------------------------------------------------------------------
// HTTP plumbing
// ---------------------------------------------------------------------------
function sendJson(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => { try { resolve(data ? JSON.parse(data) : {}); } catch (e) { reject(new Error("Invalid JSON body")); } });
    req.on("error", reject);
  });
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

function serveStatic(res, reqPath) {
  let rel = reqPath === "/" ? "app.html" : decodeURIComponent(reqPath.replace(/^\//, ""));
  const full = path.join(ROOT, rel);
  if (!full.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
  if (!fs.existsSync(full) || fs.statSync(full).isDirectory()) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found");
    return;
  }
  const ext = path.extname(full).toLowerCase();
  res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream", "Cache-Control": "no-cache" });
  fs.createReadStream(full).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const p = url.pathname;

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    res.end();
    return;
  }

  // GET /api/states
  if (p === "/api/states") {
    sendJson(res, 200, {
      states: STATE_CONFIG.ORDER.map((id) => {
        const s = STATES[id];
        return {
          id: s.id, name: s.name, svg: s.svg, svgStateId: s.svgStateId,
          defaultRace: s.defaultRace, raceLabel: s.raceLabel, candidates: s.candidates,
        };
      }),
      noDataColor: NO_DATA_COLOR, tieColor: TIE_COLOR,
    });
    return;
  }

  // /api/:state/...
  const m = p.match(/^\/api\/(GA|IA)\/(.+)$/);
  if (m) {
    const state = m[1];
    const rest = m[2];

    try {
      if (rest === "races" && req.method === "GET") {
        sendJson(res, 200, await buildRaces(state));
        return;
      }
      if (rest === "map" && req.method === "GET") {
        const race = url.searchParams.get("race") || url.searchParams.get("raceId");
        sendJson(res, 200, await buildMap(state, race));
        return;
      }
      if (rest === "predictions" && req.method === "GET") {
        sendJson(res, 200, predictions.list(state));
        return;
      }
      const putMatch = rest.match(/^predictions\/(.+)$/);
      if (putMatch && req.method === "PUT") {
        const county = decodeURIComponent(putMatch[1]);
        const body = await readBody(req);
        const saved = predictions.putCounty(state, county, body);
        sendJson(res, 200, { county, ...saved });
        return;
      }
    } catch (err) {
      sendJson(res, 502, { error: String(err.message || err) });
      console.error(`  ! ${state}/${rest}:`, err.message);
      return;
    }
  }

  if (p.startsWith("/api/")) {
    sendJson(res, 404, { error: "API route not found", path: p });
    return;
  }

  serveStatic(res, p);
});

server.listen(PORT, () => {
  console.log("");
  console.log("  Election Night Tracker — Unified (Georgia + Iowa)");
  console.log("  =================================================");
  console.log(`  Open:  http://localhost:${PORT}/`);
  console.log(`  States: ${STATE_CONFIG.ORDER.join(", ")}`);
  console.log(`  Predictions: data/predictions-GA.json, data/predictions-IA.json`);
  console.log("  Keep this window OPEN. Close it to quit.");
  console.log("");
});
