const https = require("https");

function get(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json,*/*" } }, (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => resolve({ status: res.statusCode, body: body.slice(0, 2000) }));
      })
      .on("error", reject);
  });
}

const bases = [
  "https://results.enr.clarityelections.com/MI/Cass/124696/web.345435",
  "https://results.enr.clarityelections.com/MI/Cass/124696",
  "https://app.enhancedvoting.com/results/public/api/elections/cass-county-mi/general11052024",
];

const paths = [
  "",
  "/en/summary.json",
  "/summary.json",
  "/en/detail.json",
  "/detail.json",
  "/en/vt_data.json",
  "/data.json",
  "/api/summary",
];

(async () => {
  for (const b of bases) {
    for (const p of paths) {
      const url = b + p;
      const r = await get(url);
      if (r.status === 200 && r.body.length > 50) {
        console.log("OK", url, r.body.slice(0, 150));
      }
    }
  }
  const ev = await get(
    "https://app.enhancedvoting.com/results/public/api/elections/cass-county-mi/general11052024/ballot-items?limit=3&offset=0"
  );
  console.log("Cass EV ballot", ev.status, ev.body.slice(0, 300));
})();
