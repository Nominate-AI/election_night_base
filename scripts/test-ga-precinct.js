const { fetchSosPrecincts } = require("../sos-precinct-fetcher");

async function run() {
  const cases = [
    {
      label: "2024 General — Haralson President",
      electionId: "2024NovGen",
      ballotItemId: "01000000-d884-2e72-6367-08dcda4b86b5",
      county: "Haralson",
    },
    {
      label: "2024 General — Cobb President",
      electionId: "2024NovGen",
      ballotItemId: "01000000-d884-2e72-6367-08dcda4b86b5",
      county: "Cobb",
    },
  ];

  for (const c of cases) {
    console.log(`\n=== ${c.label} ===`);
    const p = await fetchSosPrecincts(c);
    console.log("  county", p.county, "slug", p.countySlug);
    console.log("  precincts", p.precinctCount, "with votes", p.precinctsReported);
    console.log(
      "  sample",
      p.precincts.slice(0, 3).map((x) => ({
        name: x.name,
        votes: x.totalVotes,
        leader: x.winner,
      }))
    );
    const sum = p.precincts.reduce((s, r) => s + r.totalVotes, 0);
    console.log("  sum precinct votes", sum, "county row", p.countySummary.totalVotes);
  }

  console.log("\nPrimary runoff (may fail if county feed not live):");
  try {
    const primary = await fetchSosPrecincts({
      electionId: "GeneralPrimary51926",
      ballotItemId: "01000000-f33c-bc21-51c6-08dead3402a8",
      county: "Haralson",
    });
    console.log("  OK precincts", primary.precinctCount);
  } catch (e) {
    console.log("  ", e.message);
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
