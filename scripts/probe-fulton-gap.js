const { fetchSosPrecincts, warmPrecinctInfrastructure, getJsonFromApi } = require("../sos-precinct-fetcher");

(async () => {
  const warm = await warmPrecinctInfrastructure({
    electionId: "GeneralPrimary51926",
    ballotItemId: "01000000-f33c-bc21-51c6-08dead3402a8",
    raceName: "Governor - Rep",
  });
  const slug = "fulton-county-ga";
  const electionId = "GeneralPrimary51926";
  const ballotId = await (async () => {
    const p = await fetchSosPrecincts({
      county: "Fulton",
      electionId,
      ballotItemId: "01000000-f33c-bc21-51c6-08dead3402a8",
      statewideBallot: warm.statewideBallot,
      raceName: "Governor - Rep",
    });
    return p.countyBallotItemId;
  })();

  const { data: ballot } = await getJsonFromApi(
    `/elections/${slug}/${electionId}/ballot-items/${ballotId}`
  );
  const sumBr = (ballot.breakdownResults || []).reduce((s, br) => s + (br.voteTotal || 0), 0);
  const summaryTotal = ballot.voteTotal || ballot.summaryResults?.voteTotal;
  console.log("summary voteTotal", summaryTotal);
  console.log("sum breakdown voteTotal", sumBr);
  console.log("breakdown count", ballot.breakdownResults?.length);
  console.log(
    "summary ballot options votes",
    (ballot.summaryResults?.ballotOptions || []).reduce((s, o) => s + (o.voteCount || 0), 0)
  );
})();
