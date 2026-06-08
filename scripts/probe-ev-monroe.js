const https = require("https");

function get(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { Accept: "application/json" } }, (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => resolve({ status: res.statusCode, body: body.slice(0, 500) }));
      })
      .on("error", reject);
  });
}

const bases = [
  "https://app.enhancedvoting.com/results/public/api/elections/monroe-county-mi/2024NovemberGeneral",
  "https://app.enhancedvoting.com/results/public/api/elections/monroe-county-mi",
  "https://app.enhancedvoting.com/results/public/api/election/monroe-county-mi/2024NovemberGeneral",
  "https://app.enhancedvoting.com/results/public/api/elections/monroe-county-mi/2024NovemberGeneral/ballot-items?limit=5&offset=0",
  "https://app.enhancedvoting.com/results/public/api/elections/monroe-county-mi/2024NovemberGeneral/localities",
];

(async () => {
  for (const url of bases) {
    try {
      const r = await get(url);
      console.log("\n", url, "\n  ", r.status, r.body);
    } catch (e) {
      console.log(url, e.message);
    }
  }
})();
