const http = require("http");
const { applyElectionProfile } = require("../election-profile");
const { buildSosResultsCsv } = require("../sos-csv-export");

applyElectionProfile(__dirname + "/..");

buildSosResultsCsv({
  exportLevel: "county",
  electionId: "GeneralPrimary51926",
  ballotItemId: "01000000-f33c-bc21-51c6-08dead3402a8",
  raceName: "Governor - Rep",
  countyLimit: 2,
})
  .then((o) => {
    console.log("BUILD OK", o.filename, "bytes", o.csv.length);
    process.exit(0);
  })
  .catch((e) => {
    console.error("BUILD FAIL", e.message);
    process.exit(1);
  });
