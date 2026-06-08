const { fetchSosPrecincts } = require("../sos-precinct-fetcher");

const GOV = {
  county: "Fulton",
  electionId: "GeneralPrimary51926",
  ballotItemId: "01000000-f33c-bc21-51c6-08dead3402a8",
  raceName: "Governor - Rep",
};

fetchSosPrecincts(GOV)
  .then((p) => {
    console.log("OK", p.county, p.precinctCount, "precincts", p.raceName);
    const sum = p.precincts.reduce((s, r) => s + r.totalVotes, 0);
    console.log("  vote sum", sum, "county total", p.countySummary.totalVotes);
  })
  .catch((e) => console.error("FAIL", e.message));
