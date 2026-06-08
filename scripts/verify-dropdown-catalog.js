/**
 * Offline check: US Senate must be in statewide list for the Contest dropdown.
 * Usage: node scripts/verify-dropdown-catalog.js
 */
const { loadManifest } = require("../sos-races");
const { tierForRace, isStatewideRaceId } = require("../sos-races");

function main() {
  const manifest = loadManifest();
  if (!manifest?.races?.length) {
    console.error("FAIL: no races-manifest.json or empty races");
    process.exit(1);
  }

  const us = manifest.races.filter((r) => /^US2[RD]$/.test(r.id));
  console.log("US Senate in manifest:", us.map((r) => `${r.id} ${r.name}`).join(" | ") || "(none)");

  const statewide = manifest.races.filter((r) => tierForRace(r) === "statewide");
  const usInStatewide = statewide.filter((r) => /^US2[RD]$/.test(r.id));
  console.log("Statewide count (tierForRace):", statewide.length);
  console.log("US Senate in statewide:", usInStatewide.map((r) => r.id).join(", ") || "(none)");

  if (us.length < 2) {
    console.error("FAIL: manifest missing US2R/US2D");
    process.exit(1);
  }
  if (usInStatewide.length < 2) {
    console.error("FAIL: tierForRace excludes US Senate — check sos-races.js isStatewideRaceId");
    process.exit(1);
  }
  if (!isStatewideRaceId("US2R") || !isStatewideRaceId("US2D")) {
    console.error("FAIL: isStatewideRaceId broken");
    process.exit(1);
  }
  console.log("OK — catalog logic includes US Senate in statewide dropdown list.");
}

main();
