/** Writes config/county-groupings.json and county-groupings-data.js for the map. */
const fs = require("fs");
const path = require("path");
const { getCountyGroupings } = require("../county-groupings");

const root = path.join(__dirname, "..");
const data = getCountyGroupings();

fs.writeFileSync(path.join(root, "config", "county-groupings.json"), JSON.stringify(data, null, 2));
fs.writeFileSync(
  path.join(root, "county-groupings-data.js"),
  `window.COUNTY_GROUPINGS = ${JSON.stringify(data)};\n`
);
console.log("Wrote county groupings:", Object.keys(data.modes).join(", "));
