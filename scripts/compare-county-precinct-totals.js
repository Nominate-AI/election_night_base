const { fetchSosTracker } = require("../sos-fetcher");
const { fetchSosPrecincts, warmPrecinctInfrastructure } = require("../sos-precinct-fetcher");

const ELECTION = "GeneralPrimary51926";
const BALLOT = "01000000-f33c-bc21-51c6-08dead3402a8";

async function compareCounty(name) {
  const tracker = await fetchSosTracker({ electionId: ELECTION, ballotItemId: BALLOT });
  const mapRow = tracker.mapRows.find((r) => r.name === name);
  if (!mapRow) {
    console.log("\n", name, "not in map");
    return;
  }

  const warm = await warmPrecinctInfrastructure({
    electionId: ELECTION,
    ballotItemId: BALLOT,
    raceName: "Governor - Rep",
  });
  const key = name.toLowerCase().replace(/['.]/g, "");
  const idx = warm.countyIndex.get(key);
  const p = await fetchSosPrecincts({
    county: name,
    electionId: ELECTION,
    ballotItemId: BALLOT,
    statewideBallot: warm.statewideBallot,
    raceName: "Governor - Rep",
    countySlug: idx?.countySlug,
    mapFeatureId: name,
  });

  const all = p.precincts;
  const sumAll = all.reduce((s, x) => s + x.totalVotes, 0);
  const sumWithVotes = all.filter((x) => x.hasVotes).reduce((s, x) => s + x.totalVotes, 0);
  const sumBallotsCast = all.reduce((s, x) => s + Number(x.ballotsCast) || 0, 0);
  const zeros = all.filter((x) => !x.hasVotes).length;

  const mapCand = Object.values(mapRow.candidates || {}).reduce((s, v) => s + v, 0);
  const precCand = Object.values(p.countySummary.candidates || {}).reduce((s, v) => s + v, 0);

  console.log(`\n=== ${name} ===`);
  console.log("  MAP county row totalVotes:", mapRow.totalVotes);
  console.log("  MAP sum candidate cols:    ", mapCand);
  console.log("  PRECINCT API county total: ", p.countySummary.totalVotes);
  console.log("  PRECINCT API sum cands:    ", precCand);
  console.log("  Sum ALL precinct rows:     ", sumAll, `(${all.length} precincts, ${zeros} zero)`);
  console.log("  Sum precincts w/ votes:    ", sumWithVotes);
  console.log("  Sum precinct ballotsCast:  ", sumBallotsCast);
  console.log("  MAP vs sum all precincts:  ", mapRow.totalVotes - sumAll);
  console.log("  MAP vs county precinct API:", mapRow.totalVotes - p.countySummary.totalVotes);
  console.log("  API county vs sum precincts:", p.countySummary.totalVotes - sumAll);
}

(async () => {
  for (const c of ["Haralson", "Appling", "Fulton", "Cobb"]) {
    await compareCounty(c);
  }
})();
