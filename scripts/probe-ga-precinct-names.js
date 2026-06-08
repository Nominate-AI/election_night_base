const https = require("https");
const EV = "https://app.enhancedvoting.com/results/public/api";
const J = "haralson-county-ga";
const E = "2024NovGen";
const B = "01000000-d884-2e72-ed95-08dcda4bc70a";

https.get(`${EV}/elections/${J}/${E}/ballot-items/${B}`, { headers: { Accept: "application/json" } }, (res) => {
  let body = "";
  res.on("data", (c) => (body += c));
  res.on("end", () => {
    const d = JSON.parse(body);
    const br = d.breakdownResults[0];
    console.log(JSON.stringify(br, null, 2).slice(0, 1500));
  });
});
