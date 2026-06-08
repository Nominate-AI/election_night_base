const fs = require("fs");
const path = require("path");
const { buildSosResultsCsv } = require("../sos-csv-export");

buildSosResultsCsv({
  electionId: "GeneralPrimary51926",
  ballotItemId: "01000000-f33c-bc21-51c6-08dead3402a8",
  raceName: "Governor - Rep",
  exportLevel: process.argv[2] === "precinct" ? "precinct" : "county",
  countyLimit: 2,
})
  .then((out) => {
    const file = path.join(__dirname, "..", "tmp-export-sample.csv");
    fs.writeFileSync(file, out.csv, "utf8");
    const fulton = out.csv.split(/\r?\n/).find((l) => l.startsWith("county,Fulton,"));
    const haralson = out.csv.split(/\r?\n/).find((l) => l.startsWith("county,Haralson,"));
    console.log("wrote", file);
    console.log("counties", out.countyCount, "precincts", out.precinctCount, "errors", out.precinctErrors);
    console.log("Fulton row", fulton?.slice(0, 120));
    console.log("Haralson row", haralson?.slice(0, 120));
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
