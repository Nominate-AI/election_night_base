const https = require("https");

function getJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { Accept: "application/json" } }, (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => {
          try {
            resolve(JSON.parse(body));
          } catch {
            resolve(null);
          }
        });
      })
      .on("error", reject);
  });
}

const BASE =
  "https://app.enhancedvoting.com/results/public/api/elections/monroe-county-mi/2024NovemberGeneral";

(async () => {
  const list = await getJson(`${BASE}/ballot-items?limit=200&offset=0`);
  const items = list?.data || list || [];
  const pres = items.find((b) => /president/i.test((b.name?.[0]?.text || b.name || "")));
  if (!pres) {
    console.log("no president", items[0]);
    return;
  }
  const detail = await getJson(`${BASE}/ballot-items/${pres.id}`);
  const sr = detail.summaryResults;
  console.log("contest", pres.name?.[0]?.text);
  console.log("voteTotal", detail.voteTotal, sr?.voteTotal);
  console.log(
    "summary opts",
    (sr?.ballotOptions || []).slice(0, 5).map((o) => ({
      name: o.name?.[0]?.text || o.name,
      votes: o.voteCount,
    }))
  );
  console.log("reporting", detail.reportingStatus);
})();
