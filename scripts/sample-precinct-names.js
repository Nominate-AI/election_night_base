const { fetchSosPrecincts, warmPrecinctInfrastructure } = require("../sos-precinct-fetcher");

const ELECTION = "GeneralPrimary51926";
const BALLOT = "01000000-f33c-bc21-51c6-08dead3402a8";
const COUNTIES = [
  "Haralson",
  "Fulton",
  "Cobb",
  "DeKalb",
  "Chatham",
  "Gwinnett",
  "Bibb",
  "Floyd",
];

function patternStats(names) {
  const s = (re) => names.filter((n) => re.test(String(n).trim())).length;
  return {
    numericOnly: s(/^\d+$/),
    pNumber: s(/^P\d/i),
    hasHash: s(/#/),
    hasDash: s(/ - |-/),
    hasComma: s(/,/),
    looksMunicipal: s(/\b(city|town|ward|district|municipal)\b/i),
    allCapsWord: s(/\b[A-Z]{2,}\b/),
    virtualNote: "(see isVirtual on rows)",
  };
}

(async () => {
  const warm = await warmPrecinctInfrastructure({
    electionId: ELECTION,
    ballotItemId: BALLOT,
    raceName: "Governor - Rep",
  });

  for (const county of COUNTIES) {
    const key = county.toLowerCase().replace(/['.]/g, "");
    const idx = warm.countyIndex.get(key);
    const p = await fetchSosPrecincts({
      county,
      electionId: ELECTION,
      ballotItemId: BALLOT,
      statewideBallot: warm.statewideBallot,
      raceName: "Governor - Rep",
      countySlug: idx?.countySlug,
      mapFeatureId: county,
    });

    const names = p.precincts.map((x) => x.name);
    const orders = p.precincts.map((x) => x.precinctOrder).filter((o) => o != null);
    const virtual = p.precincts.filter((x) => x.isVirtual).length;

    console.log(`\n=== ${county} (${names.length} precincts, ${virtual} virtual) ===`);
    console.log("  first:", names.slice(0, 6).join(" | "));
    console.log("  mid:  ", names.slice(20, 26).join(" | "));
    console.log("  stats:", JSON.stringify(patternStats(names)));
    if (orders.length) {
      console.log(
        "  precinctOrder range:",
        Math.min(...orders),
        "-",
        Math.max(...orders)
      );
    }
  }
})();
