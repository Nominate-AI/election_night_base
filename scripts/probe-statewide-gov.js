const https = require("https");
const paths = [
  "https://results.sos.ga.gov/results/public/api/elections/Georgia/GeneralPrimary51926/ballot-items/01000000-f33c-bc21-51c6-08dead3402a8",
  "https://app.enhancedvoting.com/results/public/api/elections/Georgia/GeneralPrimary51926/ballot-items/01000000-f33c-bc21-51c6-08dead3402a8",
];
for (const url of paths) {
  https.get(url, { headers: { Accept: "application/json" } }, (res) => {
    let body = "";
    res.on("data", (c) => (body += c));
    res.on("end", () => console.log(url.split("/")[2], res.statusCode, body.slice(0, 80)));
  });
}
