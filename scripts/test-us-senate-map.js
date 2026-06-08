/**
 * Verify US Senate primaries resolve and return 159 county map rows from live SOS.
 * Usage: node scripts/test-us-senate-map.js
 */
const { getElectionRaces, resolveRaceForFetch } = require("../sos-races");
const { fetchSosTracker } = require("../sos-fetcher");

async function checkRace(id, name) {
  const catalog = await getElectionRaces();
  const race = catalog.races.find((r) => r.id === id);
  if (!race) throw new Error(`Missing race ${id} in catalog`);
  const tier = race.tier || (catalog.statewideRaces.some((r) => r.id === id) ? "statewide" : "local");
  const sel = await resolveRaceForFetch(id, catalog.races);
  const data = await fetchSosTracker({ ballotItemId: sel.ballotItemId });
  const names = data.candidates.map((c) => c.displayName || c.fullName).join(", ");
  console.log(`\n${name} (${id}, tier=${tier})`);
  console.log(`  ballot: ${sel.ballotItemId}`);
  console.log(`  counties: ${data.mapRows?.length ?? 0}`);
  console.log(`  candidates: ${names}`);
  if ((data.mapRows?.length ?? 0) < 150) {
    throw new Error(`Expected 159 counties, got ${data.mapRows?.length}`);
  }
}

(async () => {
  const catalog = await getElectionRaces();
  const us = catalog.statewideRaces.filter((r) => /^US2[RD]$/.test(r.id));
  console.log("Statewide US Senate in catalog:", us.map((r) => r.name).join(" · "));
  if (us.length < 2) {
    throw new Error(`Expected US2R and US2D in statewideRaces, got ${us.length}`);
  }
  await checkRace("US2R", "US Senate - Rep");
  await checkRace("US2D", "US Senate - Dem");
  console.log("\nOK — US Senate map data ready.");
})().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
