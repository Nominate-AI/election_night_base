const { fetchSosPrecincts, warmPrecinctInfrastructure } = require("../sos-precinct-fetcher");

(async () => {
  const warm = await warmPrecinctInfrastructure({
    electionId: "GeneralPrimary51926",
    ballotItemId: "01000000-f33c-bc21-51c6-08dead3402a8",
    raceName: "Governor - Rep",
  });
  const p = await fetchSosPrecincts({
    county: "Fulton",
    electionId: "GeneralPrimary51926",
    ballotItemId: "01000000-f33c-bc21-51c6-08dead3402a8",
    raceName: "Governor - Rep",
    statewideBallot: warm.statewideBallot,
    statewideBase: warm.statewideBase,
    countySlug: warm.countyIndex.get("fulton")?.countySlug,
    mapFeatureId: "Fulton",
  });

  const zero = p.precincts.filter((x) => !x.hasVotes);
  const withVotes = p.precincts.filter((x) => x.hasVotes);
  console.log("Fulton precincts", p.precinctCount, "with votes", withVotes.length, "zero", zero.length);
  console.log(
    "sample ZERO",
    zero.slice(0, 8).map((x) => ({
      name: x.name,
      reportingStatus: x.reportingStatus,
      ballotsCast: x.ballotsCast,
      isVirtual: x.isVirtual,
    }))
  );
  console.log(
    "sample WITH",
    withVotes.slice(0, 3).map((x) => ({
      name: x.name,
      reportingStatus: x.reportingStatus,
      totalVotes: x.totalVotes,
    }))
  );
  const sum = withVotes.reduce((s, x) => s + x.totalVotes, 0);
  console.log("sum precincts with votes", sum, "county summary total", p.countySummary.totalVotes);
})();
